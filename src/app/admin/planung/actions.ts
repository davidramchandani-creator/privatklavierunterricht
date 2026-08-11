"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendEmailNow } from "@/lib/emails-outbox";
import { todayInZurich } from "@/lib/subscription";
import { describeFixplatz } from "@/lib/fixplatz";
import { bookFixplatzSeries } from "@/lib/fixplatz-server";
import {
  findeEinpassungFuer,
  ladeAntwortStand,
  ladeOffeneEinzelanfrage,
  ladeOffeneRunde,
  rechneZuteilung,
  type AntwortStand,
  type EinpassKontext,
  type Runde,
  type ZuteilKontext,
} from "@/lib/planung-server";
import { beschreibeZuteilung, type Zuteilung } from "@/lib/zuteilung";
import type { Rhythmus } from "@/lib/rhythmus";

async function assertAdmin(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profil?.role !== "admin") return { error: "Keine Berechtigung." };
  return null;
}

/**
 * Neue Planungsrunde starten und alle aktiven Schüler anschreiben.
 *
 * Eine offene Runde zur Zeit: zwei parallele Abfragen würden die Schüler
 * verwirren und die Antworten wären nicht mehr zuzuordnen.
 */
export async function rundeStarten(
  formData: FormData
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const titel = String(formData.get("titel") ?? "").trim();
  const frist = String(formData.get("frist") ?? "");
  const periodeStart = String(formData.get("periode_start") ?? "") || null;

  if (!titel) return { error: "Bitte einen Titel angeben." };
  if (!frist) return { error: "Bitte eine Frist angeben." };
  if (frist <= todayInZurich()) {
    return { error: "Die Frist muss in der Zukunft liegen." };
  }

  const admin = await createAdminClient();

  const offen = await ladeOffeneRunde(admin);
  if (offen) {
    return {
      error: `Es läuft bereits die Runde „${offen.titel}". Bitte zuerst schliessen.`,
    };
  }

  const { data: runde, error } = await admin
    .from("planungsrunden")
    .insert({ titel, frist, periode_start: periodeStart, status: "offen" })
    .select("id")
    .single();

  if (error || !runde) return { error: "Die Runde konnte nicht angelegt werden." };

  const { data: schueler } = await admin
    .from("profiles")
    .select("id, vorname, nachname")
    .eq("role", "student")
    .eq("aktiv", true);

  for (const s of schueler ?? []) {
    await admin
      .from("planungs_antworten")
      .insert({ runde_id: runde.id, student_id: s.id });

    await sendEmailNow(admin, "verfuegbarkeit_anfrage", {
      student_id: s.id,
      student_name: `${s.vorname ?? ""} ${s.nachname ?? ""}`.trim() || undefined,
      titel,
      frist,
    });
  }

  revalidatePath("/admin/planung");
  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
}

/** An alle erinnern, die noch nicht geantwortet haben. */
export async function erinnern(
  rundeId: string
): Promise<{ erinnert: number; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: runde } = await admin
    .from("planungsrunden")
    .select("titel, frist")
    .eq("id", rundeId)
    .maybeSingle();
  if (!runde) return { error: "Runde nicht gefunden." };

  const stand = await ladeAntwortStand(admin, rundeId);
  const offen = stand.filter((s) => !s.geantwortet);

  for (const s of offen) {
    await sendEmailNow(admin, "verfuegbarkeit_erinnerung", {
      student_id: s.studentId,
      student_name: s.name,
      titel: runde.titel,
      frist: runde.frist,
    });
    await admin
      .from("planungs_antworten")
      .update({ erinnert_am: new Date().toISOString() })
      .eq("runde_id", rundeId)
      .eq("student_id", s.studentId);
  }

  revalidatePath("/admin/planung");
  return { erinnert: offen.length, error: undefined };
}

export type PlanungsAnsicht = {
  runde: Runde;
  stand: AntwortStand[];
  kontext: ZuteilKontext;
};

/** Zuteilung rechnen und mit dem Antwortstand zurückgeben. */
export async function zuteilungRechnen(
  rundeId: string,
  pufferMinuten: number
): Promise<PlanungsAnsicht | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: r } = await admin
    .from("planungsrunden")
    .select("id, titel, periode_start, frist, status, angewendet_am")
    .eq("id", rundeId)
    .maybeSingle();
  if (!r) return { error: "Runde nicht gefunden." };

  const [stand, kontext] = await Promise.all([
    ladeAntwortStand(admin, rundeId),
    rechneZuteilung(admin, rundeId, pufferMinuten),
  ]);

  // Plan an der Runde festhalten, damit er nach dem Neuladen noch da ist.
  await admin
    .from("planungsrunden")
    .update({ plan: kontext.ergebnis as unknown as Record<string, unknown> })
    .eq("id", rundeId);

  return {
    runde: {
      id: r.id as string,
      titel: r.titel as string,
      periodeStart: r.periode_start as string | null,
      frist: String(r.frist),
      status: r.status as string,
      angewendetAm: r.angewendet_am as string | null,
    },
    stand,
    kontext,
  };
}

/**
 * Zuteilung anwenden: Fixplätze setzen und Terminserien buchen.
 *
 * Nur für Schüler mit aktivem Abo — ohne Abo gibt es nichts zu buchen. Wer
 * seinen Platz behält, wird übersprungen: seine Serie steht bereits, und
 * sie neu zu buchen würde nur doppelte Termine erzeugen.
 */
export async function zuteilungAnwenden(
  rundeId: string
): Promise<
  | { success: true; error: undefined; gesetzt: number; uebersprungen: number }
  | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: runde } = await admin
    .from("planungsrunden")
    .select("id, titel, status, plan")
    .eq("id", rundeId)
    .maybeSingle();

  if (!runde) return { error: "Runde nicht gefunden." };
  if (runde.status === "angewendet") {
    return { error: "Diese Runde wurde bereits angewendet." };
  }
  if (!runde.plan) {
    return { error: "Für diese Runde liegt noch kein gerechneter Plan vor." };
  }

  const plan = runde.plan as unknown as { zuteilungen: Zuteilung[] };
  const zuteilungen = plan.zuteilungen ?? [];
  if (zuteilungen.length === 0) return { error: "Der Plan ist leer." };

  let gesetzt = 0;
  let uebersprungen = 0;

  for (const z of zuteilungen) {
    if (z.unveraendert) {
      uebersprungen++;
      continue;
    }

    const { data: pkg } = await admin
      .from("packages")
      .select("id, rhythmus, abo_lektionen, lessons_total, booking_mode")
      .eq("student_id", z.schuelerId)
      .eq("status", "active")
      .maybeSingle();

    if (!pkg) {
      uebersprungen++;
      continue;
    }

    const rhythmus: Rhythmus =
      pkg.rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich";

    // Bisherige, noch nicht gehaltene Fixplatz-Termine räumen – sonst stünden
    // alter und neuer Platz nebeneinander im Kalender.
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
      })
      .eq("id", pkg.id);

    const serie = await bookFixplatzSeries(admin, {
      studentId: z.schuelerId,
      packageId: pkg.id,
      wunsch: {
        weekday: z.wochentag,
        time: z.beginn,
        rhythmus,
        lessons: Number(pkg.abo_lektionen ?? pkg.lessons_total ?? 0),
      },
      parity: z.paritaet,
    });

    if ("error" in serie) {
      console.error("[planung] Serie:", z.schuelerId, serie.error);
      uebersprungen++;
      continue;
    }

    await sendEmailNow(admin, "verfuegbarkeit_zuteilung", {
      student_id: z.schuelerId,
      student_name: z.name,
      fixplatz_text: describeFixplatz(z.wochentag, z.beginn, rhythmus, z.paritaet),
      anzahl_termine: serie.appointmentIds.length,
      wunsch_erfuellt: z.praeferenz >= 3,
    });

    gesetzt++;
  }

  await admin
    .from("planungsrunden")
    .update({ status: "angewendet", angewendet_am: new Date().toISOString() })
    .eq("id", rundeId);

  revalidatePath("/admin/planung");
  revalidatePath("/admin/kalender");
  revalidatePath("/schueler/portal");
  return { success: true, error: undefined, gesetzt, uebersprungen };
}

/**
 * Wer wartet auf einen Termin?
 *
 * Schüler mit laufendem Abo und Fixplatz-Wunsch, aber ohne gesetzten Platz —
 * genau die, die mitten in der Periode eingepasst werden müssen.
 */
/**
 * Schüler für die Einpassen-Karte.
 *
 * Bewusst **alle** aktiven Schüler, nicht nur die ohne Platz. Wer schon einen
 * Termin hat, kann trotzdem umziehen, den Rhythmus wechseln oder seine Zeiten
 * ändern — dann muss er sich anschreiben lassen, ohne dass eine Runde läuft.
 * Wartende stehen oben, weil sie der dringende Fall sind.
 */
export async function wartendeSchueler(): Promise<{
  schueler: {
    id: string;
    name: string;
    hatZeiten: boolean;
    /** Aktives Abo, Fixplatz vereinbart, aber noch kein Termin gesetzt. */
    wartet: boolean;
    /** Bestehender Platz als Text, sonst null. */
    platz: string | null;
    /** Frist einer bereits laufenden Einzelanfrage, sonst null. */
    angefragtBis: string | null;
  }[];
}> {
  const verboten = await assertAdmin();
  if (verboten) return { schueler: [] };

  const admin = await createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, vorname, nachname")
    .eq("role", "student")
    .eq("aktiv", true);

  const ids = (profile ?? []).map((p) => p.id as string);
  if (ids.length === 0) return { schueler: [] };

  const [{ data: pakete }, { data: verf }, { data: anfragen }] =
    await Promise.all([
      admin
        .from("packages")
        .select(
          "student_id, booking_mode, fixplatz_weekday, fixplatz_time, fixplatz_week_parity, rhythmus"
        )
        .eq("status", "active")
        .in("student_id", ids),
      admin.from("student_verfuegbarkeit").select("student_id").in("student_id", ids),
      admin
        .from("planungsrunden")
        .select("nur_student_id, frist")
        .eq("status", "offen")
        .in("nur_student_id", ids),
    ]);

  const paket = new Map((pakete ?? []).map((p) => [p.student_id as string, p]));
  const mitZeiten = new Set((verf ?? []).map((v) => v.student_id as string));
  const angefragt = new Map(
    (anfragen ?? []).map((a) => [a.nur_student_id as string, String(a.frist)])
  );

  const liste = (profile ?? []).map((p) => {
    const id = p.id as string;
    const pk = paket.get(id);
    const hatPlatz = pk?.fixplatz_weekday != null && pk?.fixplatz_time != null;

    return {
      id,
      name: `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || "Ohne Namen",
      hatZeiten: mitZeiten.has(id),
      wartet: pk != null && pk.booking_mode === "fix" && !hatPlatz,
      platz: hatPlatz
        ? describeFixplatz(
            Number(pk!.fixplatz_weekday),
            String(pk!.fixplatz_time).slice(0, 5),
            (pk!.rhythmus === "zweiwoechentlich"
              ? "zweiwoechentlich"
              : "woechentlich") as Rhythmus,
            (pk!.fixplatz_week_parity as 0 | 1 | null) ?? null
          )
        : null,
      angefragtBis: angefragt.get(id) ?? null,
    };
  });

  // Wartende zuoberst, danach alphabetisch – die Liste wird sonst mit jedem
  // Schüler unübersichtlicher.
  liste.sort((a, b) => {
    if (a.wartet !== b.wartet) return a.wartet ? -1 : 1;
    return a.name.localeCompare(b.name, "de");
  });

  return { schueler: liste };
}

/** Beste Plätze für einen einzelnen Schüler im laufenden Plan. */
/**
 * Einen einzelnen Schüler nach seinen Zeiten fragen.
 *
 * Der Fall zwischen zwei Runden: Jemand schliesst im November ab, die nächste
 * Runde ist im Februar. Ihn bis dahin warten zu lassen wäre falsch — er zahlt
 * bereits ab Periodenbeginn.
 *
 * Umgesetzt als Runde mit genau einem Adressaten: dasselbe Formular im
 * Portal, dieselbe Speicherung, dieselbe Rechnung. Nur bekommt niemand sonst
 * eine Mail, und die allgemeine Runde bleibt davon unberührt.
 */
export async function zeitenAnfragen(
  studentId: string,
  fristTage = 7
): Promise<
  { success: true; error: undefined; frist: string } | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  if (!studentId) return { error: "Kein Schüler gewählt." };

  const admin = await createAdminClient();

  const { data: prof } = await admin
    .from("profiles")
    .select("vorname, nachname")
    .eq("id", studentId)
    .maybeSingle();
  if (!prof) return { error: "Schüler nicht gefunden." };

  const name =
    `${prof.vorname ?? ""} ${prof.nachname ?? ""}`.trim() || "Schüler";

  // Läuft schon eine Anfrage, wird nicht eine zweite angelegt, sondern nur
  // noch einmal angeschrieben. Sonst sammeln sich Karteileichen an, und der
  // Schüler bekommt zwei Mails zur selben Sache.
  const bestehend = await ladeOffeneEinzelanfrage(admin, studentId);
  if (bestehend) {
    // Bewusst dieselbe Mail noch einmal statt einer Erinnerungsvorlage: die
    // Erinnerung spricht von einer laufenden Planung für alle, und das
    // stimmt hier nicht.
    await sendEmailNow(admin, "verfuegbarkeit_einzelanfrage", {
      student_id: studentId,
      student_name: name,
      frist: bestehend.frist,
    });
    return { success: true, error: undefined, frist: bestehend.frist };
  }

  const frist = new Date();
  frist.setDate(frist.getDate() + fristTage);
  const fristIso = frist.toISOString().slice(0, 10);

  const { error } = await admin.from("planungsrunden").insert({
    titel: "Dein fester Termin",
    frist: fristIso,
    status: "offen",
    nur_student_id: studentId,
  });
  if (error) return { error: "Die Anfrage konnte nicht angelegt werden." };

  await sendEmailNow(admin, "verfuegbarkeit_einzelanfrage", {
    student_id: studentId,
    student_name: name,
    frist: fristIso,
  });

  revalidatePath("/admin/planung");
  revalidatePath("/schueler/portal");
  return { success: true, error: undefined, frist: fristIso };
}

export async function einpassungSuchen(
  studentId: string,
  pufferMinuten: number
): Promise<EinpassKontext | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  if (!studentId) return { error: "Kein Schüler gewählt." };

  const admin = await createAdminClient();
  return findeEinpassungFuer(admin, studentId, pufferMinuten);
}

/**
 * Einen einzelnen Schüler auf einen Platz setzen.
 *
 * Der laufende Plan bleibt unangetastet — es wird nur dieser eine Termin
 * gesetzt und seine Serie gebucht.
 */
export async function einzelnEinpassen(params: {
  studentId: string;
  wochentag: number;
  beginn: string;
  paritaet: 0 | 1 | null;
}): Promise<
  { success: true; error: undefined; termine: number } | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: pkg } = await admin
    .from("packages")
    .select("id, rhythmus, abo_lektionen, lessons_total, lessons_used")
    .eq("student_id", params.studentId)
    .eq("status", "active")
    .maybeSingle();

  if (!pkg) return { error: "Dieser Schüler hat kein aktives Abo." };

  const rhythmus: Rhythmus =
    pkg.rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich";

  // Nur die noch offenen Lektionen buchen. Wer mitten in der Periode
  // einsteigt, bekommt nicht rückwirkend die ganze Serie.
  const gesamt = Number(pkg.abo_lektionen ?? pkg.lessons_total ?? 0);
  const offen = Math.max(1, gesamt - Number(pkg.lessons_used ?? 0));

  // Bestehende, noch nicht gehaltene Fixplatz-Termine räumen.
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
      fixplatz_weekday: params.wochentag,
      fixplatz_time: params.beginn,
      fixplatz_week_parity: params.paritaet,
    })
    .eq("id", pkg.id);

  const serie = await bookFixplatzSeries(admin, {
    studentId: params.studentId,
    packageId: pkg.id,
    wunsch: {
      weekday: params.wochentag,
      time: params.beginn,
      rhythmus,
      lessons: offen,
    },
    parity: params.paritaet,
  });

  if ("error" in serie) return { error: serie.error };

  const { data: prof } = await admin
    .from("profiles")
    .select("vorname, nachname")
    .eq("id", params.studentId)
    .maybeSingle();

  await sendEmailNow(admin, "verfuegbarkeit_zuteilung", {
    student_id: params.studentId,
    student_name: `${prof?.vorname ?? ""} ${prof?.nachname ?? ""}`.trim() || undefined,
    fixplatz_text: describeFixplatz(
      params.wochentag,
      params.beginn,
      rhythmus,
      params.paritaet
    ),
    anzahl_termine: serie.appointmentIds.length,
    wunsch_erfuellt: true,
  });

  // Die Einzelanfrage hat ihren Zweck erfüllt – sonst stünde sie dem Schüler
  // weiter im Portal und würde ihn zum Nachtragen auffordern.
  await admin
    .from("planungsrunden")
    .update({ status: "angewendet", angewendet_am: new Date().toISOString() })
    .eq("nur_student_id", params.studentId)
    .eq("status", "offen");

  revalidatePath("/admin/planung");
  revalidatePath("/admin/kalender");
  revalidatePath("/schueler/portal");
  return { success: true, error: undefined, termine: serie.appointmentIds.length };
}

/** Runde schliessen, ohne sie anzuwenden. */
export async function rundeSchliessen(
  rundeId: string
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  await admin
    .from("planungsrunden")
    .update({ status: "geschlossen" })
    .eq("id", rundeId);

  revalidatePath("/admin/planung");
  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
}

export { beschreibeZuteilung };
