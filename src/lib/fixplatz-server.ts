// ============================================================
// Fixplatz, Serverseite: Serie buchen, Ausweichtermine finden
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_BUFFER_MIN,
  LESSON_DURATION_MIN,
  computeAvailableSlots,
  isSlotBookable,
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
 * Hängt eine Lektion hinten an die Fixplatz-Serie an.
 *
 * Die letzte Stufe der Ausfall-Kaskade beim Abo. Beim alten Lektionspaket
 * genügte es, die Laufzeit zu verlängern: In der gewonnenen Zeit liess sich
 * die Lektion nachbuchen. Beim Fixplatz-Abo steht die Serie fest und der
 * Schüler bucht nicht selbst — eine verlängerte Laufzeit brächte ihm also
 * gar nichts, er hätte eine Lektion bezahlt und keine bekommen.
 *
 * Gesucht wird auf **demselben Platz**: gleicher Wochentag, gleiche Uhrzeit,
 * im gewohnten Takt nach dem bisher letzten Termin. Das ist der einzige
 * Termin, von dem sicher ist, dass er passt — er ist ja seiner.
 *
 * Gibt `null` zurück, wenn kein Platz zu finden war oder das Paket keinen
 * Fixplatz hat. Der Aufrufer fällt dann auf die Laufzeitverlängerung zurück.
 */
export async function haengeLektionAn(
  admin: SupabaseClient,
  params: {
    studentId: string;
    packageId: string;
    /** Wofür nachgeholt wird, für die Notiz am Termin. */
    originalStart: Date;
    now?: Date;
  }
): Promise<{ appointmentId: string; start: Date } | null> {
  const now = params.now ?? new Date();

  const { data: pkg } = await admin
    .from("packages")
    .select(
      "id, booking_mode, rhythmus, fixplatz_weekday, fixplatz_time, fixplatz_week_parity"
    )
    .eq("id", params.packageId)
    .maybeSingle();

  if (
    !pkg ||
    pkg.booking_mode !== "fix" ||
    pkg.fixplatz_weekday == null ||
    !pkg.fixplatz_time
  ) {
    return null;
  }

  // Der bisher letzte Termin der Serie. Ab dort wird weitergezählt, nicht ab
  // heute: Sonst landete die Nachholstunde mitten in der laufenden Serie und
  // der Schüler hätte zweimal in derselben Woche Unterricht.
  const { data: letzte } = await admin
    .from("appointments")
    .select("start_at")
    .eq("package_id", params.packageId)
    .in("status", ["booked", "completed"])
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ab = letzte?.start_at ? new Date(letzte.start_at) : now;

  const { data: ferienRoh } = await admin
    .from("schulferien")
    .select("start_datum, end_datum")
    .gte("end_datum", ab.toISOString().slice(0, 10));

  const ferien = (ferienRoh ?? []).map((f) => ({
    start: String(f.start_datum),
    ende: String(f.end_datum),
  }));

  const wunsch: FixplatzWunsch = {
    weekday: Number(pkg.fixplatz_weekday),
    time: String(pkg.fixplatz_time).slice(0, 5),
    rhythmus:
      pkg.rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich",
    // Mehrere Kandidaten holen: Der nächste Takt kann belegt sein, etwa weil
    // dort bereits eine Nachholstunde aus einem früheren Ausfall liegt.
    lessons: 8,
  };

  const paritaet = (pkg.fixplatz_week_parity as 0 | 1 | null) ?? null;

  // Auf den Fixplatz einrasten, statt einfach vom letzten Termin weiterzu-
  // zählen. Der letzte Termin kann ein Ausweichtermin an einem anderen
  // Wochentag gewesen sein; von dort aus +7 Tage ergäbe eine Nachholstunde
  // am falschen Tag, und zwar dauerhaft, weil die nächste wieder von dieser
  // ausginge.
  let ersterKandidat: Date;
  try {
    ersterKandidat = firstSeriesStart(wunsch, ab, paritaet, 0);
  } catch {
    return null;
  }

  const kandidaten = fixplatzSeriesStarts(wunsch, ersterKandidat, ferien).filter(
    (d) => d.getTime() > ab.getTime()
  );
  if (kandidaten.length === 0) return null;

  const bufferMin = await ladePuffer(admin, params.studentId);
  const letzterKandidat = kandidaten[kandidaten.length - 1];

  const ctx = await loadAvailabilityContext(
    admin,
    params.studentId,
    bufferMin,
    kandidaten[0],
    new Date(letzterKandidat.getTime() + LESSON_DURATION_MIN * 60000),
    now,
    { skipLeadTime: true }
  );

  const treffer = kandidaten.find((start) =>
    isSlotBookable(
      { start, end: new Date(start.getTime() + LESSON_DURATION_MIN * 60000) },
      ctx
    )
  );
  if (!treffer) return null;

  const { data: created, error } = await admin
    .from("appointments")
    .insert({
      student_id: params.studentId,
      package_id: params.packageId,
      start_at: treffer.toISOString(),
      end_at: new Date(
        treffer.getTime() + LESSON_DURATION_MIN * 60000
      ).toISOString(),
      status: "booked",
      source: "direct",
      is_fixplatz: true,
      notes: `Nachholtermin für ${params.originalStart
        .toISOString()
        .slice(0, 10)}`,
    })
    .select("id, start_at")
    .single();

  if (error || !created) return null;

  await scheduleLessonReminders(admin, {
    id: created.id,
    student_id: params.studentId,
    start_at: created.start_at,
  });
  await syncAppointmentToCalendar(admin, created.id);

  return { appointmentId: created.id, start: treffer };
}

async function ladePuffer(
  admin: SupabaseClient,
  studentId: string
): Promise<number> {
  const { data } = await admin
    .from("profiles")
    .select("buffer_time_minutes")
    .eq("id", studentId)
    .maybeSingle();
  return data?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;
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
