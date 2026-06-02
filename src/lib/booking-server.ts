import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AvailabilityContext,
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
export async function loadAvailabilityContext(
  admin: SupabaseClient,
  studentId: string,
  studentBufferMin: number,
  fromInstant: Date,
  toInstant: Date,
  now: Date = new Date(),
  opts: { skipLeadTime?: boolean } = {}
): Promise<AvailabilityContext> {
  // Termine etwas grosszügiger laden, damit Puffer an den Rändern greifen.
  const apptFrom = new Date(fromInstant.getTime() - 86400000).toISOString();
  const apptTo = new Date(toInstant.getTime() + 86400000).toISOString();
  const fromDate = fromInstant.toISOString().slice(0, 10);
  const toDate = toInstant.toISOString().slice(0, 10);

  const [apptRes, absRes, blockRes, ruleRes] = await Promise.all([
    admin
      .from("appointments")
      .select("start_at, end_at, profiles(buffer_time_minutes)")
      .in("status", ["booked", "pending"])
      .gte("start_at", apptFrom)
      .lte("start_at", apptTo),
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
  ]);

  const appointments: ExistingAppointment[] = (apptRes.data ?? []).map(
    (a: Record<string, unknown>) => {
      const prof = a.profiles as { buffer_time_minutes?: number } | null;
      return {
        start_at: a.start_at as string,
        end_at: a.end_at as string,
        bufferMinutes: prof?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN,
      };
    }
  );

  return {
    studentId,
    bufferMin: studentBufferMin,
    now,
    appointments,
    absences: (absRes.data ?? []) as Absence[],
    timeBlocks: (blockRes.data ?? []) as TimeBlock[],
    timeBlockRules: (ruleRes.data ?? []) as TimeBlockRule[],
    skipLeadTime: opts.skipLeadTime ?? false,
  };
}
