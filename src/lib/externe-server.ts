// ============================================================
// Externe Schüler: anlegen, Serie buchen, nachwachsen lassen
//
// Unterricht über eine andere Plattform. David fährt hin, der Termin belegt
// seinen Abend und seine Route — abgerechnet wird dort.
//
// ── Was hier anders läuft als beim Abo ──────────────────────
//
// Kein Paket, keine Rechnung, keine Rate, keine Mail. Die Termine hängen
// deshalb an keiner `package_id`, sondern an einer `externe_vereinbarung_id`.
// Alle Abrechnungswege prüfen das Paket des Termins und überspringen ihn
// dadurch von selbst — ohne dass an einem Dutzend Stellen „ausser bei
// externen" stehen müsste.
//
// ── Und was gleich läuft ────────────────────────────────────
//
// Alles, was mit Zeit und Weg zu tun hat. Der Termin steht im Kalender,
// blockiert den Slot, geht in den Google-Sync und zählt im Routenplaner.
// Genau dafür sind sie hier drin.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { LESSON_DURATION_MIN } from "./booking";
import { fixplatzSeriesStarts, type Ferienzeitraum } from "./fixplatz";
import { syncAppointmentToCalendar } from "./google-calendar";
import type { Rhythmus } from "./rhythmus";
import { todayInZurich } from "./subscription";

/**
 * Wie weit im Voraus unbefristete Vereinbarungen gebucht werden.
 *
 * Ein halbes Jahr: weit genug, dass der Kalender vollständig aussieht und
 * die Routenplanung etwas zu rechnen hat, kurz genug, dass ein Wechsel des
 * Wochentags nicht hundert Termine umwirft.
 */
export const VORLAUF_TAGE = 182;

/**
 * Wann nachgelegt wird.
 *
 * Nicht erst, wenn der letzte Termin erreicht ist — dann stünde der
 * Kalender wochenlang halb leer und die Routenplanung rechnete mit zu
 * wenigen Schülern. Sobald weniger als zwei Monate Vorlauf bleiben, wird
 * wieder auf ein halbes Jahr aufgefüllt.
 */
export const NACHLEGEN_AB_TAGE = 60;

export type ExterneVereinbarung = {
  id: string;
  student_id: string;
  rhythmus: Rhythmus;
  wochentag: number;
  zeit: string;
  lektion_minuten: number;
  woche_paritaet: 0 | 1 | null;
  start_datum: string;
  anzahl: number | null;
  aktiv: boolean;
};

async function ladeFerien(
  admin: SupabaseClient,
  abDatum: string
): Promise<Ferienzeitraum[]> {
  const { data } = await admin
    .from("schulferien")
    .select("start_datum, end_datum")
    .gte("end_datum", abDatum);

  return (data ?? []).map((f) => ({
    start: String(f.start_datum),
    ende: String(f.end_datum),
  }));
}

/**
 * Alle Termine einer Vereinbarung ab einem Datum, als UTC-Zeitpunkte.
 *
 * Ferien werden übersprungen, genau wie bei den eigenen Abos: Wer über eine
 * andere Plattform kommt, hat in den Schulferien auch keinen Unterricht,
 * und ein Termin am 24. Dezember wäre in beiden Systemen falsch.
 */
function termineDerVereinbarung(
  v: ExterneVereinbarung,
  ab: Date,
  anzahl: number,
  ferien: Ferienzeitraum[]
): Date[] {
  return fixplatzSeriesStarts(
    {
      weekday: v.wochentag,
      time: v.zeit.slice(0, 5),
      rhythmus: v.rhythmus,
      lessons: anzahl,
    },
    ab,
    ferien
  );
}

/**
 * Ersten Termin einer Vereinbarung finden: der erste passende Wochentag ab
 * dem Startdatum, in der richtigen Kalenderwoche.
 *
 * Bewusst ohne die 24-Stunden-Regel aus `firstSeriesStart`. Die schützt
 * Schüler davor, dass ihnen ein Termin für morgen früh untergeschoben wird.
 * Hier trägt David nur nach, was anderswo längst vereinbart ist — und das
 * kann durchaus heute Abend sein.
 */
function ersterTermin(v: ExterneVereinbarung, ab: string): Date {
  const [hh, mm] = v.zeit.slice(0, 5).split(":").map(Number);
  const start = new Date(`${ab}T00:00:00.000Z`);

  for (let i = 0; i <= 28; i++) {
    const tag = new Date(start.getTime() + i * 86400000);
    if (tag.getUTCDay() !== v.wochentag) continue;

    if (v.woche_paritaet != null) {
      // Dieselbe Wochenzählung wie im Fixplatz-Modell: Wochen seit dem
      // Nullpunkt, gerade oder ungerade.
      const kw = Math.floor(tag.getTime() / (7 * 86400000)) % 2;
      if (kw !== v.woche_paritaet) continue;
    }

    return new Date(
      Date.UTC(
        tag.getUTCFullYear(),
        tag.getUTCMonth(),
        tag.getUTCDate(),
        hh,
        mm
      )
    );
  }

  throw new Error("Kein passender Starttermin gefunden.");
}

/**
 * Legt die Termine einer Vereinbarung an.
 *
 * Anders als beim Abo wird **nicht** auf Kollisionen geprüft und es gibt
 * keine Ausweichtermine. Der Grund: Was hier eingetragen wird, ist bereits
 * abgemacht — die andere Plattform hat den Termin vergeben, David kann ihn
 * nicht verschieben, nur abbilden. Eine Kollision ist deshalb kein Grund,
 * den Termin wegzulassen, sondern ein Hinweis an David, dass er zwei
 * Verpflichtungen zur selben Zeit hat. Genau das meldet die Rückgabe.
 */
export async function legeExterneTermineAn(
  admin: SupabaseClient,
  v: ExterneVereinbarung,
  params: { ab?: string; anzahl?: number } = {}
): Promise<{ angelegt: number; kollisionen: string[] }> {
  const ab = params.ab ?? v.start_datum;
  const ferien = await ladeFerien(admin, ab);

  let start: Date;
  try {
    start = ersterTermin(v, ab);
  } catch {
    return { angelegt: 0, kollisionen: [] };
  }

  // Wie viele: bei fester Anzahl der Rest, bei unbefristet so viele, wie in
  // den Vorlauf passen.
  const proJahr = v.rhythmus === "zweiwoechentlich" ? 26 : 52;
  const anzahl =
    params.anzahl ??
    v.anzahl ??
    Math.max(1, Math.ceil((VORLAUF_TAGE / 365) * proJahr));

  const starts = termineDerVereinbarung(v, start, anzahl, ferien);
  if (starts.length === 0) return { angelegt: 0, kollisionen: [] };

  // Schon vorhandene Termine dieser Vereinbarung nicht doppelt anlegen.
  // Das macht die Funktion wiederholbar — der Cron ruft sie regelmässig auf.
  const { data: bestehend } = await admin
    .from("appointments")
    .select("start_at")
    .eq("externe_vereinbarung_id", v.id)
    .neq("status", "cancelled");

  const schonDa = new Set(
    (bestehend ?? []).map((a) => new Date(a.start_at as string).getTime())
  );
  const neue = starts.filter((s) => !schonDa.has(s.getTime()));
  if (neue.length === 0) return { angelegt: 0, kollisionen: [] };

  // Kollisionen melden, nicht verhindern: siehe oben.
  const von = neue[0].toISOString();
  const bis = new Date(
    neue[neue.length - 1].getTime() + v.lektion_minuten * 60000
  ).toISOString();

  const { data: fremde } = await admin
    .from("appointments")
    .select("start_at, end_at, student_id")
    .in("status", ["booked", "pending"])
    .neq("student_id", v.student_id)
    .gte("start_at", von)
    .lte("start_at", bis);

  const kollisionen: string[] = [];
  for (const t of neue) {
    const ende = t.getTime() + v.lektion_minuten * 60000;
    const treffer = (fremde ?? []).some((f) => {
      const fs = new Date(f.start_at as string).getTime();
      const fe = new Date(f.end_at as string).getTime();
      return t.getTime() < fe && fs < ende;
    });
    if (treffer) kollisionen.push(t.toISOString());
  }

  const seriesId = crypto.randomUUID();
  const { data: created, error } = await admin
    .from("appointments")
    .insert(
      neue.map((s) => ({
        student_id: v.student_id,
        package_id: null,
        externe_vereinbarung_id: v.id,
        start_at: s.toISOString(),
        end_at: new Date(s.getTime() + v.lektion_minuten * 60000).toISOString(),
        status: "booked",
        source: "direct",
        series_id: seriesId,
        is_fixplatz: true,
      }))
    )
    .select("id");

  if (error || !created) return { angelegt: 0, kollisionen };

  // In den Google-Kalender, damit David sie auf dem Handy sieht. Keine
  // Erinnerungsmails: Der Schüler hat hier kein Konto und keine Adresse.
  for (const c of created) {
    await syncAppointmentToCalendar(admin, c.id);
  }

  return { angelegt: created.length, kollisionen };
}

/**
 * Hält unbefristete Vereinbarungen im Kalender.
 *
 * Läuft im Cron. Sobald bei einer Vereinbarung weniger als zwei Monate
 * Vorlauf übrig sind, wird wieder auf ein halbes Jahr aufgefüllt.
 *
 * Ohne diesen Schritt liefe die Serie irgendwann einfach aus, und zwar
 * unauffällig: Der Schüler verschwände aus Kalender und Routenplanung,
 * während der Unterricht in Wirklichkeit weitergeht.
 */
export async function verlaengereExterneSerien(
  admin: SupabaseClient
): Promise<{ verlaengert: number; termine: number }> {
  const heute = todayInZurich();
  const grenze = new Date(
    Date.parse(`${heute}T00:00:00.000Z`) + NACHLEGEN_AB_TAGE * 86400000
  ).toISOString();

  const { data: offene } = await admin
    .from("externe_vereinbarungen")
    .select("*")
    .eq("aktiv", true)
    .is("anzahl", null);

  let verlaengert = 0;
  let termine = 0;

  for (const roh of offene ?? []) {
    const v = roh as unknown as ExterneVereinbarung;

    // Nur nachlegen, wenn der Schüler noch aktiv ist. Wer aufgehört hat,
    // soll nicht durch den Cron wieder im Kalender auftauchen.
    const { data: profil } = await admin
      .from("profiles")
      .select("aktiv")
      .eq("id", v.student_id)
      .maybeSingle();
    if (profil?.aktiv !== true) continue;

    const { data: letzter } = await admin
      .from("appointments")
      .select("start_at")
      .eq("externe_vereinbarung_id", v.id)
      .neq("status", "cancelled")
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Reicht der Vorlauf noch? Dann nichts tun.
    if (letzter?.start_at && String(letzter.start_at) > grenze) continue;

    const ab = letzter?.start_at
      ? new Date(
          new Date(letzter.start_at as string).getTime() + 86400000
        )
          .toISOString()
          .slice(0, 10)
      : heute;

    const ergebnis = await legeExterneTermineAn(admin, v, { ab });
    if (ergebnis.angelegt > 0) {
      verlaengert++;
      termine += ergebnis.angelegt;
    }
  }

  return { verlaengert, termine };
}

/**
 * Trägt den zugeteilten Termin in die Vereinbarung ein und bucht die Serie.
 *
 * Der Gegenpart zum Abo-Anlegen: Ein externer Schüler nimmt an der Zuteilung
 * teil wie jeder andere, bekommt am Ende aber kein Abo, sondern seinen
 * Termin — keine Rechnung, keine Raten, keine Post, nur der Kalender.
 *
 * Vorhandene künftige Termine werden vorher abgesagt. Sonst stünden nach
 * einer zweiten Zuteilung alter und neuer Platz nebeneinander.
 */
export async function setzeExternenTermin(
  admin: SupabaseClient,
  params: {
    studentId: string;
    wochentag: number;
    beginn: string;
    paritaet: 0 | 1 | null;
    abDatum: string;
  }
): Promise<{ termine: number } | { error: string }> {
  const { data: vereinbarung } = await admin
    .from("externe_vereinbarungen")
    .select("*")
    .eq("student_id", params.studentId)
    .eq("aktiv", true)
    .maybeSingle();

  if (!vereinbarung) {
    return { error: "Keine aktive Vereinbarung gefunden." };
  }

  await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("externe_vereinbarung_id", vereinbarung.id)
    .eq("status", "booked")
    .gte("start_at", `${params.abDatum}T00:00:00.000Z`);

  const { error } = await admin
    .from("externe_vereinbarungen")
    .update({
      wochentag: params.wochentag,
      zeit: params.beginn,
      woche_paritaet: params.paritaet,
      // Ab hier läuft es: Ein Startdatum in der Vergangenheit würde die
      // Serie rückwirkend beginnen lassen.
      start_datum:
        String(vereinbarung.start_datum) > params.abDatum
          ? vereinbarung.start_datum
          : params.abDatum,
      aktualisiert_am: new Date().toISOString(),
    })
    .eq("id", vereinbarung.id);

  if (error) return { error: "Der Termin liess sich nicht speichern." };

  const { data: frisch } = await admin
    .from("externe_vereinbarungen")
    .select("*")
    .eq("id", vereinbarung.id)
    .single();

  const ergebnis = await legeExterneTermineAn(
    admin,
    frisch as unknown as ExterneVereinbarung
  );
  return { termine: ergebnis.angelegt };
}

/**
 * Beendet eine Vereinbarung: künftige Termine absagen, nicht mehr nachlegen.
 *
 * Vergangene Termine bleiben stehen. Sie haben stattgefunden, und sie zu
 * löschen würde die Kalenderhistorie verfälschen.
 */
export async function beendeVereinbarung(
  admin: SupabaseClient,
  vereinbarungId: string
): Promise<{ abgesagt: number }> {
  const { data: kommende } = await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("externe_vereinbarung_id", vereinbarungId)
    .eq("status", "booked")
    .gt("start_at", new Date().toISOString())
    .select("id");

  await admin
    .from("externe_vereinbarungen")
    .update({ aktiv: false, aktualisiert_am: new Date().toISOString() })
    .eq("id", vereinbarungId);

  return { abgesagt: (kommende ?? []).length };
}

export { LESSON_DURATION_MIN };
