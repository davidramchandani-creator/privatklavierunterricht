import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlockSettings } from "./booking-gap";
import { DEFAULT_BLOCK_SETTINGS } from "./booking-gap";
import {
  type AvailabilityContext,
  type AvailabilityWindows,
  type ExistingAppointment,
  type Absence,
  type TimeBlock,
  type TimeBlockRule,
  DEFAULT_BUFFER_MIN,
} from "./booking";

/**
 * Lädt alle für die Slot-Berechnung nötigen Daten (Termine, Abwesenheiten,
 * Zeitblöcke, Regeln) und baut den AvailabilityContext der Buchungs-Engine.
 *
 * Muss mit einem Service-Role-Client aufgerufen werden: Für korrekte
 * Kollisionsprüfung werden ALLE belegten Zeiten benötigt – ein Schüler darf
 * via RLS aber nur eigene Termine sehen. Nach aussen werden nur freie Slots
 * (Zeiten, keine Termindetails) zurückgegeben.
 */
export type LoadedAvailability = {
  ctx: AvailabilityContext;
  blockSettings: BlockSettings;
};

export async function loadAvailabilityContext(
  admin: SupabaseClient,
  studentId: string,
  studentBufferMin: number,
  fromInstant: Date,
  toInstant: Date,
  now: Date = new Date(),
  opts: {
    skipLeadTime?: boolean;
    excludeAppointmentId?: string;
    excludeAppointmentIds?: string[];
  } = {}
): Promise<AvailabilityContext> {
  // Termine etwas grosszügiger laden, damit Puffer an den Rändern greifen.
  const apptFrom = new Date(fromInstant.getTime() - 86400000).toISOString();
  const apptTo = new Date(toInstant.getTime() + 86400000).toISOString();
  const fromDate = fromInstant.toISOString().slice(0, 10);
  const toDate = toInstant.toISOString().slice(0, 10);

  // Beim Verschieben muss der zu verschiebende Termin selbst von der
  // Kollisionsprüfung ausgenommen werden (sonst kollidiert er mit sich selbst).
  let apptQuery = admin
    .from("appointments")
    .select("start_at, end_at, profiles(buffer_time_minutes)")
    .in("status", ["booked", "pending"])
    .gte("start_at", apptFrom)
    .lte("start_at", apptTo);
  if (opts.excludeAppointmentId) {
    apptQuery = apptQuery.neq("id", opts.excludeAppointmentId);
  }
  if (opts.excludeAppointmentIds?.length) {
    apptQuery = apptQuery.not(
      "id",
      "in",
      `(${opts.excludeAppointmentIds.join(",")})`
    );
  }

  const [apptRes, absRes, blockRes, ruleRes, availRes, groupSessionRes] = await Promise.all([
    apptQuery,
    admin
      .from("absences")
      .select("scope, student_id, start_date, end_date")
      .lte("start_date", toDate)
      .gte("end_date", fromDate),
    admin
      .from("time_blocks")
      .select("date, start_time, end_time")
      .gte("date", fromDate)
      .lte("date", toDate),
    admin
      .from("time_block_rules")
      .select("start_date, start_time, end_time, interval_days"),
    admin
      .from("admin_verfuegbarkeit")
      .select("wochentag, beginn_zeit, ende_zeit, aktiv, lesson_minutes, min_buffer_minutes, packing"),
    // Admin-geplante Gruppensessions blockieren Zeitslots auch ohne Teilnehmer.
    admin
      .from("group_sessions")
      .select("start_at, end_at")
      .in("status", ["open", "full"])
      .gte("start_at", apptFrom)
      .lte("start_at", apptTo),
  ]);

  // Vom Admin gepflegte Verfügbarkeit → Fenster-Map (nur aktive Tage).
  // Ohne Einträge bleibt das Feld leer und die Engine nutzt den AVAILABILITY-Default.
  let availabilityWindows: AvailabilityWindows | undefined;
  let blockSettings: BlockSettings = DEFAULT_BLOCK_SETTINGS;
  if (availRes.data && availRes.data.length > 0) {
    availabilityWindows = {};
    for (const row of availRes.data as Array<{
      wochentag: number;
      beginn_zeit: string;
      ende_zeit: string;
      aktiv: boolean;
      lesson_minutes?: number | null;
      min_buffer_minutes?: number | null;
      packing?: string | null;
    }>) {
      if (!row.aktiv) continue;
      (availabilityWindows[row.wochentag] ??= []).push({
        start: row.beginn_zeit.slice(0, 5),
        end: row.ende_zeit.slice(0, 5),
      });
      // Lektionsdauer/Puffer werden aktuell einheitlich geführt; die erste
      // aktive Zeile gibt die Einstellung vor.
      blockSettings = {
        lessonMinutes: row.lesson_minutes ?? DEFAULT_BLOCK_SETTINGS.lessonMinutes,
        minBufferMinutes:
          row.min_buffer_minutes ?? DEFAULT_BLOCK_SETTINGS.minBufferMinutes,
        packing:
          row.packing === "maximal" ? "maximal" : "lueckenlos",
      };
    }
  }

  const appointments: ExistingAppointment[] = [
    ...(apptRes.data ?? []).map((a: Record<string, unknown>) => {
      const prof = a.profiles as { buffer_time_minutes?: number } | null;
      return {
        start_at: a.start_at as string,
        end_at: a.end_at as string,
        bufferMinutes: prof?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN,
      };
    }),
    // Geplante Gruppensessions ohne Teilnehmer als Blocker eintragen.
    ...(groupSessionRes.data ?? []).map((s: Record<string, unknown>) => ({
      start_at: s.start_at as string,
      end_at: s.end_at as string,
      bufferMinutes: DEFAULT_BUFFER_MIN,
    })),
  ];

  const ctx: AvailabilityContext = {
    studentId,
    bufferMin: studentBufferMin,
    now,
    appointments,
    absences: (absRes.data ?? []) as Absence[],
    timeBlocks: (blockRes.data ?? []) as TimeBlock[],
    timeBlockRules: (ruleRes.data ?? []) as TimeBlockRule[],
    availabilityWindows,
    skipLeadTime: opts.skipLeadTime ?? false,
  };

  return Object.assign(ctx, { blockSettings }) as AvailabilityContext & {
    blockSettings: BlockSettings;
  };
}
