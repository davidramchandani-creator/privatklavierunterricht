import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_BUFFER_MIN,
  isAtLeast24hAway,
  slotsFromStarts,
  validateSeries,
  type Slot,
} from "@/lib/booking";
import { loadAvailabilityContext } from "@/lib/booking-server";
import { enqueueEmail, sendEmailNow } from "@/lib/emails-outbox";
import {
  durationMinFor,
  isSessionFull,
  type GroupCourse,
} from "@/lib/group-courses";
import {
  syncAppointmentToCalendar,
  deleteCalendarEvent,
} from "@/lib/google-calendar";

type Result = { success: true; sessionId: string } | { error: string };

type Participant = {
  id: string; // appointment id
  student_id: string;
  buffer: number;
};

/** Aktive (booked/completed) Teilnehmer-Termine einer Session. */
async function loadParticipants(
  admin: SupabaseClient,
  sessionId: string
): Promise<Participant[]> {
  const { data } = await admin
    .from("appointments")
    .select("id, student_id, profiles(buffer_time_minutes)")
    .eq("group_session_id", sessionId)
    .in("status", ["booked", "completed"]);
  return (data ?? []).map((a: Record<string, unknown>) => {
    const prof = a.profiles as { buffer_time_minutes?: number } | null;
    return {
      id: a.id as string,
      student_id: a.student_id as string,
      buffer: prof?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN,
    };
  });
}

/**
 * Prüft, ob ein Slot für einen bestimmten Schüler buchbar ist (Verfügbarkeit,
 * Abwesenheiten, Zeitblöcke, Kollisionen). Die Session-eigenen Termine werden
 * von der Kollisionsprüfung ausgenommen (sonst kollidiert die Verlängerung mit
 * den bestehenden 45-Min-Terminen am selben Start).
 */
async function slotBookableForStudent(
  admin: SupabaseClient,
  studentId: string,
  bufferMin: number,
  slot: Slot,
  now: Date,
  excludeAppointmentIds: string[],
  skipLeadTime: boolean
): Promise<boolean> {
  const ctx = await loadAvailabilityContext(
    admin,
    studentId,
    bufferMin,
    slot.start,
    slot.end,
    now,
    { skipLeadTime, excludeAppointmentIds }
  );
  return validateSeries(
    slot.start,
    1,
    7,
    ctx,
    (slot.end.getTime() - slot.start.getTime()) / 60000
  ).ok;
}

/**
 * Setzt Dauer + end_at einer Session konsistent auf die aktuelle Teilnehmerzahl
 * (45 Min bei 1–2, 90 Min ab 3 – pro Kurs konfigurierbar). Aktualisiert alle
 * Teilnehmer-Termine, verschiebt die geplanten Zahlungsmails auf das neue Ende
 * und synchronisiert den Kalender. Idempotent (no-op, wenn Dauer schon stimmt).
 */
async function recomputeSessionDuration(
  admin: SupabaseClient,
  session: { id: string; start_at: string; end_at: string },
  course: GroupCourse
): Promise<void> {
  const participants = await loadParticipants(admin, session.id);
  if (participants.length === 0) return;

  const start = new Date(session.start_at);
  const newDuration = durationMinFor(course, participants.length);
  const newEnd = new Date(start.getTime() + newDuration * 60000);
  const curEnd = new Date(session.end_at);
  if (newEnd.getTime() === curEnd.getTime()) return;

  const newEndIso = newEnd.toISOString();

  await admin
    .from("group_sessions")
    .update({ end_at: newEndIso, aktualisiert_am: new Date().toISOString() })
    .eq("id", session.id);

  await admin
    .from("appointments")
    .update({ end_at: newEndIso })
    .eq("group_session_id", session.id)
    .in("status", ["booked", "completed"]);

  // Geplante Zahlungsmails auf das neue Lektionsende verschieben.
  await admin
    .from("scheduled_emails")
    .update({ send_at: newEndIso })
    .eq("status", "pending")
    .eq("type", "group_payment_request")
    .contains("payload", { group_session_id: session.id });

  // Kalender neu syncen (end_at hat sich verschoben).
  for (const p of participants) {
    await syncAppointmentToCalendar(admin, p.id);
  }
}

/**
 * Schüler eröffnet eine neue Gruppen-Session durch Slot-Wahl. Startet mit einer
 * Person → 45 Min. Validiert gegen die Buchungs-Engine (24h-Regel gilt). Legt
 * Session + erste Teilnehmer-Termin-Zeile an und plant die Zahlungsmail auf
 * end_at. Rechnung wird erst beim Versand erstellt (dynamischer Preis).
 */
export async function createGroupSession(
  admin: SupabaseClient,
  studentId: string,
  courseId: string,
  startIso: string
): Promise<Result> {
  const { data: course } = await admin
    .from("group_courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || course.status !== "active") {
    return { error: "Kurs nicht gefunden oder nicht aktiv." };
  }

  const start = new Date(startIso);
  const now = new Date();
  if (!isAtLeast24hAway(start, now)) {
    return { error: "Gruppenlektionen können nur mindestens 24 Stunden im Voraus gebucht werden." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("buffer_time_minutes, vorname, nachname, email")
    .eq("id", studentId)
    .maybeSingle();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  const duration = durationMinFor(course as GroupCourse, 1);
  const [slot] = slotsFromStarts([start], duration);

  const ok = await slotBookableForStudent(admin, studentId, bufferMin, slot, now, [], false);
  if (!ok) {
    return { error: "Dieser Zeitpunkt ist leider nicht verfügbar. Bitte wähle einen anderen." };
  }

  const { data: session, error: sessErr } = await admin
    .from("group_sessions")
    .insert({
      course_id: courseId,
      start_at: slot.start.toISOString(),
      end_at: slot.end.toISOString(),
      status: "open",
      created_by: studentId,
    })
    .select("id, start_at, end_at")
    .single();
  if (sessErr || !session) {
    return { error: "Session konnte nicht erstellt werden." };
  }

  const { data: appt, error: apptErr } = await admin
    .from("appointments")
    .insert({
      student_id: studentId,
      package_id: null,
      group_session_id: session.id,
      start_at: slot.start.toISOString(),
      end_at: slot.end.toISOString(),
      status: "booked",
      source: "group",
    })
    .select("id")
    .single();
  if (apptErr || !appt) {
    // Session ohne Teilnehmer wieder entfernen.
    await admin.from("group_sessions").delete().eq("id", session.id);
    return { error: "Anmeldung konnte nicht gespeichert werden." };
  }

  if (profile?.email) {
    await enqueueEmail(
      admin,
      "group_payment_request",
      {
        to: profile.email,
        student_id: studentId,
        group_session_id: session.id,
        appointment_id: appt.id,
      },
      new Date(session.end_at)
    );
  }

  await syncAppointmentToCalendar(admin, appt.id);

  // Wenn Kurs schon mit 1 Person voll wäre (max_participants=1), markieren.
  if (isSessionFull(course as GroupCourse, 1)) {
    await admin.from("group_sessions").update({ status: "full" }).eq("id", session.id);
  }

  await sendEmailNow(admin, "group_session_created", {
    to: profile?.email,
    student_id: studentId,
    course_title: course.title,
    start_at: session.start_at,
  });
  await sendEmailNow(admin, "group_session_admin", {
    student_name: profile ? `${profile.vorname} ${profile.nachname}` : "Schüler",
    course_title: course.title,
    start_at: session.start_at,
    kind: "created",
  });

  return { success: true, sessionId: session.id };
}

/**
 * Schüler tritt einer offenen Session bei. Prüft Platz, Doppel-Beitritt, 24h.
 * Wenn der Beitritt die Lektion auf 90 Min verlängert (Übergang 2→3), wird der
 * erweiterte Slot für jeden Teilnehmer re-validiert; bei Kollision wird der
 * Beitritt abgelehnt. Danach wird die Session-Dauer konsistent neu gesetzt.
 */
export async function joinGroupSession(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string
): Promise<Result> {
  const { data: session } = await admin
    .from("group_sessions")
    .select("id, course_id, start_at, end_at, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { error: "Session nicht gefunden." };
  if (session.status === "cancelled" || session.status === "completed") {
    return { error: "Diese Gruppenlektion ist nicht mehr offen." };
  }

  const { data: course } = await admin
    .from("group_courses")
    .select("*")
    .eq("id", session.course_id)
    .maybeSingle();
  if (!course || course.status !== "active") {
    return { error: "Kurs nicht gefunden oder nicht aktiv." };
  }

  const now = new Date();
  if (!isAtLeast24hAway(session.start_at, now)) {
    return { error: "Ein Beitritt ist nur mindestens 24 Stunden vor der Lektion möglich." };
  }

  const participants = await loadParticipants(admin, sessionId);
  if (participants.some((p) => p.student_id === studentId)) {
    return { error: "Du bist bei dieser Gruppenlektion bereits angemeldet." };
  }
  if (isSessionFull(course as GroupCourse, participants.length)) {
    return { error: "Diese Gruppenlektion ist bereits voll." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("buffer_time_minutes, vorname, nachname, email")
    .eq("id", studentId)
    .maybeSingle();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  const newCount = participants.length + 1;
  const newDuration = durationMinFor(course as GroupCourse, newCount);
  const curDuration =
    (new Date(session.end_at).getTime() - new Date(session.start_at).getTime()) / 60000;
  const start = new Date(session.start_at);
  const [newSlot] = slotsFromStarts([start], newDuration);
  const sessionApptIds = participants.map((p) => p.id);

  // Joiner muss am neuen Slot frei sein (24h-Regel gilt für ihn).
  const joinerOk = await slotBookableForStudent(
    admin,
    studentId,
    bufferMin,
    newSlot,
    now,
    sessionApptIds,
    false
  );
  if (!joinerOk) {
    return { error: "Du hast zu diesem Zeitpunkt bereits einen Termin oder er ist nicht verfügbar." };
  }

  // Verlängerung 2→3: erweiterten 90-Min-Footprint für JEDEN bestehenden
  // Teilnehmer prüfen (deren eigene Abwesenheiten/Folgetermine).
  if (newDuration > curDuration) {
    for (const p of participants) {
      const free = await slotBookableForStudent(
        admin,
        p.student_id,
        p.buffer,
        newSlot,
        now,
        sessionApptIds,
        true
      );
      if (!free) {
        return {
          error:
            "Ab 3 Teilnehmern dauert die Lektion 90 Minuten. Zu diesem Zeitpunkt ist das leider nicht für alle möglich. Bitte wähle eine andere Gruppenlektion.",
        };
      }
    }
  }

  const { data: appt, error: apptErr } = await admin
    .from("appointments")
    .insert({
      student_id: studentId,
      package_id: null,
      group_session_id: sessionId,
      start_at: session.start_at,
      end_at: newSlot.end.toISOString(),
      status: "booked",
      source: "group",
    })
    .select("id")
    .single();
  if (apptErr || !appt) {
    return { error: "Beitritt konnte nicht gespeichert werden." };
  }

  if (profile?.email) {
    await enqueueEmail(
      admin,
      "group_payment_request",
      {
        to: profile.email,
        student_id: studentId,
        group_session_id: sessionId,
        appointment_id: appt.id,
      },
      newSlot.end
    );
  }
  await syncAppointmentToCalendar(admin, appt.id);

  // Dauer/Ende konsistent neu setzen (verschiebt bestehende Termine + Mails).
  await recomputeSessionDuration(admin, session, course as GroupCourse);

  if (isSessionFull(course as GroupCourse, newCount)) {
    await admin.from("group_sessions").update({ status: "full" }).eq("id", sessionId);
  }

  await sendEmailNow(admin, "group_session_joined", {
    to: profile?.email,
    student_id: studentId,
    course_title: course.title,
    start_at: session.start_at,
  });
  await sendEmailNow(admin, "group_session_admin", {
    student_name: profile ? `${profile.vorname} ${profile.nachname}` : "Schüler",
    course_title: course.title,
    start_at: session.start_at,
    kind: "joined",
  });

  return { success: true, sessionId };
}

/**
 * Schüler verlässt eine Gruppenlektion (nur ≥24h vorher). Storniert den eigenen
 * Termin, bricht die geplante Zahlungsmail ab (es existiert noch keine Rechnung)
 * und rechnet Dauer/Preis für die übrigen neu. Verlässt die letzte Person, wird
 * die Session storniert.
 */
export async function leaveGroupSession(
  admin: SupabaseClient,
  studentId: string,
  sessionId: string
): Promise<Result> {
  const { data: session } = await admin
    .from("group_sessions")
    .select("id, course_id, start_at, end_at, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { error: "Session nicht gefunden." };

  const { data: appt } = await admin
    .from("appointments")
    .select("id, status")
    .eq("group_session_id", sessionId)
    .eq("student_id", studentId)
    .in("status", ["booked", "completed"])
    .maybeSingle();
  if (!appt) return { error: "Du bist bei dieser Gruppenlektion nicht angemeldet." };

  if (!isAtLeast24hAway(session.start_at, new Date())) {
    return { error: "Ein Abmelden ist nur mindestens 24 Stunden vor der Lektion möglich." };
  }

  await admin.from("appointments").update({ status: "cancelled" }).eq("id", appt.id);

  // Geplante Zahlungsmail dieses Teilnehmers abbrechen (noch keine Rechnung).
  await admin
    .from("scheduled_emails")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .eq("type", "group_payment_request")
    .contains("payload", { appointment_id: appt.id });

  await deleteCalendarEvent(admin, appt.id);

  const remaining = await loadParticipants(admin, sessionId);
  const { data: profile } = await admin
    .from("profiles")
    .select("vorname, nachname, email")
    .eq("id", studentId)
    .maybeSingle();

  if (remaining.length === 0) {
    await admin
      .from("group_sessions")
      .update({ status: "cancelled", aktualisiert_am: new Date().toISOString() })
      .eq("id", sessionId);
  } else {
    const { data: course } = await admin
      .from("group_courses")
      .select("*")
      .eq("id", session.course_id)
      .maybeSingle();
    if (course) {
      await recomputeSessionDuration(admin, session, course as GroupCourse);
      if (
        session.status === "full" &&
        !isSessionFull(course as GroupCourse, remaining.length)
      ) {
        await admin.from("group_sessions").update({ status: "open" }).eq("id", sessionId);
      }
    }
  }

  await sendEmailNow(admin, "group_session_left", {
    to: profile?.email,
    student_id: studentId,
    start_at: session.start_at,
  });
  await sendEmailNow(admin, "group_session_admin", {
    student_name: profile ? `${profile.vorname} ${profile.nachname}` : "Schüler",
    start_at: session.start_at,
    kind: "left",
  });

  return { success: true, sessionId };
}

export { recomputeSessionDuration };
