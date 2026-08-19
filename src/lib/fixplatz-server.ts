// ============================================================
// Fixplatz, Serverseite: Serie buchen, Ausweichtermine finden
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_BUFFER_MIN,
  LESSON_DURATION_MIN,
  computeAvailableSlots,
  utcToZonedDate,
  type Slot,
} from "./booking";
import { loadAvailabilityContext } from "./booking-server";
import {
  ausweichKandidaten,
  fixplatzSeriesStarts,
  firstSeriesStart,
  pruefeFixplatzSerie,
  type AusweichKandidat,
  type FixplatzWunsch,
} from "./fixplatz";
import { syncAppointmentToCalendar } from "./google-calendar";
import { scheduleLessonReminders } from "./reminders";

export type FixplatzBuchungErgebnis = {
  appointmentIds: string[];
  /** Termine, die auf einen Ausweichtermin verschoben wurden. */
  verschoben: { original: Date; ersatz: Date }[];
  /** Lektionen, für die kein Platz gefunden wurde. Der Admin plant sie. */
  offen: Date[];
};

/**
 * Bucht die komplette Fixplatz-Serie eines Pakets.
 *
 * Ablauf pro Wunschtermin:
 *   frei          → direkt buchen
 *   belegt        → bester Ausweichtermin (gleiche Woche, sonst Folgewoche)
 *   nichts frei   → Lektion bleibt offen, der Admin plant sie von Hand
 *
 * Die Serie wird bewusst **nicht** komplett abgebrochen, wenn ein einzelner
 * Termin nicht passt. Über 4 bis 12 Monate liegt fast immer eine Ferienwoche
 * oder ein Feiertag im Weg; ein Alles-oder-nichts würde bedeuten, dass kaum
 * jemand je einen Fixplatz buchen kann.
 *
 * ── Schulferien ─────────────────────────────────────────────
 *
 * Sie werden vor der Kollisionsprüfung übersprungen, nicht als Kollision
 * behandelt. Der Unterschied ist wesentlich: Als Kollision würde jeder
 * Ferientermin einen Ausweichtermin in der Nachbarwoche suchen, und dort
 * sitzt bereits die reguläre Lektion. Übersprungen rückt die Serie einfach
 * um eine Woche weiter, genau wie es die Abo-Rechnung annimmt.
 */
export async function bookFixplatzSeries(
  admin: SupabaseClient,
  params: {
    studentId: string;
    packageId: string;
    wunsch: FixplatzWunsch;
    parity: 0 | 1 | null;
    now?: Date;
  }
): Promise<FixplatzBuchungErgebnis | { error: string }> {
  const { studentId, packageId, wunsch, parity } = params;
  const now = params.now ?? new Date();

  const { data: profile } = await admin
    .from("profiles")
    .select("buffer_time_minutes")
    .eq("id", studentId)
    .single();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  let ersterStart: Date;
  try {
    ersterStart = firstSeriesStart(wunsch, now, parity);
  } catch {
    return { error: "Für diesen Wochentag lässt sich kein Starttermin finden." };
  }

  // Schulferien. Grosszügig geladen, weil die Serie über ein Jahr laufen
  // kann und der Zeitraum erst feststeht, wenn die Ferien bekannt sind.
  const { data: ferienRoh } = await admin
    .from("schulferien")
    .select("start_datum, end_datum")
    .gte("end_datum", ersterStart.toISOString().slice(0, 10));

  const ferien = (ferienRoh ?? []).map((f) => ({
    start: String(f.start_datum),
    ende: String(f.end_datum),
  }));

  // Der erste Termin selbst darf nicht in den Ferien liegen. Sonst startet
  // das Abo mit einer Lektion, die es nicht gibt.
  const startInFerien = ferien.some((f) => {
    const tag = ersterStart.toISOString().slice(0, 10);
    return tag >= f.start && tag <= f.ende;
  });
  if (startInFerien) {
    const spaeter = fixplatzSeriesStarts(
      { ...wunsch, lessons: 1 },
      ersterStart,
      ferien
    );
    if (spaeter.length > 0) ersterStart = spaeter[0];
  }

  const starts = fixplatzSeriesStarts(wunsch, ersterStart, ferien);
  if (starts.length === 0) {
    return { error: "Für diesen Wochentag lässt sich kein Starttermin finden." };
  }
  const letzterStart = starts[starts.length - 1];
  // Grosszügig laden: die Ausweichsuche schaut bis zu 14 Tage über das
  // Serienende hinaus.
  const bisInstant = new Date(
    letzterStart.getTime() + 21 * 86400000 + LESSON_DURATION_MIN * 60000
  );

  const ctx = await loadAvailabilityContext(
    admin,
    studentId,
    bufferMin,
    ersterStart,
    bisInstant,
    now,
    { skipLeadTime: true }
  );

  const pruefung = pruefeFixplatzSerie(
    wunsch,
    ersterStart,
    ctx,
    LESSON_DURATION_MIN,
    ferien
  );

  // Für belegte Termine brauchen wir freie Slots im Umfeld. Einmal für den
  // gesamten Zeitraum berechnen statt pro Termin, das ist der teure Teil.
  const vonCal = utcToZonedDate(ersterStart);
  const tage =
    Math.ceil(
      (bisInstant.getTime() - ersterStart.getTime()) / 86400000
    ) + 1;
  const freieSlots =
    pruefung.belegte.length > 0
      ? computeAvailableSlots(vonCal, tage, ctx)
      : [];

  // Slots, die wir innerhalb dieses Laufs schon vergeben haben, dürfen nicht
  // ein zweites Mal als Ausweichtermin herhalten.
  const vergeben = new Set<number>();
  for (const s of pruefung.slots) if (s.frei) vergeben.add(s.start.getTime());

  const zuBuchen: { start: Date; original: Date | null }[] = [];
  const verschoben: { original: Date; ersatz: Date }[] = [];
  const offen: Date[] = [];

  for (const slot of pruefung.slots) {
    if (slot.frei) {
      zuBuchen.push({ start: slot.start, original: null });
      continue;
    }
    const kandidaten = ausweichKandidaten(
      slot.start,
      freieSlots.filter((s) => !vergeben.has(s.start.getTime()))
    );
    const bester = kandidaten[0];
    if (bester) {
      vergeben.add(bester.slot.start.getTime());
      zuBuchen.push({ start: bester.slot.start, original: slot.start });
      verschoben.push({ original: slot.start, ersatz: bester.slot.start });
    } else {
      offen.push(slot.start);
    }
  }

  if (zuBuchen.length === 0) {
    return {
      error:
        "In diesem Zeitfenster ist kein einziger Termin frei. Bitte einen anderen Tag oder eine andere Uhrzeit wählen.",
    };
  }

  const seriesId = crypto.randomUUID();
  const rows = zuBuchen.map((t) => ({
    student_id: studentId,
    package_id: packageId,
    start_at: t.start.toISOString(),
    end_at: new Date(
      t.start.getTime() + LESSON_DURATION_MIN * 60000
    ).toISOString(),
    status: "booked",
    source: "direct",
    series_id: seriesId,
    is_fixplatz: true,
    notes: t.original
      ? `Ausweichtermin für ${t.original.toISOString().slice(0, 10)}`
      : null,
  }));

  const { data: created, error } = await admin
    .from("appointments")
    .insert(rows)
    .select("id, start_at");

  if (error || !created) {
    return { error: "Die Terminserie konnte nicht angelegt werden." };
  }

  // Erinnerungen und Kalendersync laufen fehlertolerant, ein Aussetzer hier
  // darf die bereits gebuchte Serie nicht zurücknehmen.
  for (const c of created) {
    await scheduleLessonReminders(admin, {
      id: c.id,
      student_id: studentId,
      start_at: c.start_at,
    });
  }
  for (const c of created) {
    await syncAppointmentToCalendar(admin, c.id);
  }

  return {
    appointmentIds: created.map((c) => c.id),
    verschoben,
    offen,
  };
}

/**
 * Ausweichtermine für eine konkrete ausgefallene Lektion.
 * Wird von der Ausfall-Logik und vom Admin-Portal genutzt.
 */
export async function findeAusweichtermine(
  admin: SupabaseClient,
  params: {
    studentId: string;
    originalStart: Date;
    /** Der ausgefallene Termin selbst wird von der Kollisionsprüfung ausgenommen. */
    excludeAppointmentId?: string;
    now?: Date;
  }
): Promise<AusweichKandidat[]> {
  const now = params.now ?? new Date();
  const { data: profile } = await admin
    .from("profiles")
    .select("buffer_time_minutes")
    .eq("id", params.studentId)
    .single();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  // Suchfenster: ab jetzt bis 14 Tage nach dem ausgefallenen Termin. Weiter
  // weg ist es kein Ausweichtermin mehr, sondern eine Zusatzlektion.
  const von = new Date(Math.max(now.getTime(), Date.now()));
  const bis = new Date(params.originalStart.getTime() + 15 * 86400000);
  if (bis.getTime() <= von.getTime()) return [];

  const ctx = await loadAvailabilityContext(
    admin,
    params.studentId,
    bufferMin,
    von,
    bis,
    now,
    { excludeAppointmentId: params.excludeAppointmentId }
  );

  const vonCal = utcToZonedDate(von);
  const tage = Math.ceil((bis.getTime() - von.getTime()) / 86400000) + 1;
  const freie: Slot[] = computeAvailableSlots(vonCal, tage, ctx);

  return ausweichKandidaten(params.originalStart, freie);
}
