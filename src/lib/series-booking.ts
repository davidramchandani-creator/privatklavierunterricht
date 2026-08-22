import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_BUFFER_MIN,
  LESSON_DURATION_MIN,
  generateSeriesStarts,
  slotsFromStarts,
  validateSeries,
} from "@/lib/booking";
import { loadAvailabilityContext } from "@/lib/booking-server";
import {
  type Package as Paket,
  canBuyNewPackage,
  computePackageState,
} from "@/lib/packages";
import { syncAppointmentToCalendar } from "@/lib/google-calendar";
import { scheduleLessonReminders } from "@/lib/reminders";

/**
 * Bucht (ggf. als Serie) Termine für einen Schüler im neuen Schema.
 * Validiert transaktional gegen die Buchungs-Engine; 24h-Vorlauf wird als
 * Admin-/System-Aktion übersprungen. Synchronisiert mit Google Calendar.
 * Es entstehen KEINE Rechnungen pro Lektion, die Abrechnung läuft im Voraus
 * über den Paketpreis (siehe createPackageInvoice).
 *
 * Wird genutzt von: Admin-Direktbuchung, Anfrage-Annahme (Admin) und
 * Terminvorschlag-Annahme (Schüler). Der Aufrufer übergibt einen Admin-Client
 * (Service-Role), da appointments/invoices per RLS admin-only sind.
 */
export async function bookSeriesForStudent(
  admin: SupabaseClient,
  studentUserId: string,
  startIso: string,
  lessonsCount: number,
  intervalDays: number,
  source: "direct" | "public_request" | "admin_proposal" | "reschedule",
  opts?: {
    /**
     * Der Admin bucht an allen Regeln vorbei.
     *
     * Zeitfenster, Abwesenheiten und Zeitblöcke sind Regeln für Schüler —
     * sie schützen den Kalender vor Anfragen, die nicht in den Alltag
     * passen. Der Admin ist derjenige, der die Ausnahmen macht: die
     * Ersatzlektion am Samstagvormittag, der Termin in den Ferien, weil es
     * beiden gerade passt. Ihn an die eigenen Schutzregeln zu binden hiesse,
     * für jede Ausnahme erst die Regel umzubauen.
     *
     * Was auch mit Übersteuerung geprüft wird: Überschneidung mit einem
     * bestehenden Termin. Das ist keine Regel, sondern Physik — niemand
     * kann gleichzeitig an zwei Orten unterrichten.
     */
    adminOverride?: boolean;
  }
): Promise<{ appointmentIds: string[] } | { error: string }> {
  const { data: profile } = await admin
    .from("profiles")
    .select("buffer_time_minutes, email, vorname, nachname, adresse, payment_method, extern")
    .eq("id", studentUserId)
    .single();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  // ── Externe hängen an einer Vereinbarung, nicht an einem Paket ──
  //
  // Für sie gibt es kein Lektionenkonto, das man belasten könnte: Ihr
  // Unterricht ist über die Plattform vereinbart und wird dort gezählt.
  // Die Paketprüfung unten wäre für sie eine Sackgasse — sie meldete „kein
  // aktives Paket", und das einzige Mittel dagegen (ein Paket anlegen) ist
  // für Externe zu Recht gesperrt. Damit liess sich einem externen Schüler
  // überhaupt kein einzelner Termin eintragen.
  const istExtern = profile?.extern === true;
  let externeVereinbarungId: string | null = null;
  if (istExtern) {
    const { data: v } = await admin
      .from("externe_vereinbarungen")
      .select("id")
      .eq("student_id", studentUserId)
      .eq("aktiv", true)
      .maybeSingle();
    if (!v) {
      return {
        error:
          "Der externe Schüler hat keine aktive Vereinbarung. Bitte zuerst auf der Schülerseite anlegen.",
      };
    }
    externeVereinbarungId = v.id as string;
  }

  let pkg: Paket | null = null;
  if (!istExtern) {
    const { data: pkgs } = await admin
      .from("packages")
      .select("*")
      .eq("student_id", studentUserId)
      .eq("status", "active");
    pkg = (pkgs as Paket[] | null)?.find((p) => !canBuyNewPackage(p)) ?? null;
    if (!pkg) return { error: "Der Schüler hat kein aktives Paket." };

    const state = computePackageState(pkg);
    if (state.lessonsRemaining < lessonsCount) {
      return {
        error: `Das Paket hat nur noch ${state.lessonsRemaining} Lektion(en), benötigt werden ${lessonsCount}.`,
      };
    }
  }

  const desiredStart = new Date(startIso);
  const now = new Date();
  const starts = generateSeriesStarts(desiredStart, lessonsCount, intervalDays);
  const seriesEnd = new Date(
    starts[starts.length - 1].getTime() + LESSON_DURATION_MIN * 60000
  );

  if (opts?.adminOverride) {
    // Nur die Überschneidung prüfen, sonst nichts.
    const slots = slotsFromStarts(starts);
    const { data: bestehende } = await admin
      .from("appointments")
      .select("id, start_at, end_at")
      .eq("status", "booked")
      .lt("start_at", seriesEnd.toISOString())
      .gt("end_at", desiredStart.toISOString());
    for (const s of slots) {
      const konflikt = (bestehende ?? []).find(
        (b) => new Date(b.start_at) < s.end && new Date(b.end_at) > s.start
      );
      if (konflikt) {
        const wann = new Date(konflikt.start_at).toLocaleString("de-CH", {
          timeZone: "Europe/Zurich",
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        return {
          error: `Überschneidet sich mit einem bestehenden Termin (${wann}).`,
        };
      }
    }
  } else {
    const ctx = await loadAvailabilityContext(
      admin,
      studentUserId,
      bufferMin,
      desiredStart,
      seriesEnd,
      now,
      // Hier wird wirklich gebucht: Kalender zwingend frisch holen.
      { skipLeadTime: true, kalenderJetzt: true }
    );
    const validation = validateSeries(desiredStart, lessonsCount, intervalDays, ctx);
    if (!validation.ok) {
      return {
        error:
          "Mindestens ein Termin ist nicht verfügbar (Kollision/Abwesenheit/Zeitblock).",
      };
    }
  }

  const seriesId = lessonsCount > 1 ? crypto.randomUUID() : null;
  const rows = slotsFromStarts(starts).map((s) => ({
    student_id: studentUserId,
    // Genau eines von beiden ist gesetzt. Daran hängt der ganze Rest: Alle
    // Abrechnungswege prüfen das Paket des Termins und überspringen einen
    // externen dadurch von selbst.
    package_id: pkg?.id ?? null,
    externe_vereinbarung_id: externeVereinbarungId,
    start_at: s.start.toISOString(),
    end_at: s.end.toISOString(),
    status: "booked",
    source,
    series_id: seriesId,
  }));

  const { data: created, error } = await admin
    .from("appointments")
    .insert(rows)
    .select("id");
  if (error || !created) return { error: "Termine konnten nicht erstellt werden." };

  // Hinweis: Es werden keine Rechnungen/Zahlungsmails pro Lektion mehr erstellt.
  // Die Abrechnung erfolgt im Voraus über den gesamten Paketpreis beim Paketkauf
  // (siehe createPackageInvoice / buyPackage / createPackageAdmin).

  // Termin-Erinnerungen (24h / 2h vorher) einplanen. Für Externe nicht:
  // Sie haben weder Konto noch Mailadresse, die Erinnerung würde ohnehin
  // an der zentralen Sperre hängenbleiben — dann lieber gar nicht erst
  // einplanen, statt die Warteschlange mit Nachrichten zu füllen, die nie
  // rausgehen.
  if (!istExtern) {
    for (let i = 0; i < created.length; i++) {
      const row = rows[i];
      if (!row) continue;
      await scheduleLessonReminders(admin, {
        id: created[i].id,
        student_id: studentUserId,
        start_at: row.start_at,
      });
    }
  }

  // Google Calendar Sync (one-way, fehlertolerant)
  for (const c of created) {
    await syncAppointmentToCalendar(admin, c.id);
  }

  return { appointmentIds: created.map((c) => c.id) };
}
