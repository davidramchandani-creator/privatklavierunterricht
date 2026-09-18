// ============================================================
// Zuteilung: übernehmen, bearbeiten, pro Schüler freigeben
//
// Der Ablauf, den David tatsächlich braucht:
//
//   1. Routenplaner rechnen, im Plan von Hand schieben, bis es passt.
//   2. „Als Zuteilung übernehmen" schreibt die Einträge in die Runde.
//   3. In der Zuteilung jeden Eintrag nochmal anfassen können.
//   4. Pro Schüler „Freigeben", und zwar nur dann, wenn David es will.
//      Wer noch kein Abo hat (Probelektion steht aus), bekommt seinen Platz
//      reserviert, es geht aber nichts raus.
//
// Vorher war Schritt 4 ein einziger Knopf für alle: alle Abos, alle Mails,
// im selben Augenblick. Wer kein Abo hatte, wurde stumm übersprungen.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Routenplan } from "./routing";
import type { Zuteilung } from "./zuteilung";
import {
  findeKonflikt,
  istAenderbar,
  normalisiere,
  routenplanZuZuteilungen,
  type FreigabeArt,
  type ZuteilungEintrag,
} from "./zuteilung-uebernahme";
import { wendeUmstellungAn, ladeBestaetigung, serienStart } from "./umstellung-server";
import { syncAppointmentToCalendar } from "./google-calendar";
import { cancelLessonReminders, scheduleLessonReminders } from "./reminders";
import { setzeExternenTermin } from "./externe-server";
import {
  bookFixplatzSeries,
  erklaereBlockade,
  planeFixplatzSerie,
} from "./fixplatz-server";
import { describeFixplatz } from "./fixplatz";
import { sendEmailNow } from "./emails-outbox";
import { BASIS_URL } from "./seo";
import { DEFAULT_BUFFER_MIN, LESSON_DURATION_MIN } from "./booking";

/** Die Einträge einer Runde, immer in der neuen Form. */
export async function ladeEintraege(
  admin: SupabaseClient,
  rundeId: string
): Promise<ZuteilungEintrag[]> {
  const { data } = await admin
    .from("planungsrunden")
    .select("plan")
    .eq("id", rundeId)
    .maybeSingle();
  const plan = data?.plan as { zuteilungen?: Zuteilung[] } | null;
  return (plan?.zuteilungen ?? []).map(normalisiere);
}

async function speichereEintraege(
  admin: SupabaseClient,
  rundeId: string,
  eintraege: ZuteilungEintrag[]
): Promise<void> {
  // `plan` kann weitere Felder tragen (nichtZugeteilt, Kennzahlen). Die
  // bleiben stehen, nur die Einträge werden ersetzt.
  const { data } = await admin
    .from("planungsrunden")
    .select("plan")
    .eq("id", rundeId)
    .maybeSingle();
  const bisher = (data?.plan as Record<string, unknown> | null) ?? {};
  await admin
    .from("planungsrunden")
    .update({ plan: { ...bisher, zuteilungen: eintraege } })
    .eq("id", rundeId);
}

/**
 * Den Routenplan als Zuteilung in die Runde schreiben.
 *
 * Bereits freigegebene Einträge bleiben unangetastet: Für sie existieren
 * Abo, Termine und eine verschickte Mail. Ein neuer Plan darf sie nicht
 * still überschreiben. Alle offenen und reservierten werden ersetzt.
 */
export async function uebernehmeRoutenplan(
  admin: SupabaseClient,
  rundeId: string,
  plan: Routenplan
): Promise<{ uebernommen: number; behalten: number }> {
  const bisher = await ladeEintraege(admin, rundeId);
  const freigegeben = bisher.filter((z) => z.status === "freigegeben");
  const schonDa = new Set(freigegeben.map((z) => z.schuelerId));

  const neu = routenplanZuZuteilungen(plan).filter(
    (z) => !schonDa.has(z.schuelerId)
  );

  await speichereEintraege(admin, rundeId, [...freigegeben, ...neu]);
  return { uebernommen: neu.length, behalten: freigegeben.length };
}

/**
 * Einen Eintrag ändern. Uhrzeit, Tag oder Woche.
 *
 * Geprüft wird nur die Überschneidung mit den anderen Einträgen der Runde.
 * Ob der Schüler zu dieser Zeit kann, steht in seinen Angaben, und die
 * kann David lesen. Der Planer hat sie berücksichtigt; wenn David davon
 * abweicht, weiss er, warum. Eine Sperre würde ihn zwingen, erst die
 * Angaben zu ändern, um dann dasselbe einzutragen.
 */
export async function bearbeiteEintrag(
  admin: SupabaseClient,
  rundeId: string,
  schuelerId: string,
  aenderung: { wochentag: number; beginn: string; paritaet: 0 | 1 | null },
  pufferMinuten = DEFAULT_BUFFER_MIN
): Promise<{ ok: true } | { error: string }> {
  const eintraege = await ladeEintraege(admin, rundeId);
  const ich = eintraege.find((z) => z.schuelerId === schuelerId);
  if (!ich) return { error: "Dieser Schüler steht nicht in der Zuteilung." };
  if (!istAenderbar(ich)) {
    return {
      error:
        "Schon freigegeben. Der Termin steht im Vertrag; ändern geht nur über die Schülerseite.",
    };
  }

  const konflikt = findeKonflikt(
    { schuelerId, ...aenderung },
    eintraege,
    pufferMinuten
  );
  if (konflikt) {
    return { error: `Überschneidet sich mit ${konflikt}.` };
  }

  const neu = eintraege.map((z) =>
    z.schuelerId === schuelerId
      ? {
          ...z,
          ...aenderung,
          rhythmus:
            aenderung.paritaet === null
              ? ("woechentlich" as const)
              : ("zweiwoechentlich" as const),
        }
      : z
  );
  await speichereEintraege(admin, rundeId, neu);
  return { ok: true };
}

export async function entferneEintrag(
  admin: SupabaseClient,
  rundeId: string,
  schuelerId: string
): Promise<{ ok: true } | { error: string }> {
  const eintraege = await ladeEintraege(admin, rundeId);
  const ich = eintraege.find((z) => z.schuelerId === schuelerId);
  if (!ich) return { error: "Nicht in der Zuteilung." };
  if (!istAenderbar(ich)) {
    return { error: "Schon freigegeben, lässt sich hier nicht entfernen." };
  }
  await speichereEintraege(
    admin,
    rundeId,
    eintraege.filter((z) => z.schuelerId !== schuelerId)
  );
  return { ok: true };
}

/**
 * Was beim Freigeben passieren würde, je Schüler.
 *
 * Aus der Datenbank bestimmt, nicht gespeichert: Wer heute kein Abo hat,
 * kann morgen eines haben, und dann muss die Freigabe das Richtige tun.
 */
export async function bestimmeFreigabeArten(
  admin: SupabaseClient,
  rundeId: string,
  rundenArt: string,
  schuelerIds: string[]
): Promise<Record<string, FreigabeArt>> {
  if (schuelerIds.length === 0) return {};

  const [{ data: profile }, { data: pakete }, { data: wahlen }] =
    await Promise.all([
      admin.from("profiles").select("id, extern").in("id", schuelerIds),
      admin
        .from("packages")
        .select("student_id")
        .in("student_id", schuelerIds)
        .eq("status", "active"),
      admin
        .from("planungs_antworten")
        .select("student_id, abo_variante, abo_rhythmus")
        .eq("runde_id", rundeId)
        .in("student_id", schuelerIds),
    ]);

  const extern = new Set(
    (profile ?? []).filter((p) => p.extern === true).map((p) => p.id as string)
  );
  const mitAbo = new Set((pakete ?? []).map((p) => p.student_id as string));
  const mitWahl = new Set(
    (wahlen ?? [])
      .filter((w) => w.abo_variante && w.abo_rhythmus)
      .map((w) => w.student_id as string)
  );

  const raus: Record<string, FreigabeArt> = {};
  for (const id of schuelerIds) {
    if (extern.has(id)) raus[id] = "extern";
    else if (rundenArt === "umstellung" && mitWahl.has(id)) raus[id] = "umstellung";
    else if (mitAbo.has(id)) raus[id] = "abo";
    else raus[id] = "ohne_abo";
  }
  return raus;
}

/** Die Vertragsmail zu einem Abo, mit Terminliste und PDF-Link. */
async function sendeVertragsmail(
  admin: SupabaseClient,
  packageId: string,
  studentId: string
): Promise<boolean> {
  const b = await ladeBestaetigung(admin, packageId);
  if (!b) return false;
  await sendEmailNow(admin, "umstellung_bestaetigung", {
    student_id: studentId,
    student_name: b.studentName,
    abo_label: b.aboLabel,
    fixplatz_text: b.fixplatzText,
    termin_offen: false,
    lektionen: b.lektionen,
    monatsbetrag: b.monatsbetrag,
    laufzeit_monate: b.laufzeitMonate,
    periode_start: b.periodeStart,
    periode_ende: b.periodeEnde,
    termine: b.termine,
    ferientage: b.ferientage,
    auto_renew: b.autoRenew,
    pdf_url: `${BASIS_URL}/api/abo/${packageId}/bestaetigung`,
  });
  return true;
}

/**
 * Die Vertragsmail noch einmal schicken, mit dem aktuellen Stand.
 *
 * Für den Fall, dass die erste falsch war: Die Terminliste kommt frisch aus
 * der Datenbank, das PDF ebenso. Genommen wird das jüngste Abo mit festem
 * Platz, aktiv oder geplant.
 */
export async function sendeBestaetigungErneut(
  admin: SupabaseClient,
  schuelerId: string
): Promise<{ ok: true; termine: number } | { error: string }> {
  const { data: pkg } = await admin
    .from("packages")
    .select("id")
    .eq("student_id", schuelerId)
    .eq("booking_mode", "fix")
    .in("status", ["active", "scheduled"])
    .order("erstellt_am", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pkg) return { error: "Kein Abo mit festem Platz gefunden." };
  const b = await ladeBestaetigung(admin, pkg.id);
  if (!b) return { error: "Zu diesem Abo liess sich keine Bestätigung aufbauen." };
  const ok = await sendeVertragsmail(admin, pkg.id, schuelerId);
  if (!ok) return { error: "Die Mail konnte nicht verschickt werden." };
  return { ok: true, termine: b.termine.length };
}

/**
 * Lücken in einer Fixplatz-Serie schliessen.
 *
 * Rechnet die Serie so, wie sie am Stichtag hätte gebucht werden sollen,
 * und bucht nach, was fehlt. Die vorhandenen Termine bleiben, wie sie sind.
 * Erinnerungen und Google-Sync laufen über denselben Weg wie beim ersten
 * Buchen, damit nachgebuchte Termine nicht anders aussehen als die anderen.
 *
 * Bleibt eine Lücke, weil noch etwas sperrt, wird nichts gebucht und der
 * Grund genannt. Halbe Reparaturen sind das Problem, nicht die Lösung.
 */
export async function fuelleSerieAuf(
  admin: SupabaseClient,
  runde: { id: string; startDatum: string | null },
  schuelerId: string
): Promise<
  | { ok: true; nachgebucht: number; zurueckgelegt: number; gesamt: number }
  | { error: string }
> {
  // Externe haben keine Serie im Abo-Sinn, sondern eine Vereinbarung. Die
  // wird komplett neu gelegt: künftige Termine weg, dann frisch nach der
  // Zuteilung. Keine Mail, Externe bekommen nie eine.
  const { data: profil } = await admin
    .from("profiles")
    .select("extern")
    .eq("id", schuelerId)
    .maybeSingle();
  if (profil?.extern) {
    const eintraege = await ladeEintraege(admin, runde.id);
    const z = eintraege.find((e) => e.schuelerId === schuelerId);
    if (!z) return { error: "Dieser Schüler steht nicht in der Zuteilung." };
    const r = await setzeExternenTermin(admin, {
      studentId: schuelerId,
      wochentag: z.wochentag,
      beginn: z.beginn,
      paritaet: z.paritaet,
      abDatum: runde.startDatum ?? heuteZuerich(),
    });
    if ("error" in r) return { error: r.error };
    return { ok: true, nachgebucht: r.termine, zurueckgelegt: 0, gesamt: r.termine };
  }

  const { data: pkg } = await admin
    .from("packages")
    .select(
      "id, rhythmus, fixplatz_weekday, fixplatz_time, fixplatz_week_parity, abo_lektionen, lessons_total, periode_start, starts_at"
    )
    .eq("student_id", schuelerId)
    .eq("booking_mode", "fix")
    .in("status", ["active", "scheduled"])
    .order("erstellt_am", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pkg || pkg.fixplatz_weekday == null || !pkg.fixplatz_time) {
    return { error: "Kein Abo mit festem Platz gefunden." };
  }

  const { data: vorhandene } = await admin
    .from("appointments")
    .select("id, start_at, series_id, notes, status")
    .eq("package_id", pkg.id)
    .in("status", ["booked", "completed"]);
  const seriesId =
    (vorhandene ?? []).find((t) => t.series_id)?.series_id ?? crypto.randomUUID();

  const lessons = Number(pkg.abo_lektionen ?? pkg.lessons_total ?? 0);
  const rhythmus = (pkg.rhythmus ?? (pkg.fixplatz_week_parity === null ? "woechentlich" : "zweiwoechentlich")) as
    | "woechentlich"
    | "zweiwoechentlich";
  const start = String(pkg.periode_start ?? String(pkg.starts_at).slice(0, 10));

  const plan = await planeFixplatzSerie(admin, {
    studentId: schuelerId,
    wunsch: {
      weekday: Number(pkg.fixplatz_weekday),
      time: String(pkg.fixplatz_time).slice(0, 5),
      rhythmus,
      lessons,
    },
    parity: (pkg.fixplatz_week_parity ?? null) as 0 | 1 | null,
    now: serienStart(start),
    ohneTermine: (vorhandene ?? []).map((t) => t.id as string),
  });
  if ("error" in plan) return { error: plan.error };
  if (plan.offen.length > 0) {
    const grund = await erklaereBlockade(admin, plan.offen);
    return {
      error: `${plan.offen.length} Termine haben noch keinen Platz. ${
        grund ?? "Belegt oder gesperrt."
      } Betroffen: ${plan.offen.map((d) => d.toISOString().slice(0, 10)).join(", ")}. Nichts gebucht.`,
    };
  }

  // ── Ausweichtermine, die keiner mehr braucht ─────────────
  //
  // Ein Ausweichtermin trägt in der Notiz, wofür er steht. Ist der
  // ursprüngliche Termin inzwischen frei (Zeitblock gelöscht, Abwesenheit
  // weg), gehört die Lektion dorthin zurück, und der Ausweichtermin fällt.
  // Nur solche Termine werden angefasst: Was ein Schüler selbst verschoben
  // hat, trägt diese Notiz nicht und bleibt.
  //
  // Daniels 14.9. war durch „START STUDIUM" gesperrt und wich auf den 21.9.
  // aus. Nach dem Löschen des Blocks muss er zurück auf den 14.9.
  const sollZeiten = new Set(plan.zuBuchen.map((t) => t.start.getTime()));
  const jetzt = Date.now();
  const ueberfluessig = (vorhandene ?? []).filter(
    (t) =>
      t.status === "booked" &&
      new Date(t.start_at).getTime() > jetzt &&
      String(t.notes ?? "").startsWith("Ausweichtermin für ") &&
      !sollZeiten.has(new Date(t.start_at).getTime())
  );
  for (const t of ueberfluessig) {
    await admin.from("appointments").update({ status: "cancelled" }).eq("id", t.id);
    await cancelLessonReminders(admin, t.id);
    await syncAppointmentToCalendar(admin, t.id);
  }

  const belegt = new Set(
    (vorhandene ?? [])
      .filter((t) => !ueberfluessig.some((u) => u.id === t.id))
      .map((t) => new Date(t.start_at).getTime())
  );

  const neue = plan.zuBuchen.filter((t) => !belegt.has(t.start.getTime()));
  if (neue.length === 0) {
    return { ok: true, nachgebucht: 0, zurueckgelegt: ueberfluessig.length, gesamt: belegt.size };
  }
  if (belegt.size + neue.length > lessons) {
    return {
      error: `Das ergäbe ${belegt.size + neue.length} Termine bei ${lessons} Lektionen. Bitte zuerst im Kalender nachsehen.`,
    };
  }

  const { data: created, error } = await admin
    .from("appointments")
    .insert(
      neue.map((t) => ({
        student_id: schuelerId,
        package_id: pkg.id,
        start_at: t.start.toISOString(),
        end_at: new Date(t.start.getTime() + LESSON_DURATION_MIN * 60000).toISOString(),
        status: "booked",
        source: "direct",
        series_id: seriesId,
        is_fixplatz: true,
        notes: t.original ? `Ausweichtermin für ${t.original.toISOString().slice(0, 10)}` : null,
      }))
    )
    .select("id, start_at");
  if (error || !created) return { error: "Die Termine konnten nicht angelegt werden." };

  for (const c of created) {
    await scheduleLessonReminders(admin, { id: c.id, student_id: schuelerId, start_at: c.start_at });
  }
  for (const c of created) {
    await syncAppointmentToCalendar(admin, c.id);
  }

  return {
    ok: true,
    nachgebucht: created.length,
    zurueckgelegt: ueberfluessig.length,
    gesamt: belegt.size + created.length,
  };
}

/**
 * Einen Schüler freigeben: genau das tun, was für ihn richtig ist.
 *
 * Gibt zurück, was passiert ist, damit die Oberfläche es sagen kann. Ein
 * stiller Erfolg wäre hier gefährlich: David muss wissen, ob eine Mail
 * rausging.
 */
export async function gebeFrei(
  admin: SupabaseClient,
  runde: { id: string; art: string; startDatum: string | null },
  schuelerId: string
): Promise<
  | { ok: true; art: FreigabeArt; mailVerschickt: boolean; hinweis?: string }
  | { error: string }
> {
  const eintraege = await ladeEintraege(admin, runde.id);
  const z = eintraege.find((e) => e.schuelerId === schuelerId);
  if (!z) return { error: "Dieser Schüler steht nicht in der Zuteilung." };
  if (z.status === "freigegeben") {
    return { error: "Schon freigegeben." };
  }

  const arten = await bestimmeFreigabeArten(admin, runde.id, runde.art, [
    schuelerId,
  ]);
  const art = arten[schuelerId];

  // ── Ohne Abo: nur reservieren ────────────────────────────
  if (art === "ohne_abo") {
    await setzeStatus(admin, runde.id, schuelerId, "reserviert");
    return {
      ok: true,
      art,
      mailVerschickt: false,
      hinweis:
        "Platz reserviert. Kein Abo, keine Termine, keine Mail. Sobald ein Abo da ist, nochmal freigeben.",
    };
  }

  // ── Extern: Vereinbarung, Serie, keine Mail ──────────────
  if (art === "extern") {
    const ab = runde.startDatum ?? heuteZuerich();
    const ergebnis = await setzeExternenTermin(admin, {
      studentId: schuelerId,
      wochentag: z.wochentag,
      beginn: z.beginn,
      paritaet: z.paritaet,
      abDatum: ab,
    });
    if ("error" in ergebnis) return { error: ergebnis.error };
    await setzeStatus(admin, runde.id, schuelerId, "freigegeben");
    return {
      ok: true,
      art,
      mailVerschickt: false,
      hinweis: "Termine eingetragen. Externe bekommen keine Mail.",
    };
  }

  // ── Umstellung: Abo, Serie, Vertragsmail ─────────────────
  if (art === "umstellung") {
    if (!runde.startDatum) return { error: "Der Runde fehlt das Startdatum." };
    let mail = false;
    const ergebnis = await wendeUmstellungAn(admin, {
      rundeId: runde.id,
      startDatum: runde.startDatum,
      zuteilungen: [z],
      autoRenew: true,
      beiErfolg: async (packageId, studentId) => {
        mail = await sendeVertragsmail(admin, packageId, studentId);
      },
    });
    if (ergebnis.uebersprungen.length > 0) {
      return { error: ergebnis.uebersprungen[0].grund };
    }
    await setzeStatus(admin, runde.id, schuelerId, "freigegeben");
    const fehlend = ergebnis.unvollstaendig[0];
    return {
      ok: true,
      art,
      mailVerschickt: mail,
      hinweis: fehlend
        ? `Nur ${fehlend.gebucht} von ${fehlend.zugesichert} Terminen gebucht. Fehlend: ${fehlend.fehlend.join(", ")}`
        : undefined,
    };
  }

  // ── Bestehendes Abo: Fixplatz, Serie, Mail ───────────────
  const { data: pkg } = await admin
    .from("packages")
    .select("id, rhythmus, abo_lektionen, lessons_total, periode_start, starts_at")
    .eq("student_id", schuelerId)
    .eq("status", "active")
    .maybeSingle();
  if (!pkg) return { error: "Kein aktives Abo gefunden." };

  // Die Serie beginnt frühestens mit dem Abo. Emilie, 18. September 2026:
  // Abo von Hand angelegt ab 1. Oktober, zwei Minuten später freigegeben,
  // und die Serie fing am 21. September an, weil sie von „heute" aus
  // gerechnet wurde. Ein Termin vor dem Abo gehört zu keinem Abo.
  const aboStart = String(pkg.periode_start ?? String(pkg.starts_at ?? "").slice(0, 10));
  const serieAb = new Date(
    Math.max(Date.now(), aboStart ? serienStart(aboStart).getTime() : 0)
  );

  const rhythmus = z.paritaet === null ? "woechentlich" : "zweiwoechentlich";
  const wunsch = {
    weekday: z.wochentag,
    time: z.beginn,
    rhythmus,
    lessons: Number(pkg.abo_lektionen ?? pkg.lessons_total ?? 0),
  } as const;

  // Vorprüfung wie beim neuen Abo: Erst wenn alle Termine Platz haben,
  // wird die alte Serie abgesagt und die Mail verschickt. Die eigenen
  // künftigen Fixplatz-Termine zählen dabei nicht als belegt.
  const { data: eigene } = await admin
    .from("appointments")
    .select("id")
    .eq("package_id", pkg.id)
    .eq("is_fixplatz", true)
    .eq("status", "booked")
    .gt("start_at", new Date().toISOString());
  const probe = await planeFixplatzSerie(admin, {
    studentId: schuelerId,
    wunsch,
    parity: z.paritaet,
    now: serieAb,
    ohneTermine: (eigene ?? []).map((t) => t.id as string),
  });
  if ("error" in probe) return { error: probe.error };
  if (probe.offen.length > 0) {
    const grund = await erklaereBlockade(admin, probe.offen);
    return {
      error: `Nur ${probe.zuBuchen.length} von ${wunsch.lessons} Terminen haben Platz. ${
        grund ?? "Die übrigen sind belegt oder gesperrt."
      } Betroffen: ${probe.offen.map((d) => d.toISOString().slice(0, 10)).join(", ")}. Nichts geändert, keine Mail.`,
    };
  }

  await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("package_id", pkg.id)
    .eq("is_fixplatz", true)
    .eq("status", "booked")
    .gt("start_at", new Date().toISOString());

  await admin
    .from("packages")
    .update({
      booking_mode: "fix",
      fixplatz_weekday: z.wochentag,
      fixplatz_time: z.beginn,
      fixplatz_week_parity: z.paritaet,
      rhythmus,
    })
    .eq("id", pkg.id);

  const serie = await bookFixplatzSeries(admin, {
    studentId: schuelerId,
    packageId: pkg.id,
    wunsch,
    parity: z.paritaet,
    now: serieAb,
  });
  if ("error" in serie) return { error: serie.error };

  await sendEmailNow(admin, "verfuegbarkeit_zuteilung", {
    student_id: schuelerId,
    student_name: z.name,
    fixplatz_text: describeFixplatz(z.wochentag, z.beginn, rhythmus, z.paritaet),
    anzahl_termine: serie.appointmentIds.length,
    wunsch_erfuellt: z.praeferenz >= 3,
  });

  await setzeStatus(admin, runde.id, schuelerId, "freigegeben");
  return { ok: true, art, mailVerschickt: true };
}

async function setzeStatus(
  admin: SupabaseClient,
  rundeId: string,
  schuelerId: string,
  status: ZuteilungEintrag["status"]
): Promise<void> {
  const eintraege = await ladeEintraege(admin, rundeId);
  await speichereEintraege(
    admin,
    rundeId,
    eintraege.map((z) =>
      z.schuelerId === schuelerId
        ? {
            ...z,
            status,
            freigegebenAm:
              status === "freigegeben" ? new Date().toISOString() : z.freigegebenAm,
          }
        : z
    )
  );
}

function heuteZuerich(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
}

/**
 * Reservierte und freigegebene Plätze, damit der Routenplaner sie
 * festhält statt neu zu vergeben.
 *
 * Ein reservierter Platz ist genau dafür da: Er soll nicht an jemand anderen
 * gehen, während die Probelektion noch aussteht. Der Planer erfährt das,
 * indem der Schüler nur noch genau dieses eine Fenster „kann".
 */
export async function ladeFestgehaltene(
  admin: SupabaseClient
): Promise<Map<string, { wochentag: number; beginn: string; paritaet: 0 | 1 | null }>> {
  const { data } = await admin
    .from("planungsrunden")
    .select("plan")
    .eq("status", "offen")
    .is("nur_student_id", null)
    .order("erstellt_am", { ascending: false })
    .limit(1)
    .maybeSingle();

  const raus = new Map<string, { wochentag: number; beginn: string; paritaet: 0 | 1 | null }>();
  const plan = data?.plan as { zuteilungen?: Zuteilung[] } | null;
  for (const z of (plan?.zuteilungen ?? []).map(normalisiere)) {
    if (z.status === "reserviert" || z.status === "freigegeben") {
      raus.set(z.schuelerId, {
        wochentag: z.wochentag,
        beginn: z.beginn,
        paritaet: z.paritaet,
      });
    }
  }
  return raus;
}
