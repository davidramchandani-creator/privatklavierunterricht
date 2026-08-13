// ============================================================
// Freie Fixplätze finden
//
// Beantwortet die Frage, die beim Kauf gestellt wird: „Welcher feste
// Wochentag zu welcher Uhrzeit ist über die ganze Laufzeit hinweg frei?“
//
// Das ist mehr als eine Slot-Abfrage für einen Tag: geprüft wird die ganze
// Serie über 4 bis 12 Monate. Ein Platz, der nächste Woche frei ist, aber
// ab Oktober jeden zweiten Termin kollidiert, taugt nicht als Fixplatz.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AVAILABILITY,
  DEFAULT_BUFFER_MIN,
  LESSON_DURATION_MIN,
  SLOT_GRID_MIN,
  type AvailabilityWindows,
} from "./booking";
import { loadAvailabilityContext } from "./booking-server";
import {
  firstSeriesStart,
  fixplatzSeriesStarts,
  pruefeFixplatzSerie,
  describeFixplatz,
  type FixplatzWunsch,
} from "./fixplatz";
import type { Rhythmus } from "./rhythmus";

export type FixplatzAngebot = {
  weekday: number;
  /** "HH:MM" */
  time: string;
  parity: 0 | 1 | null;
  /** Wie viele der geplanten Termine auf Anhieb frei sind. */
  freie: number;
  gesamt: number;
  /** Datum der ersten Lektion (ISO). */
  ersterTermin: string;
  /** Datum der letzten Lektion (ISO). */
  letzterTermin: string;
  /** Termine, die einen Ausweichtermin brauchen (ISO-Tage). */
  belegteTage: string[];
  beschreibung: string;
};

function fensterAusDb(
  rows: Array<{ wochentag: number; beginn_zeit: string; ende_zeit: string }>
): AvailabilityWindows {
  const w: AvailabilityWindows = {};
  for (const r of rows) {
    const tag = Number(r.wochentag);
    (w[tag] ??= []).push({
      start: String(r.beginn_zeit).slice(0, 5),
      end: String(r.ende_zeit).slice(0, 5),
    });
  }
  return w;
}

function minutenVon(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function alsZeit(minuten: number): string {
  return `${String(Math.floor(minuten / 60)).padStart(2, "0")}:${String(
    minuten % 60
  ).padStart(2, "0")}`;
}

/**
 * Alle Startzeiten, die grundsätzlich in Frage kommen. Raster aus den
 * Verfügbarkeitsfenstern des Wochentags.
 */
function kandidatenZeiten(
  fenster: AvailabilityWindows,
  weekday: number
): string[] {
  const zeiten: string[] = [];
  for (const f of fenster[weekday] ?? []) {
    const von = minutenVon(f.start);
    const bis = minutenVon(f.end);
    for (let m = von; m + LESSON_DURATION_MIN <= bis; m += SLOT_GRID_MIN) {
      zeiten.push(alsZeit(m));
    }
  }
  return zeiten;
}

/**
 * Sucht die brauchbarsten Fixplätze für einen Schüler.
 *
 * `mindestQuote` steuert, wie viel Kollision noch toleriert wird. Ein Platz,
 * bei dem über die Laufzeit ein, zwei Ferienwochen im Weg liegen, ist völlig
 * in Ordnung, dafür gibt es Ausweichtermine. Ein Platz, der zu einem Drittel
 * belegt ist, ist der falsche.
 */
export async function findeFixplaetze(
  admin: SupabaseClient,
  params: {
    studentId: string;
    rhythmus: Rhythmus;
    lessons: number;
    /** Nur diese Wochentage prüfen. Leer = alle Unterrichtstage. */
    nurWochentage?: number[];
    mindestQuote?: number;
    maxAngebote?: number;
    now?: Date;
  }
): Promise<FixplatzAngebot[]> {
  const now = params.now ?? new Date();
  const mindestQuote = params.mindestQuote ?? 0.75;

  const [{ data: profil }, { data: verfuegbarkeit }] = await Promise.all([
    admin
      .from("profiles")
      .select("buffer_time_minutes")
      .eq("id", params.studentId)
      .single(),
    admin
      .from("admin_verfuegbarkeit")
      .select("wochentag, beginn_zeit, ende_zeit, aktiv")
      .eq("aktiv", true),
  ]);

  const bufferMin = profil?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;
  const fenster =
    verfuegbarkeit && verfuegbarkeit.length > 0
      ? fensterAusDb(verfuegbarkeit)
      : AVAILABILITY;

  const tage = Object.keys(fenster)
    .map(Number)
    .filter(
      (d) =>
        !params.nurWochentage ||
        params.nurWochentage.length === 0 ||
        params.nurWochentage.includes(d)
    )
    .sort();

  if (tage.length === 0) return [];

  // Kontext einmal für den gesamten Zeitraum laden statt pro Kandidat,
  // sonst wären es hunderte Datenbankabfragen.
  const abstandTage = params.rhythmus === "zweiwoechentlich" ? 14 : 7;
  const bis = new Date(
    now.getTime() + (params.lessons + 2) * abstandTage * 86400000
  );
  const ctx = await loadAvailabilityContext(
    admin,
    params.studentId,
    bufferMin,
    now,
    bis,
    now,
    { skipLeadTime: false }
  );
  const ctxMitFenster = { ...ctx, availabilityWindows: fenster };

  const angebote: FixplatzAngebot[] = [];
  // Bei zweiwöchentlichem Rhythmus beide Wochenparitäten anbieten: der
  // gleiche Wochentag kann in geraden und ungeraden Wochen frei sein und
  // ist damit zweimal vergebbar.
  const paritaeten: Array<0 | 1 | null> =
    params.rhythmus === "zweiwoechentlich" ? [0, 1] : [null];

  for (const weekday of tage) {
    for (const time of kandidatenZeiten(fenster, weekday)) {
      for (const parity of paritaeten) {
        const wunsch: FixplatzWunsch = {
          weekday,
          time,
          rhythmus: params.rhythmus,
          lessons: params.lessons,
        };

        let ersterStart: Date;
        try {
          ersterStart = firstSeriesStart(wunsch, now, parity);
        } catch {
          continue;
        }

        const pruefung = pruefeFixplatzSerie(wunsch, ersterStart, ctxMitFenster);
        if (pruefung.slots.length === 0) continue;
        if (pruefung.freie / pruefung.slots.length < mindestQuote) continue;

        const starts = fixplatzSeriesStarts(wunsch, ersterStart);
        angebote.push({
          weekday,
          time,
          parity,
          freie: pruefung.freie,
          gesamt: pruefung.slots.length,
          ersterTermin: starts[0].toISOString(),
          letzterTermin: starts[starts.length - 1].toISOString(),
          belegteTage: pruefung.belegte.map((b) =>
            b.start.toISOString().slice(0, 10)
          ),
          beschreibung: describeFixplatz(weekday, time, params.rhythmus, parity),
        });
      }
    }
  }

  // Beste zuerst: möglichst wenig Kollisionen, dann früher Start.
  angebote.sort(
    (a, b) =>
      b.freie / b.gesamt - a.freie / a.gesamt ||
      a.ersterTermin.localeCompare(b.ersterTermin)
  );

  return angebote.slice(0, params.maxAngebote ?? 40);
}
