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
import { wendeUmstellungAn, ladeBestaetigung } from "./umstellung-server";
import { setzeExternenTermin } from "./externe-server";
import {
  bookFixplatzSeries,
  erklaereBlockade,
  planeFixplatzSerie,
} from "./fixplatz-server";
import { describeFixplatz } from "./fixplatz";
import { sendEmailNow } from "./emails-outbox";
import { BASIS_URL } from "./seo";
import { DEFAULT_BUFFER_MIN } from "./booking";

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
    .select("id, rhythmus, abo_lektionen, lessons_total")
    .eq("student_id", schuelerId)
    .eq("status", "active")
    .maybeSingle();
  if (!pkg) return { error: "Kein aktives Abo gefunden." };

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
