"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_BUFFER_MIN,
  LESSON_DURATION_MIN,
  addDaysCal,
  generateSeriesStarts,
  slotsFromStarts,
  utcToZonedDate,
  validateSeries,
  weekdayOf,
  zonedToUtc,
  type CalDate,
} from "@/lib/booking";
import { loadAvailabilityContext } from "@/lib/booking-server";
import { DEFAULT_BLOCK_SETTINGS, gapAwareSlots } from "@/lib/booking-gap";
import { bewerteSlots, type BewerteterSlot } from "@/lib/slot-bewertung";
import { enqueueEmail, sendEmailNow } from "@/lib/emails-outbox";
import {
  createInstalmentSchedule,
  createPackageInvoice,
  issueInstalmentInvoice,
} from "@/lib/package-invoice";
import {
  todayInZurich,
  type SubscriptionType,
} from "@/lib/subscription";
import {
  buildPlanForRhythmus,
  computeRhythmusChange,
  expiryFor,
  rescheduleOpenInstalments,
  RHYTHMUS_LABELS,
  termMonthsForType,
  type BookingMode,
  type Rhythmus,
} from "@/lib/rhythmus";
import { describeFixplatz } from "@/lib/fixplatz";
import { bookFixplatzSeries } from "@/lib/fixplatz-server";
import { meldeAusfall, schliesseOffeneAusfaelle } from "@/lib/ausfall";
import { bieteFrueherenSlotAn } from "@/lib/vorrueck-server";
import {
  EINSTELLUNG_APPLE,
  gleicheAppleKalenderAb,
  trenneAppleKalender,
} from "@/lib/apple-kalender";
import { geocode } from "@/lib/geocoding";
import {
  beendeVereinbarung,
  legeExterneTermineAn,
  setzeExternenTermin,
  type ExterneVereinbarung,
} from "@/lib/externe-server";
import { findeFixplaetze, type FixplatzAngebot } from "@/lib/fixplatz-suche";
import {
  ABO_LABELS,
  aboAusstiegAbrechnung,
  type AusstiegAbrechnung,
} from "@/lib/abo";
import {
  baueVorschau,
  baueVorschauOhneTermin,
  legeMonatsratenAn,
  naechsterPeriodenstart,
  type AboVorschau,
} from "@/lib/abo-server";
import { ladeFenster, ladeZuhause } from "@/lib/routing-server";
import { bookSeriesForStudent } from "@/lib/series-booking";
import {
  type Package as Paket,
  paketBezeichnung,
  PACKAGE_LESSONS,
  canBuyNewPackage,
  canCancelPackage,
  computeCancellationSettlement,
  computePackageState,
} from "@/lib/packages";
import { zurichLocalToIso } from "@/lib/utils";
import { cancelLessonReminders, scheduleLessonReminders } from "@/lib/reminders";
import { travelToBuffer } from "@/lib/gap-slots";
import {
  syncAppointmentToCalendar,
  deleteCalendarEvent,
  testCalendarConnection,
  fullSyncFutureAppointments,
} from "@/lib/google-calendar";

// ── Schüler ──────────────────────────────────────────────────────────────────

/**
 * Stellt sicher, dass der Aufrufer wirklich Admin ist.
 *
 * Die Middleware schützt nur die /admin-Seiten. Server Actions sind darüber
 * hinaus direkt aufrufbar, deshalb muss jede Action, die mit dem
 * Service-Role-Client schreibt, die Rolle selbst prüfen.
 */
async function assertAdmin(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return { error: "Keine Berechtigung." };
  return null;
}

export async function inviteSchueler(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const email = formData.get("email") as string;
  const vorname = formData.get("vorname") as string;
  const nachname = formData.get("nachname") as string;
  const telefon = (formData.get("telefon") as string) || null;
  const adresse = (formData.get("adresse") as string) || null;

  if (!email || !vorname || !nachname) {
    return { error: "E-Mail, Vorname und Nachname sind Pflichtfelder." };
  }

  const adminClient = await createAdminClient();
  const appUrl = BASIS_URL;

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { vorname, nachname },
      redirectTo: `${appUrl}/auth/callback?next=/auth/passwort-setzen`,
    });

  if (inviteError) {
    return { error: inviteError.message };
  }

  const userId = inviteData.user.id;

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    role: "student",
    vorname,
    nachname,
    email,
    telefon,
    adresse,
    aktiv: true,
  }, { onConflict: "id" });

  if (profileError) {
    return { error: "Profil konnte nicht erstellt werden: " + profileError.message };
  }

  revalidatePath("/admin/schueler");
  return { success: true, error: undefined };
}

export async function createSchuelerDirekt(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const email = (formData.get("email") as string)?.trim();
  const vorname = (formData.get("vorname") as string)?.trim();
  const nachname = (formData.get("nachname") as string)?.trim();
  const password = formData.get("password") as string;
  const telefon = (formData.get("telefon") as string) || null;
  const adresse = (formData.get("adresse") as string) || null;

  if (!email || !vorname || !nachname) {
    return { error: "E-Mail, Vorname und Nachname sind Pflichtfelder." };
  }
  if (!password || password.length < 8) {
    return { error: "Passwort muss mindestens 8 Zeichen haben." };
  }

  const adminClient = await createAdminClient();

  const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { vorname, nachname },
  });

  if (createError) {
    return { error: createError.message };
  }

  const userId = userData.user.id;

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    role: "student",
    vorname,
    nachname,
    email,
    telefon,
    adresse,
    aktiv: true,
  }, { onConflict: "id" });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(userId).catch(() => null);
    return { error: "Profil konnte nicht erstellt werden: " + profileError.message };
  }

  revalidatePath("/admin/schueler");
  return { success: true, error: undefined };
}

export async function updateSchueler(id: string, formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const adminClient = await createAdminClient();

  const vorname = formData.get("vorname") as string;
  const nachname = formData.get("nachname") as string;
  const email = formData.get("email") as string;
  const telefon = (formData.get("telefon") as string) || null;
  const adresse = (formData.get("adresse") as string) || null;
  const notizen = (formData.get("notizen") as string) || null;

  const { error } = await adminClient
    .from("profiles")
    .update({ vorname, nachname, email, telefon, adresse, notizen })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${id}`);
  revalidatePath("/admin/schueler");
  return { success: true, error: undefined };
}

export async function deleteSchueler(id: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const adminClient = await createAdminClient();
  // Pending Zahlungsmails abbrechen (scheduled_emails hat kein FK zum Schüler).
  await adminClient
    .from("scheduled_emails")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .contains("payload", { student_id: id });
  const { error } = await adminClient.from("profiles").update({ aktiv: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/schueler");
  revalidatePath(`/admin/schueler/${id}`);
  return { success: true, error: undefined };
}

export async function reactivateSchueler(id: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const adminClient = await createAdminClient();
  const { error } = await adminClient.from("profiles").update({ aktiv: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/schueler");
  revalidatePath(`/admin/schueler/${id}`);
  return { success: true, error: undefined };
}

export async function hardDeleteSchueler(id: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const adminClient = await createAdminClient();

  // Vor dem Löschen aufräumen: scheduled_emails hat kein FK → würde sonst ins Leere senden.
  await adminClient
    .from("scheduled_emails")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .contains("payload", { student_id: id });

  await adminClient
    .from("invoices")
    .update({ status: "archived" })
    .eq("student_id", id)
    .in("status", ["unpaid", "pending_confirmation", "rejected"]);

  await adminClient
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("student_id", id)
    .eq("status", "booked")
    .gte("start_at", new Date().toISOString());

  // Externe haben kein Konto: Bei ihnen gäbe es nichts zu löschen, und der
  // Aufruf schlüge fehl. Ihr Profil wird direkt entfernt, die Termine gehen
  // über die Fremdschlüssel mit.
  const { data: profil } = await adminClient
    .from("profiles")
    .select("extern")
    .eq("id", id)
    .maybeSingle();

  if (profil?.extern === true) {
    const { error } = await adminClient.from("profiles").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/schueler");
    return { success: true, error: undefined };
  }

  // Konto löschen; der Trigger räumt das Profil und damit alle daran
  // hängenden Tabellen weg.
  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) return { error: error.message };

  revalidatePath("/admin/schueler");
  return { success: true, error: undefined };
}

export async function resendInvite(email: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const appUrl = BASIS_URL;
  const adminClient = await createAdminClient();

  // admin.generateLink bypasses PKCE, works across any browser/device.
  // Wichtig: generateLink versendet selbst KEINE E-Mail, der Link muss
  // anschliessend explizit über unseren eigenen Versand (Resend) zugestellt werden.
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/auth/passwort-setzen`,
    },
  });

  if (error) return { error: error.message };

  const actionLink = data?.properties?.action_link;
  if (!actionLink) return { error: "Zugangslink konnte nicht erstellt werden." };

  const { sendEmail } = await import("@/lib/email-sender");
  try {
    await sendEmail({
      to: email,
      subject: "Dein Zugang zum Schülerportal: Klavierunterricht",
      html: `<div style="font-family:sans-serif;padding:24px;background:#f3f4f6;">
        <div style="background:#fff;border-radius:12px;padding:32px;max-width:480px;margin:0 auto;">
          <h2 style="color:#1C244B;margin-top:0;">Dein Zugang zum Schülerportal</h2>
          <p>Hallo</p>
          <p>Über den folgenden Button kannst du dein Passwort setzen und dich anschliessend im Schülerportal anmelden:</p>
          <p style="text-align:center;margin:28px 0;">
            <a href="${actionLink}" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Passwort setzen</a>
          </p>
          <p style="color:#6b7280;font-size:13px;">Der Link ist nur einmal gültig. Falls du ihn nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
          <p style="margin-bottom:0;">Liebe Grüsse<br/>David Ramchandani</p>
        </div>
      </div>`,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  return { success: true, error: undefined };
}


// ── Invoices / Zahlungen ──────────────────────────────────────────────────────

export async function updateInvoiceStatus(
  id: string,
  status: "paid" | "rejected" | "archived"
) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const adminClient = await createAdminClient();

  const update: Record<string, unknown> = { status };
  if (status === "paid") update.paid_at = new Date().toISOString();

  const { error } = await adminClient
    .from("invoices")
    .update(update)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/zahlungen");
  revalidatePath("/admin");
  // Die Abrechnung zählt nach Zahlungseingang — sie ist nach genau dieser
  // Aktion veraltet. Ohne diese Zeile zeigt sie eine gerade bestätigte
  // Zahlung nicht an, und man sucht den Fehler in der Rechnung statt im
  // Zwischenspeicher.
  revalidatePath("/admin/abrechnung");
  return { success: true, error: undefined };
}


/**
 * Stellt eine Rate sofort in Rechnung, auch wenn der Stichtag noch nicht
 * erreicht ist. Nützlich, wenn ein Schüler früher zahlen möchte oder eine
 * Rechnung nachgereicht werden muss.
 *
 * Idempotent: Raten mit bestehender Rechnung werden übersprungen.
 */
export async function issueInstalmentNow(instalmentId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const adminClient = await createAdminClient();

  const { data: inst } = await adminClient
    .from("package_instalments")
    .select("id, package_id, student_id, sequence, kind, amount, due_date, invoice_id, status")
    .eq("id", instalmentId)
    .maybeSingle();

  if (!inst) return { error: "Rate nicht gefunden." };
  if (inst.invoice_id) return { error: "Für diese Rate gibt es bereits eine Rechnung." };
  if (inst.status === "cancelled") return { error: "Diese Rate ist storniert." };

  const { data: pkg } = await adminClient
    .from("packages")
    // abo_variante muss mit: ohne sie stünde auf der Rechnung eines
    // Halbjahresabos „10er-Paket".
    .select(
      "id, student_id, type, total_price, price_per_lesson, payment_method, instalment_count, status, abo_variante"
    )
    .eq("id", inst.package_id)
    .maybeSingle();

  if (!pkg) return { error: "Paket nicht gefunden." };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("vorname, nachname, adresse, email, payment_method")
    .eq("id", inst.student_id)
    .maybeSingle();

  if (!profile) return { error: "Profil nicht gefunden." };

  const result = await issueInstalmentInvoice(adminClient, inst, pkg, profile);
  if ("error" in result) return { error: result.error };

  revalidatePath("/admin/zahlungen");
  revalidatePath(`/admin/schueler/${inst.student_id}`);
  revalidatePath("/admin");
  return { success: true, error: undefined };
}

// ── Verfügbarkeit ─────────────────────────────────────────────────────────────

export type VerfuegbarkeitSlot = {
  wochentag: number;
  beginn_zeit: string;
  ende_zeit: string;
  aktiv: boolean;
  /** Dauer einer Lektion in diesem Block (Minuten). */
  lesson_minutes: number;
  /** Untergrenze für den Puffer zwischen zwei Lektionen (Minuten). */
  min_buffer_minutes: number;
  /** lueckenlos = bündig aneinander; maximal = mehr Auswahl, kleine Löcher. */
  packing: "lueckenlos" | "maximal";
};

export async function updateVerfuegbarkeit(slots: VerfuegbarkeitSlot[]) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const supabase = await createClient();

  // Plausibilität serverseitig prüfen, nie dem Formular vertrauen.
  for (const s of slots) {
    if (s.lesson_minutes < 15 || s.lesson_minutes > 180) {
      return { error: "Die Lektionsdauer muss zwischen 15 und 180 Minuten liegen." };
    }
    if (s.min_buffer_minutes < 0 || s.min_buffer_minutes > 120) {
      return { error: "Der Puffer muss zwischen 0 und 120 Minuten liegen." };
    }
    if (s.aktiv && s.ende_zeit <= s.beginn_zeit) {
      return { error: "Die Endzeit muss nach der Startzeit liegen." };
    }
  }

  // Startpunkte retten, bevor gelöscht wird.
  //
  // Diese Funktion schreibt die Tabelle jedes Mal komplett neu. Das Formular
  // kennt aber nur Zeiten — der Startpunkt pro Wochentag wird woanders
  // gesetzt und ginge beim nächsten Speichern der Zeiten verloren. Ohne
  // Meldung: Die Adresse verschwände, der Planer rechnete wieder ab
  // zuhause, und die Route sähe weiterhin plausibel aus.
  const { data: bisher } = await supabase
    .from("admin_verfuegbarkeit")
    .select("wochentag, start_adresse, start_lat, start_lng");

  const startVon = new Map(
    (bisher ?? []).map((r) => [
      Number(r.wochentag),
      {
        start_adresse: r.start_adresse as string | null,
        start_lat: r.start_lat as number | null,
        start_lng: r.start_lng as number | null,
      },
    ])
  );

  // Delete all existing
  const { error: deleteError } = await supabase
    .from("admin_verfuegbarkeit")
    .delete()
    .gte("wochentag", 0);

  if (deleteError) return { error: deleteError.message };

  if (slots.length > 0) {
    const { error } = await supabase.from("admin_verfuegbarkeit").insert(
      slots.map((s) => ({
        ...s,
        ...(startVon.get(s.wochentag) ?? {}),
      }))
    );
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/verfuegbarkeit");
  return { success: true, error: undefined };
}

// ── Preise ────────────────────────────────────────────────────────────────────

export async function updatePreise(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const supabase = await createClient();

  const typen = ["einzellektion", "10er", "20er"] as const;

  for (const typ of typen) {
    const preis = parseFloat(formData.get(typ) as string);
    if (isNaN(preis)) continue;

    // Try to update existing, or insert
    const { data: existing } = await supabase
      .from("preise")
      .select("id")
      .eq("typ", typ)
      .single();

    if (existing) {
      await supabase
        .from("preise")
        .update({ preis_pro_lektion: preis, aktiv: true })
        .eq("id", existing.id);
    } else {
      await supabase.from("preise").insert({
        typ,
        preis_pro_lektion: preis,
        aktiv: true,
      });
    }
  }

  revalidatePath("/admin/preise");
  return { success: true, error: undefined };
}

// ── Terminanfragen (booking_requests) ───────────────────────────────────────

/**
 * Admin nimmt eine offene Terminanfrage an (Spec §4.1). Erstellt, bei Serien
 * transaktional (alle oder keiner), die Termine im neuen Schema. Validiert
 * vorher mit der Buchungs-Engine (Kollisionen/Abwesenheiten/Zeitblöcke), die
 * 24h-Vorlaufregel wird als Admin-Aktion übersprungen.
 */
export async function acceptBookingRequest(requestId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: req } = await admin
    .from("booking_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!req) return { error: "Anfrage nicht gefunden." };
  if (req.status !== "open") {
    return { error: "Diese Anfrage wurde bereits bearbeitet." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("vorname, nachname, email")
    .eq("id", req.student_id)
    .single();

  // Aktives, nutzbares Paket des Schülers (für freundliche Fehlermeldung)
  const { data: pkgs } = await admin
    .from("packages")
    .select("*")
    .eq("student_id", req.student_id)
    .eq("status", "active");
  const pkg = (pkgs as Paket[] | null)?.find((p) => !canBuyNewPackage(p)) ?? null;
  if (!pkg) return { error: "Der Schüler hat kein aktives Paket." };

  const state = computePackageState(pkg);
  if (state.lessonsRemaining < req.lessons_count) {
    return {
      error: `Das Paket hat nur noch ${state.lessonsRemaining} Lektion(en), benötigt werden ${req.lessons_count}.`,
    };
  }

  const starts = generateSeriesStarts(
    new Date(req.desired_start),
    req.lessons_count,
    req.interval_days
  );

  // Buchung über den gemeinsamen Pfad: erstellt Termine, Rechnungen,
  // geplante Zahlungsmails und synchronisiert den Google-Kalender.
  const result = await bookSeriesForStudent(
    admin,
    req.student_id,
    req.desired_start,
    req.lessons_count,
    req.interval_days,
    "public_request"
  );
  if ("error" in result) {
    return { error: result.error };
  }

  await admin
    .from("booking_requests")
    .update({
      status: "accepted",
      processed_at: new Date().toISOString(),
      created_appointment_ids: result.appointmentIds,
    })
    .eq("id", requestId);

  await sendEmailNow(admin, "booking_confirmed", {
    student_id: req.student_id,
    to: profile?.email,
    starts: starts.map((s) => s.toISOString()),
    lessons_count: req.lessons_count,
    interval_days: req.interval_days,
  });

  revalidatePath("/admin/terminanfragen");
  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  revalidatePath(`/admin/schueler/${req.student_id}`);
  return { success: true, error: undefined };
}

/** Admin lehnt eine Terminanfrage ab (optional mit Begründung). */
export async function rejectBookingRequest(requestId: string, reason?: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: req } = await admin
    .from("booking_requests")
    .select("id, status, student_id")
    .eq("id", requestId)
    .single();

  if (!req) return { error: "Anfrage nicht gefunden." };
  if (req.status !== "open") {
    return { error: "Diese Anfrage wurde bereits bearbeitet." };
  }

  const { error } = await admin
    .from("booking_requests")
    .update({ status: "rejected", processed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { error: "Anfrage konnte nicht abgelehnt werden." };

  await sendEmailNow(admin, "booking_rejected", {
    student_id: req.student_id,
    request_id: requestId,
    reason: reason ?? null,
  });

  revalidatePath("/admin/terminanfragen");
  return { success: true, error: undefined };
}

/**
 * Admin nimmt eine Verschiebungsanfrage an (Meilenstein 6). Validiert den
 * Wunschslot erneut gegen die Engine (24h-Vorlauf übersprungen, eigener Termin
 * ausgenommen) und verschiebt den Termin auf den neuen Zeitpunkt.
 */
export async function acceptReschedule(rescheduleId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: rr } = await admin
    .from("reschedule_requests")
    .select("*")
    .eq("id", rescheduleId)
    .single();

  if (!rr) return { error: "Verschiebung nicht gefunden." };
  if (rr.status !== "open") {
    return { error: "Diese Anfrage wurde bereits bearbeitet." };
  }

  const { data: appt } = await admin
    .from("appointments")
    .select("id, status, start_at")
    .eq("id", rr.appointment_id)
    .single();
  if (!appt) return { error: "Zugehöriger Termin nicht gefunden." };
  if (appt.status !== "booked") {
    return { error: "Der Termin ist nicht mehr verschiebbar." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("buffer_time_minutes, email")
    .eq("id", rr.student_id)
    .single();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  const newStart = new Date(rr.proposed_start);
  const now = new Date();
  const slotEnd = new Date(newStart.getTime() + LESSON_DURATION_MIN * 60000);
  const ctx = await loadAvailabilityContext(
    admin,
    rr.student_id,
    bufferMin,
    newStart,
    slotEnd,
    now,
    // Der Termin wird gleich verschoben: Kalender zwingend frisch holen.
    {
      skipLeadTime: true,
      excludeAppointmentId: rr.appointment_id,
      kalenderJetzt: true,
    }
  );
  const validation = validateSeries(newStart, 1, 7, ctx);
  if (!validation.ok) {
    return {
      error:
        "Der gewünschte neue Zeitpunkt ist nicht mehr verfügbar (Kollision/Abwesenheit).",
    };
  }

  const newEnd = slotsFromStarts([newStart])[0].end;
  const { error: updateError } = await admin
    .from("appointments")
    .update({
      start_at: newStart.toISOString(),
      end_at: newEnd.toISOString(),
    })
    .eq("id", rr.appointment_id);
  if (updateError) {
    return { error: "Termin konnte nicht verschoben werden." };
  }

  // Google Calendar: verschobenen Termin aktualisieren
  await syncAppointmentToCalendar(admin, rr.appointment_id);

  // Erinnerungen auf den neuen Zeitpunkt umplanen.
  await cancelLessonReminders(admin, rr.appointment_id);
  await scheduleLessonReminders(admin, {
    id: rr.appointment_id,
    student_id: rr.student_id,
    start_at: newStart.toISOString(),
  });

  await admin
    .from("reschedule_requests")
    .update({ status: "accepted", aktualisiert_am: new Date().toISOString() })
    .eq("id", rescheduleId);

  await sendEmailNow(admin, "reschedule_confirmed", {
    student_id: rr.student_id,
    to: profile?.email,
    original_start: rr.original_start,
    proposed_start: rr.proposed_start,
  });

  revalidatePath("/admin/terminanfragen");
  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  revalidatePath(`/admin/schueler/${rr.student_id}`);
  return { success: true, error: undefined };
}

/** Admin lehnt eine Verschiebungsanfrage ab (optional mit Begründung). */
export async function rejectReschedule(rescheduleId: string, reason?: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: rr } = await admin
    .from("reschedule_requests")
    .select("id, status, student_id, original_start, proposed_start")
    .eq("id", rescheduleId)
    .single();

  if (!rr) return { error: "Verschiebung nicht gefunden." };
  if (rr.status !== "open") {
    return { error: "Diese Anfrage wurde bereits bearbeitet." };
  }

  const { error } = await admin
    .from("reschedule_requests")
    .update({ status: "rejected", aktualisiert_am: new Date().toISOString() })
    .eq("id", rescheduleId);
  if (error) return { error: "Anfrage konnte nicht abgelehnt werden." };

  await sendEmailNow(admin, "reschedule_rejected", {
    student_id: rr.student_id,
    original_start: rr.original_start,
    proposed_start: rr.proposed_start,
    reason: reason ?? null,
  });

  revalidatePath("/admin/terminanfragen");
  return { success: true, error: undefined };
}

// ── Admin: Preise, Pakete, Direktbuchung, Termine (neues Schema) ─────────────

/** Setzt die Preise & Pufferzeit eines Schülers (profiles). Spec §11.2. */
export async function updateStudentPrices(
  userId: string,
  schuelerId: string,
  formData: FormData
) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const update: Record<string, number | string> = {};
  // Abo-Preise stehen in price_halbjahr/price_jahr, Paketpreise in
  // price_10er/price_20er. Beide werden gepflegt: der Admin entscheidet pro
  // Schüler zwischen Abo und Paket, und beide Wege brauchen einen Preis.
  const fields = [
    "price_single",
    "price_halbjahr",
    "price_jahr",
    "price_10er",
    "price_20er",
    "travel_surcharge",
  ] as const;
  for (const f of fields) {
    const v = parseFloat(formData.get(f) as string);
    if (!isNaN(v) && v >= 0) update[f] = v;
  }
  const buffer = parseInt(formData.get("buffer_time_minutes") as string);
  if (!isNaN(buffer) && buffer >= 1 && buffer <= 120) update.buffer_time_minutes = buffer;

  const bm = formData.get("buffer_mode") as string | null;
  if (bm === "fixed" || bm === "auto") update.buffer_mode = bm;

  // Zahlungsart pro Schüler (TWINT oder QR-Rechnung)
  const pm = formData.get("payment_method") as string | null;
  if (pm === "twint" || pm === "qr") update.payment_method = pm;

  if (Object.keys(update).length === 0) return { success: true, error: undefined };

  const { error } = await admin.from("profiles").update(update).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${schuelerId}`);
  return { success: true, error: undefined };
}

/** Berechnet die Fahrzeit vom Admin-Standort zur Schüleradresse via Google Maps. */
export async function calculateTravelBuffer(
  studentAddress: string
): Promise<{ minutes: number } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { error: "GOOGLE_MAPS_API_KEY nicht konfiguriert." };

  const origin = process.env.ADMIN_HOME_ADDRESS ?? "Sattleracherstrasse 59, 8413 Neftenbach, Schweiz";
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(studentAddress)}&mode=driving&avoid=tolls&region=ch&language=de&key=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { error: "Google Maps API nicht erreichbar." };
    const json = await res.json() as {
      status: string;
      error_message?: string;
      rows: Array<{ elements: Array<{ status: string; duration: { value: number; text: string } }> }>;
    };
    if (json.status !== "OK") {
      console.error("[calculateTravelBuffer] Google Maps Fehlerantwort:", JSON.stringify(json, null, 2));
      if (json.status === "REQUEST_DENIED") {
        return {
          error: `Google Maps: REQUEST_DENIED, wahrscheinlich ist der API-Key eingeschränkt oder die Distance Matrix API ist nicht aktiviert. Details: ${json.error_message ?? "keine weiteren Infos"}`,
        };
      }
      return { error: `Google Maps Fehler: ${json.status}${json.error_message ? `, ${json.error_message}` : ""}` };
    }
    const element = json.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") return { error: "Adresse nicht gefunden." };
    // Sekunden → Minuten, danach auf das Buchungsraster (15 Min) aufrunden.
    // Nur so bleiben die Startzeiten sauber: 20 Minuten Fahrt ergeben einen
    // Puffer von 30 Minuten, nicht 20.
    const rawMin = Math.ceil(element.duration.value / 60);
    const minutes = travelToBuffer(rawMin);
    return { minutes };
  } catch (err) {
    console.error("[calculateTravelBuffer] Unerwarteter Fehler:", err);
    return { error: "Fehler beim Abrufen der Fahrzeit." };
  }
}

/** Admin legt einem Schüler ein Paket an (neues Schema). */
export async function createPackageAdmin(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const userId = formData.get("student_user_id") as string;
  const schuelerId = formData.get("schueler_id") as string;
  const type = formData.get("type") as string; // single|10er|20er
  let paymentMethod = (formData.get("payment_method") as string) || null;
  const pricePerLesson = parseFloat(formData.get("price_per_lesson") as string);

  if (!userId || !["single", "10er", "20er"].includes(type)) {
    return { error: "Ungültige Paketdaten." };
  }
  if (isNaN(pricePerLesson) || pricePerLesson < 0) {
    return { error: "Ungültiger Preis." };
  }

  // Schülerprofil für Zahlungsart + Rechnungsdaten laden.
  const { data: prof } = await admin
    .from("profiles")
    .select("vorname, nachname, adresse, email, payment_method, extern")
    .eq("id", userId)
    .maybeSingle();

  // Externe bekommen nie ein Paket. Sie zahlen über ihre Plattform; ein
  // Paket hier würde Rechnungen erzeugen, QR-PDFs für jemanden ohne
  // Rechnungsadresse, und die Lektion stünde in zwei Abrechnungen
  // gleichzeitig. Ihre Termine hängen an der externen Vereinbarung.
  if (prof?.extern === true) {
    return {
      error:
        "Externe Schüler bekommen kein Paket — ihre Termine laufen über die Vereinbarung.",
    };
  }

  // Ohne explizite Auswahl die Zahlungsart des Schülers übernehmen.
  if (paymentMethod !== "twint" && paymentMethod !== "qr") {
    paymentMethod = (prof?.payment_method as string) ?? "qr";
  }

  const lessonsTotal = PACKAGE_LESSONS[type];
  const startsAt = new Date();
  const startDay = todayInZurich(startsAt);
  const totalPrice = pricePerLesson * lessonsTotal;

  // Rhythmus und Buchungsart, bei einer Einzellektion gibt es beides nicht.
  const istPaket = type !== "single";
  const rhythmus: Rhythmus =
    istPaket && (formData.get("rhythmus") as string) === "zweiwoechentlich"
      ? "zweiwoechentlich"
      : "woechentlich";
  const bookingMode: BookingMode =
    istPaket && (formData.get("booking_mode") as string) === "fix" ? "fix" : "flex";

  const fixWeekdayRaw = formData.get("fixplatz_weekday") as string | null;
  const fixTime = (formData.get("fixplatz_time") as string) || null;
  const fixParityRaw = formData.get("fixplatz_week_parity") as string | null;
  const fixplatz =
    bookingMode === "fix" && fixWeekdayRaw && fixTime
      ? {
          weekday: Number(fixWeekdayRaw),
          time: fixTime,
          parity:
            rhythmus === "zweiwoechentlich" && fixParityRaw
              ? ((Number(fixParityRaw) === 1 ? 1 : 0) as 0 | 1)
              : null,
        }
      : null;

  if (bookingMode === "fix" && !fixplatz) {
    return { error: "Für einen Fixplatz braucht es Wochentag und Uhrzeit." };
  }

  // Laufzeit: bei Paketen nach Rhythmus, bei der Einzellektion unbegrenzt.
  const termMonths = istPaket ? termMonthsForType(type as SubscriptionType, rhythmus) : null;
  const expiresAt = istPaket
    ? new Date(`${expiryFor(lessonsTotal, rhythmus, startDay)}T23:59:59.000Z`)
    : null;

  // Zahlungsmodell, identisch zum Schülerportal. Ratenkauf gibt es nur
  // für 10er/20er, eine Einzellektion wird immer einmalig verrechnet.
  //
  // „pro_lektion" ist der Fall der bestehenden Schüler: Sie zahlen nach
  // dem Unterricht, nicht davor. Beim Anlegen wird deshalb gar nichts
  // fakturiert; abgerechnet wird jede Lektion einzeln, nachdem sie
  // stattgefunden hat.
  const billingModeRoh = formData.get("billing_mode") as string;
  const billingMode =
    billingModeRoh === "raten" && istPaket
      ? "raten"
      : billingModeRoh === "pro_lektion"
        ? "pro_lektion"
        : "einmalig";
  const autoRenew = formData.get("auto_renew") === "on" && istPaket;
  const ratenPlan =
    billingMode === "raten"
      ? buildPlanForRhythmus(
          type as SubscriptionType,
          totalPrice,
          startDay,
          rhythmus
        )
      : null;

  const { data: pkg, error } = await admin
    .from("packages")
    .insert({
      student_id: userId,
      type,
      lessons_total: lessonsTotal,
      lessons_used: 0,
      name: paketBezeichnung({ type }),
      price_per_lesson: pricePerLesson,
      total_price: totalPrice,
      payment_method: paymentMethod,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      status: "active",
      billing_mode: billingMode,
      term_months: termMonths != null ? Math.round(termMonths) : null,
      auto_renew: autoRenew,
      deposit_amount: ratenPlan ? ratenPlan.depositAmount : null,
      instalment_count: ratenPlan ? ratenPlan.instalmentCount : null,
      instalment_amount: ratenPlan ? ratenPlan.instalmentAmount : null,
      rhythmus: istPaket ? rhythmus : null,
      booking_mode: bookingMode,
      fixplatz_weekday: fixplatz?.weekday ?? null,
      fixplatz_time: fixplatz?.time ?? null,
      fixplatz_week_parity: fixplatz?.parity ?? null,
      // Der Admin setzt den Preis von Hand, ein automatischer Flex-Aufschlag
      // würde ihn überschreiben. Darum hier bewusst 0.
      flex_surcharge_percent: 0,
    })
    .select(
      "id, student_id, type, total_price, price_per_lesson, payment_method, instalment_count"
    )
    .single();

  if (error || !pkg) {
    if (error?.code === "23505") {
      return { error: "Dieser Schüler hat bereits ein aktives Paket." };
    }
    return { error: error?.message ?? "Paket konnte nicht erstellt werden." };
  }

  const payer = {
    vorname: prof?.vorname ?? null,
    nachname: prof?.nachname ?? null,
    adresse: prof?.adresse ?? null,
    email: prof?.email ?? null,
    payment_method: prof?.payment_method ?? null,
  };

  if (ratenPlan) {
    // Ratenkauf: Plan anlegen, sofort nur die Anzahlung fakturieren.
    await createInstalmentSchedule(admin, pkg, payer, {
      type: type as SubscriptionType,
      totalPrice,
      startDate: startDay,
      rhythmus,
    });
  } else if (billingMode === "einmalig") {
    // Einmalzahlung: Gesamtpreis sofort in Rechnung stellen (15 Tage Frist).
    await createPackageInvoice(admin, pkg, payer);
  }
  // pro_lektion: hier bewusst nichts. Die Rechnung entsteht erst, wenn eine
  // Lektion gehalten wurde, über „Zahlungen → Offene Lektionen".

  // Paketbestätigung an den Schüler, erklärt, was als Nächstes zu tun ist.
  await sendEmailNow(admin, "package_created", {
    student_id: userId,
    student_name: `${prof?.vorname ?? ""} ${prof?.nachname ?? ""}`.trim() || undefined,
    package_label: paketBezeichnung({ type }),
    lessons_total: lessonsTotal,
    total_price: totalPrice,
    billing_mode: billingMode,
    deposit_amount: ratenPlan?.depositAmount,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    plan: ratenPlan
      ? ratenPlan.entries.map((e) => ({
          label: e.kind === "anzahlung" ? "Anzahlung" : `Rate ${e.sequence}`,
          amount: e.amount,
          dueDate: e.dueDate,
        }))
      : null,
  });

  // Fixplatz: die ganze Serie sofort anlegen, damit der Platz belegt ist und
  // der Schüler nichts mehr einzeln buchen muss.
  if (fixplatz && istPaket) {
    const serie = await bookFixplatzSeries(admin, {
      studentId: userId,
      packageId: pkg.id,
      wunsch: {
        weekday: fixplatz.weekday,
        time: fixplatz.time,
        rhythmus,
        lessons: lessonsTotal,
      },
      parity: fixplatz.parity,
    });

    if (!("error" in serie)) {
      const { data: termine } = await admin
        .from("appointments")
        .select("start_at")
        .in("id", serie.appointmentIds)
        .order("start_at");

      await sendEmailNow(admin, "fixplatz_confirmed", {
        student_id: userId,
        student_name:
          `${prof?.vorname ?? ""} ${prof?.nachname ?? ""}`.trim() || undefined,
        fixplatz_text: describeFixplatz(
          fixplatz.weekday,
          fixplatz.time,
          rhythmus,
          fixplatz.parity
        ),
        termine: (termine ?? []).map((t) => t.start_at as string),
        verschoben: serie.verschoben.map((v) => ({
          original: v.original.toISOString(),
          ersatz: v.ersatz.toISOString(),
        })),
        offen: serie.offen.map((d) => d.toISOString()),
      });
    }
    // Bei einem Fehler bleibt das Paket bestehen, die Lektionen sind
    // gutgeschrieben, nur die Serie fehlt und lässt sich nachtragen.
  }

  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin/zahlungen");
  revalidatePath("/admin/kalender");
  return { success: true, error: undefined };
}

/**
 * Abo für einen Schüler anlegen, dieselbe Rechnung wie im Portal.
 *
 * Bewusst über dieselbe `baueVorschau`, damit im Admin garantiert dieselbe
 * Lektionszahl und derselbe Monatsbetrag herauskommen wie beim
 * Selbstabschluss. Zwei getrennte Rechenwege wären die sichere Quelle für
 * Abweichungen, die niemand bemerkt.
 */
export async function aboAnlegenAdmin(
  formData: FormData
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const studentId = String(formData.get("student_user_id") ?? "");
  const schuelerId = String(formData.get("schueler_id") ?? "");
  const variante = String(formData.get("abo_variante") ?? "halbjahr") as
    | "halbjahr"
    | "jahr";
  const rhythmus: Rhythmus =
    String(formData.get("rhythmus")) === "zweiwoechentlich"
      ? "zweiwoechentlich"
      : "woechentlich";
  const bookingMode: BookingMode =
    String(formData.get("booking_mode")) === "flex" ? "flex" : "fix";
  const autoRenew = formData.get("auto_renew") === "on";

  const fixWeekdayRaw = formData.get("fixplatz_weekday") as string | null;
  const fixTime = (formData.get("fixplatz_time") as string) || null;
  const fixParityRaw = formData.get("fixplatz_week_parity") as string | null;

  if (!studentId) return { error: "Kein Schüler angegeben." };
  if (variante !== "halbjahr" && variante !== "jahr") {
    return { error: "Ungültige Abo-Variante." };
  }

  // Dieselbe Sperre wie beim Paket: Ein Abo für einen externen Schüler
  // würde Monatsraten und Rechnungen erzeugen für Geld, das längst über
  // die Plattform läuft.
  {
    const admin = await createAdminClient();
    const { data: prof } = await admin
      .from("profiles")
      .select("extern")
      .eq("id", studentId)
      .maybeSingle();
    if (prof?.extern === true) {
      return {
        error:
          "Externe Schüler bekommen kein Abo — ihre Termine laufen über die Vereinbarung.",
      };
    }
  }

  // Beim Fixplatz gibt es zwei Wege, und beide sind gleichwertig:
  // den Termin jetzt festlegen, oder ihn der Planung überlassen.
  //
  // Der zweite ist der Regelfall, sobald mehrere Schüler zusammen verplant
  // werden: Wer jeden Termin einzeln von Hand setzt, hat am Ende eine Route,
  // die aus lauter einzeln vernünftigen Entscheidungen besteht und in der
  // Summe trotzdem schlecht ist.
  const terminSpaeter =
    bookingMode === "fix" && String(formData.get("fixplatz_quelle")) === "planung";

  const fixplatz =
    bookingMode === "fix" && !terminSpaeter && fixWeekdayRaw && fixTime
      ? {
          weekday: Number(fixWeekdayRaw),
          time: fixTime,
          parity:
            rhythmus === "zweiwoechentlich" && fixParityRaw
              ? ((Number(fixParityRaw) === 1 ? 1 : 0) as 0 | 1)
              : null,
        }
      : null;

  if (bookingMode === "fix" && !terminSpaeter && !fixplatz) {
    return { error: "Für einen Fixplatz braucht es Wochentag und Uhrzeit." };
  }

  const admin = await createAdminClient();

  const { data: bestehend } = await admin
    .from("packages")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();
  if (bestehend) {
    return { error: "Dieser Schüler hat bereits ein aktives Abo oder Paket." };
  }

  const periodeStart = naechsterPeriodenstart(todayInZurich());

  // Steht der Termin noch nicht fest, wird mit dem *ungünstigsten* möglichen
  // Wochentag gerechnet. Sonst verspräche das Abo eine Lektion mehr, als es
  // an manchen Tagen halten kann, und die fehlte dann am Ende der Periode.
  const vorschau = terminSpaeter
    ? await baueVorschauOhneTermin(admin, {
        studentId,
        variante,
        rhythmus,
        moeglicheTage: (await ladeFenster(admin)).map((f) => f.wochentag),
        periodeStart,
      })
    : await baueVorschau(admin, {
        studentId,
        variante,
        rhythmus,
        bookingMode,
        weekday: fixplatz?.weekday ?? 3,
        periodeStart,
      });

  if (vorschau.lektionen < 1) {
    return { error: "In diesem Zeitraum liegen keine Unterrichtstermine." };
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("vorname, nachname, adresse, email, payment_method")
    .eq("id", studentId)
    .maybeSingle();

  const { data: pkg, error } = await admin
    .from("packages")
    .insert({
      student_id: studentId,
      type: variante === "halbjahr" ? "10er" : "20er",
      lessons_total: vorschau.lektionen,
      lessons_used: 0,
      name: `${ABO_LABELS[variante]} · ${
        rhythmus === "woechentlich" ? "wöchentlich" : "alle zwei Wochen"
      }`,
      price_per_lesson: vorschau.preisProLektion,
      total_price: vorschau.gesamtpreis,
      payment_method: prof?.payment_method ?? "qr",
      starts_at: new Date(`${periodeStart}T00:00:00.000Z`).toISOString(),
      expires_at: new Date(`${vorschau.periodeEnde}T23:59:59.000Z`).toISOString(),
      status: "active",
      billing_mode: "raten",
      term_months: vorschau.laufzeitMonate,
      auto_renew: autoRenew,
      deposit_amount: 0,
      instalment_count: vorschau.laufzeitMonate,
      instalment_amount: vorschau.monatsbetrag,
      rhythmus,
      booking_mode: bookingMode,
      fixplatz_weekday: fixplatz?.weekday ?? null,
      fixplatz_time: fixplatz?.time ?? null,
      fixplatz_week_parity: fixplatz?.parity ?? null,
      flex_surcharge_percent: 0,
      abo_variante: variante,
      abo_lektionen: vorschau.lektionen,
      monatsbetrag: vorschau.monatsbetrag,
      periode_start: periodeStart,
      periode_ende: vorschau.periodeEnde,
    })
    .select("id")
    .single();

  if (error || !pkg) {
    if (error?.code === "23505") return { error: "Es läuft bereits ein Abo." };
    return { error: "Das Abo konnte nicht angelegt werden." };
  }

  const raten = await legeMonatsratenAn(admin, {
    packageId: pkg.id,
    studentId,
    gesamtpreis: vorschau.gesamtpreis,
    laufzeitMonate: vorschau.laufzeitMonate,
    periodeStart,
  });
  if ("error" in raten) {
    console.error("[abo] Monatsraten (Admin):", pkg.id, raten.error);
  }

  let fixplatzText: string | null = null;
  if (fixplatz) {
    fixplatzText = describeFixplatz(
      fixplatz.weekday,
      fixplatz.time,
      rhythmus,
      fixplatz.parity
    );
    const serie = await bookFixplatzSeries(admin, {
      studentId,
      packageId: pkg.id,
      wunsch: {
        weekday: fixplatz.weekday,
        time: fixplatz.time,
        rhythmus,
        lessons: vorschau.lektionen,
      },
      parity: fixplatz.parity,
    });
    if ("error" in serie) {
      console.error("[abo] Fixplatz-Serie (Admin):", pkg.id, serie.error);
    }
  }

  await sendEmailNow(admin, "abo_gestartet", {
    student_id: studentId,
    student_name: `${prof?.vorname ?? ""} ${prof?.nachname ?? ""}`.trim() || undefined,
    abo_label: ABO_LABELS[variante],
    rhythmus_text: rhythmus === "woechentlich" ? "jede Woche" : "alle zwei Wochen",
    fixplatz_text: fixplatzText,
    lektionen: vorschau.lektionen,
    monatsbetrag: vorschau.monatsbetrag,
    laufzeit_monate: vorschau.laufzeitMonate,
    periode_start: periodeStart,
    periode_ende: vorschau.periodeEnde,
    termine: vorschau.termine,
    ferientage: vorschau.ferientage,
    auto_renew: autoRenew,
  });

  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin/kalender");
  revalidatePath("/admin/zahlungen");
  return { success: true, error: undefined };
}

/**
 * Abo vorzeitig beenden, der Ausnahmefall.
 *
 * Der Normalfall ist ein anderer: Wer aufhören will, schaltet die
 * Verlängerung ab und läuft die Periode zu Ende. Diese Aktion ist für den
 * echten Vertragsbruch, Wegzug, längere Krankheit, Kulanz.
 *
 * Angefangene Monate bleiben geschuldet, die restlichen entfallen. Zukünftige
 * Termine werden storniert, noch nicht gestellte Raten der offenen Monate
 * ebenfalls. Was bereits fakturiert ist, bleibt stehen. Eine Rechnung, die
 * draussen ist, schreibt man nicht um.
 */
export async function aboVorzeitigBeenden(
  packageId: string,
  schuelerId: string,
  grund?: string
): Promise<
  | { success: true; error: undefined; abrechnung: AusstiegAbrechnung }
  | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: pkg } = await admin
    .from("packages")
    .select(
      "id, student_id, status, abo_variante, periode_start, periode_ende, term_months, monatsbetrag, total_price"
    )
    .eq("id", packageId)
    .maybeSingle();

  if (!pkg) return { error: "Abo nicht gefunden." };
  if (!pkg.abo_variante) {
    return { error: "Das ist kein Abo, bitte die Paket-Stornierung verwenden." };
  }
  if (pkg.status !== "active") return { error: "Dieses Abo ist nicht aktiv." };

  const heute = todayInZurich();

  const { data: bezahlt } = await admin
    .from("invoices")
    .select("amount")
    .eq("package_id", packageId)
    .eq("status", "paid");
  const bereitsBezahlt = (bezahlt ?? []).reduce(
    (s, r) => s + Number(r.amount ?? 0),
    0
  );

  const abrechnung = aboAusstiegAbrechnung({
    periodeStart: String(pkg.periode_start ?? heute),
    laufzeitMonate: Number(pkg.term_months ?? 6),
    monatsbetrag: Number(pkg.monatsbetrag ?? 0),
    austritt: heute,
    bereitsBezahlt,
    gesamtpreis: Number(pkg.total_price ?? 0),
  });

  // Zukünftige Termine stornieren.
  const { data: kommende } = await admin
    .from("appointments")
    .select("id")
    .eq("package_id", packageId)
    .in("status", ["booked", "pending"])
    .gt("start_at", new Date().toISOString());

  for (const t of kommende ?? []) {
    await admin
      .from("appointments")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", t.id);
    await cancelLessonReminders(admin, t.id);
    await deleteCalendarEvent(admin, t.id);
  }

  // Noch nicht fakturierte Raten der nicht mehr anfallenden Monate schliessen.
  const { data: offeneRaten } = await admin
    .from("package_instalments")
    .select("id, sequence")
    .eq("package_id", packageId)
    .eq("status", "open")
    .is("invoice_id", null);

  for (const r of offeneRaten ?? []) {
    if (Number(r.sequence) > abrechnung.monateBegonnen) {
      await admin
        .from("package_instalments")
        .update({ status: "cancelled", amount: 0 })
        .eq("id", r.id);
    }
  }

  // Offene Ausfälle enden mit dem Abo. Sonst fordert das Portal weiter zum
  // Aussuchen eines Ausweichtermins auf, für ein Abo, das es nicht mehr gibt.
  await schliesseOffeneAusfaelle(admin, packageId);

  await admin
    .from("packages")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      auto_renew: false,
    })
    .eq("id", packageId);

  const { data: prof } = await admin
    .from("profiles")
    .select("vorname, nachname")
    .eq("id", pkg.student_id)
    .maybeSingle();

  await sendEmailNow(admin, "abo_beendet", {
    student_id: pkg.student_id,
    student_name: `${prof?.vorname ?? ""} ${prof?.nachname ?? ""}`.trim() || undefined,
    grund: grund ?? undefined,
    monate_begonnen: abrechnung.monateBegonnen,
    monate_offen: abrechnung.monateOffen,
    geschuldet: abrechnung.geschuldet,
    bereits_bezahlt: abrechnung.bereitsBezahlt,
    nachzahlung: abrechnung.nachzahlung,
    rueckerstattung: abrechnung.rueckerstattung,
    stornierte_termine: (kommende ?? []).length,
  });

  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin/kalender");
  revalidatePath("/admin/zahlungen");
  return { success: true, error: undefined, abrechnung };
}

/**
 * Abo-Vorschau für den Admin, zeigt vor dem Anlegen die exakte
 * Lektionszahl und den Monatsbetrag.
 */
export async function aboVorschauAdmin(params: {
  studentUserId: string;
  variante: "halbjahr" | "jahr";
  rhythmus: Rhythmus;
  bookingMode: BookingMode;
  /** null = Termin steht noch nicht fest. */
  weekday: number | null;
}): Promise<{ vorschau: AboVorschau } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  if (!params.studentUserId) return { error: "Kein Schüler angegeben." };

  const admin = await createAdminClient();
  const periodeStart = naechsterPeriodenstart(todayInZurich());

  // Ohne festen Wochentag über den ungünstigsten möglichen Tag rechnen. Sonst
  // zeigt die Vorschau eine Lektion mehr, als das Abo an manchen Tagen halten
  // kann, und die fehlte am Ende der Periode.
  if (params.weekday == null) {
    const vorschau = await baueVorschauOhneTermin(admin, {
      studentId: params.studentUserId,
      variante: params.variante,
      rhythmus: params.rhythmus,
      moeglicheTage: (await ladeFenster(admin)).map((f) => f.wochentag),
      periodeStart,
    });
    return { vorschau };
  }

  const vorschau = await baueVorschau(admin, {
    studentId: params.studentUserId,
    variante: params.variante,
    rhythmus: params.rhythmus,
    bookingMode: params.bookingMode,
    weekday: params.weekday,
    periodeStart,
  });
  return { vorschau };
}

/**
 * Freie Fixplätze für einen Schüler, dieselbe Suche wie im Portal.
 * Geprüft wird die ganze Serie über die Laufzeit, nicht nur der nächste Termin.
 */
export async function fixplaetzeFuerSchueler(
  studentUserId: string,
  type: "10er" | "20er",
  rhythmus: Rhythmus
): Promise<{ angebote: FixplatzAngebot[] } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  if (!studentUserId) return { error: "Kein Schüler angegeben." };
  if (type !== "10er" && type !== "20er") return { error: "Ungültiger Pakettyp." };

  const admin = await createAdminClient();
  const angebote = await findeFixplaetze(admin, {
    studentId: studentUserId,
    rhythmus: rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich",
    lessons: PACKAGE_LESSONS[type],
  });
  return { angebote };
}

/**
 * Rhythmus eines laufenden Pakets wechseln, in beide Richtungen.
 *
 * Die Restlaufzeit richtet sich nach den **verbleibenden** Lektionen, nicht
 * nach dem Wechselzeitpunkt. Damit ist der Wechsel fair und nicht ausnutzbar:
 * wer kurz vor Ablauf auf zweiwöchentlich wechselt, gewinnt nur die Zeit, die
 * seine Restlektionen wirklich brauchen. Auf den langsameren Rhythmus zu
 * wechseln nimmt nie Zeit weg.
 *
 * Der Preis bleibt unverändert, gleiche Lektionszahl, gleicher Lektionspreis.
 * Noch nicht fakturierte Raten werden über die neue Laufzeit neu verteilt;
 * bereits gestellte Rechnungen bleiben unangetastet.
 */
export async function rhythmusWechseln(
  packageId: string,
  neuerRhythmus: Rhythmus
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: pkg } = await admin
    .from("packages")
    .select(
      "id, student_id, status, rhythmus, expires_at, lessons_total, lessons_used, billing_mode, booking_mode"
    )
    .eq("id", packageId)
    .maybeSingle();

  if (!pkg) return { error: "Paket nicht gefunden." };
  if (pkg.status !== "active") return { error: "Dieses Paket ist nicht aktiv." };

  const alt: Rhythmus =
    pkg.rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich";
  if (alt === neuerRhythmus) {
    return { error: "Dieser Rhythmus ist bereits eingestellt." };
  }
  if (!pkg.expires_at) {
    return { error: "Dieses Paket hat keine Laufzeit, die sich umrechnen liesse." };
  }

  const heute = todayInZurich();
  const offen = Math.max(
    0,
    Number(pkg.lessons_total ?? 0) - Number(pkg.lessons_used ?? 0)
  );

  const wechsel = computeRhythmusChange({
    von: alt,
    nach: neuerRhythmus,
    lessonsRemaining: offen,
    today: heute,
    bisherigesAblaufdatum: String(pkg.expires_at).slice(0, 10),
  });

  await admin
    .from("packages")
    .update({
      rhythmus: neuerRhythmus,
      expires_at: `${wechsel.neuesAblaufdatum}T23:59:59.000Z`,
      term_months: Math.max(1, Math.round(wechsel.restMonate)),
    })
    .eq("id", pkg.id);

  // Offene Raten neu verteilen. Was schon fakturiert oder bezahlt ist, bleibt
  // wie es ist, eine Rechnung, die draussen ist, schreibt man nicht um.
  let ratenAngepasst = false;
  if (pkg.billing_mode === "raten") {
    const { data: raten } = await admin
      .from("package_instalments")
      .select("id, sequence, amount, due_date, status, invoice_id")
      .eq("package_id", pkg.id)
      .eq("status", "open")
      .is("invoice_id", null)
      .order("sequence");

    if (raten && raten.length > 0) {
      const neu = rescheduleOpenInstalments(
        raten.map((r) => ({
          id: r.id,
          sequence: Number(r.sequence),
          amount: Number(r.amount),
          dueDate: String(r.due_date),
        })),
        wechsel.neuesAblaufdatum,
        heute
      );

      for (const r of neu) {
        if (r.neuerBetrag <= 0) {
          // Zusammengelegt, der Betrag steckt jetzt in einer anderen Rate.
          await admin
            .from("package_instalments")
            .update({ status: "cancelled", amount: 0 })
            .eq("id", r.id);
        } else {
          await admin
            .from("package_instalments")
            .update({
              amount: r.neuerBetrag,
              due_date: r.neuesFaelligkeitsdatum,
            })
            .eq("id", r.id);
        }
      }
      ratenAngepasst = true;
    }
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("vorname, nachname")
    .eq("id", pkg.student_id)
    .maybeSingle();

  await sendEmailNow(admin, "rhythmus_changed", {
    student_id: pkg.student_id,
    student_name: `${prof?.vorname ?? ""} ${prof?.nachname ?? ""}`.trim() || undefined,
    alter_rhythmus_text: RHYTHMUS_LABELS[alt],
    neuer_rhythmus_text: RHYTHMUS_LABELS[neuerRhythmus],
    lektionen_offen: offen,
    neues_ablaufdatum: wechsel.neuesAblaufdatum,
    differenz_tage: wechsel.differenzTage,
    raten_angepasst: ratenAngepasst,
  });

  revalidatePath("/admin/schueler");
  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
}

/** Admin bucht direkt (ohne Anfrage), sofort bestätigt. Spec §4.3. */
export async function createDirectBooking(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const userId = formData.get("student_user_id") as string;
  const schuelerId = formData.get("schueler_id") as string;
  const startIso = formData.get("start") as string;
  const lessonsCount = parseInt(formData.get("lessons_count") as string) || 1;
  const intervalDays = parseInt(formData.get("interval_days") as string) || 7;

  if (!userId || !startIso) return { error: "Schüler und Startzeit erforderlich." };

  // Direktbuchung ist der Ausnahme-Weg des Admins: Sie greift an allen
  // Schüler-Regeln vorbei (Zeitfenster, Abwesenheiten, Zeitblöcke). Geprüft
  // wird nur, dass sich nichts mit einem bestehenden Termin überschneidet.
  const result = await bookSeriesForStudent(
    admin,
    userId,
    new Date(startIso).toISOString(),
    lessonsCount,
    intervalDays,
    "direct",
    { adminOverride: true }
  );
  if ("error" in result) return result;

  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  return { success: true, error: undefined };
}

/**
 * Admin schlägt dem Schüler einen Termin/Serie vor (Spec §4, Flow 2).
 * Validiert die Slots gegen die Engine (24h-Vorlauf als Admin übersprungen),
 * legt einen `proposals`-Eintrag (status open) an und mailt dem Schüler. Erst
 * bei dessen Annahme im Portal werden Termine gebucht.
 */
export async function createProposal(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const studentId = formData.get("student_user_id") as string;
  const schuelerId = formData.get("schueler_id") as string;
  const startIso = formData.get("start") as string;
  const lessonsCount = parseInt(formData.get("lessons_count") as string) || 1;
  const intervalDays = parseInt(formData.get("interval_days") as string) || 7;

  if (!studentId || !startIso) {
    return { error: "Schüler und Startzeit erforderlich." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("buffer_time_minutes, email, vorname, nachname")
    .eq("id", studentId)
    .maybeSingle();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  // Slots gegen die Engine prüfen (Admin → kein 24h-Vorlauf).
  const desiredStart = new Date(startIso);
  const now = new Date();
  const starts = generateSeriesStarts(desiredStart, lessonsCount, intervalDays);
  const seriesEnd = new Date(starts[starts.length - 1].getTime() + 3600000);
  const ctx = await loadAvailabilityContext(
    admin,
    studentId,
    bufferMin,
    desiredStart,
    seriesEnd,
    now,
    { skipLeadTime: true }
  );
  const validation = validateSeries(desiredStart, lessonsCount, intervalDays, ctx);
  if (!validation.ok) {
    return {
      error:
        "Mindestens ein vorgeschlagener Termin ist nicht verfügbar (Kollision/Abwesenheit/Zeitblock).",
    };
  }

  const { error } = await admin.from("proposals").insert({
    student_id: studentId,
    proposed_start: desiredStart.toISOString(),
    status: "open",
    lessons_count: lessonsCount,
    interval_days: intervalDays,
  });
  if (error) return { error: "Vorschlag konnte nicht gespeichert werden." };

  if (profile?.email) {
    await sendEmailNow(admin, "proposal_new", {
      student_id: studentId,
      proposed_start: desiredStart.toISOString(),
      lessons_count: lessonsCount,
      interval_days: intervalDays,
    });
  }

  revalidatePath(`/admin/schueler/${schuelerId}`);
  return { success: true, error: undefined };
}

/** Admin zieht einen offenen Terminvorschlag zurück. */
export async function withdrawProposal(proposalId: string, schuelerId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { error } = await admin
    .from("proposals")
    .update({ status: "rejected" })
    .eq("id", proposalId)
    .eq("status", "open");
  if (error) return { error: "Vorschlag konnte nicht zurückgezogen werden." };
  revalidatePath(`/admin/schueler/${schuelerId}`);
  return { success: true, error: undefined };
}

/** Termin als abgeschlossen markieren (neues Schema). */
export async function markAppointmentNoShow(id: string, schuelerId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { error } = await admin
    .from("appointments")
    .update({ status: "no_show" })
    .eq("id", id);
  if (error) return { error: error.message };

  await syncAppointmentToCalendar(admin, id);

  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  return { success: true, error: undefined };
}

/**
 * Termin direkt verschieben (Admin).
 *
 * Der dritte Verschiebeweg neben Schüler-Anfrage und Vorrück-Angebot: David
 * hat mit dem Schüler telefoniert und will den Termin einfach umhängen,
 * ohne Anfrage-Pingpong. Der neue Slot wird gegen die volle Engine geprüft
 * (Kollisionen, Fenster, Sperren, frischer Apple-Kalender); die
 * 24h-Vorlaufregel ist übersprungen, denn hier sitzt ein Mensch, der die
 * Absprache gerade selbst getroffen hat.
 */
export async function moveAppointment(
  id: string,
  schuelerId: string,
  newStartIso: string
) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const newStart = new Date(newStartIso);
  if (Number.isNaN(newStart.getTime())) {
    return { error: "Ungültiger Zeitpunkt." };
  }
  if (newStart <= new Date()) {
    return { error: "Der neue Zeitpunkt liegt in der Vergangenheit." };
  }

  const admin = await createAdminClient();

  const { data: appt } = await admin
    .from("appointments")
    .select("id, status, start_at, student_id")
    .eq("id", id)
    .maybeSingle();
  if (!appt) return { error: "Termin nicht gefunden." };
  if (appt.status !== "booked") {
    return { error: "Nur gebuchte Termine lassen sich verschieben." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("buffer_time_minutes, extern")
    .eq("id", appt.student_id)
    .maybeSingle();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  const now = new Date();
  const slotEnd = new Date(newStart.getTime() + LESSON_DURATION_MIN * 60000);
  const ctx = await loadAvailabilityContext(
    admin,
    appt.student_id,
    bufferMin,
    newStart,
    slotEnd,
    now,
    { skipLeadTime: true, excludeAppointmentId: id, kalenderJetzt: true }
  );
  const validation = validateSeries(newStart, 1, 7, ctx);
  if (!validation.ok) {
    return {
      error:
        "Dieser Zeitpunkt ist nicht frei (Kollision, Sperre oder ausserhalb der Fenster).",
    };
  }

  const newEnd = slotsFromStarts([newStart])[0].end;
  const { error: updateError } = await admin
    .from("appointments")
    .update({
      start_at: newStart.toISOString(),
      end_at: newEnd.toISOString(),
    })
    .eq("id", id);
  if (updateError) return { error: "Der Termin liess sich nicht verschieben." };

  await syncAppointmentToCalendar(admin, id);
  await cancelLessonReminders(admin, id);
  await scheduleLessonReminders(admin, {
    id,
    student_id: appt.student_id,
    start_at: newStart.toISOString(),
  });

  // Der Schüler muss es erfahren — ausser er ist extern, dann fängt die
  // zentrale Sperre in dispatchEmail die Mail ohnehin ab.
  await sendEmailNow(admin, "reschedule_confirmed", {
    student_id: appt.student_id,
    original_start: appt.start_at,
    proposed_start: newStart.toISOString(),
  });

  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  return { success: true, error: undefined };
}

/** Termin stornieren (neues Schema). Gibt die Lektion wieder frei. */
export async function cancelAppointmentNew(id: string, schuelerId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  // Termin laden (für Schüler-Benachrichtigung und Ausfall-Kaskade).
  const { data: appt } = await admin
    .from("appointments")
    .select("start_at, student_id, status, package_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin
    .from("appointments")
    .update({
      status: "cancelled",
      ausfall_verursacher: "admin",
      ausfall_gemeldet_am: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  // Google Calendar: Event löschen
  await deleteCalendarEvent(admin, id);

  // Geplante Termin-Erinnerungen abbrechen.
  await cancelLessonReminders(admin, id);

  // Offene Rechnung zu diesem Termin archivieren + geplante Zahlungsmail abbrechen
  // (Spec §6: bei Terminabsage Rechnung archivieren; Invoice-Status kennt kein "cancelled").
  const { data: cancelledInvoices } = await admin
    .from("invoices")
    .update({ status: "archived" })
    .eq("appointment_id", id)
    .in("status", ["unpaid", "pending_confirmation", "rejected"])
    .select("id");

  // Zahlungsmails via appointment_id abbrechen (deckt auch Fälle ohne invoice_id ab).
  await admin
    .from("scheduled_emails")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .contains("payload", { appointment_id: id });

  if (cancelledInvoices?.length) {
    for (const inv of cancelledInvoices) {
      await admin
        .from("scheduled_emails")
        .update({ status: "cancelled" })
        .eq("status", "pending")
        .contains("payload", { invoice_id: inv.id });
    }
  }

  // Schüler sofort über die Absage informieren (Spec §9).
  if (appt?.student_id && appt.status !== "cancelled") {
    await sendEmailNow(admin, "appointment_cancelled_by_admin", {
      student_id: appt.student_id,
      appointment_id: id,
      start_at: appt.start_at,
    });

    // Ausfall-Kaskade: Ausweichtermine suchen, sonst Laufzeitgutschrift.
    //
    // Bei einer Absage durch die Lehrperson gibt es die 24-Stunden-Ausnahme
    // nicht, die Lektion bleibt in jedem Fall erhalten. Das entscheidet
    // `meldeAusfall`, nicht diese Funktion.
    const ausfall = await meldeAusfall(admin, {
      appointmentId: id,
      studentId: appt.student_id,
      packageId: appt.package_id ?? null,
      verursacher: "admin",
      originalStart: new Date(appt.start_at),
    });
    if ("error" in ausfall) {
      console.error("[ausfall] Kaskade fehlgeschlagen:", id, ausfall.error);
    }

    // Die Lücke weitergeben: den nächsten Schüler desselben Tages fragen,
    // ob er vorrücken mag. Auch bei Absagen durch David selbst — die Lücke
    // ist dieselbe.
    try {
      await bieteFrueherenSlotAn(admin, {
        id,
        start_at: appt.start_at,
        student_id: appt.student_id,
      });
    } catch (e) {
      console.error("[vorrueck] Angebot fehlgeschlagen:", id, e);
    }
  }

  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  return { success: true, error: undefined };
}

// ── Abwesenheiten, Zeitblöcke & Timer (Meilenstein 8) ───────────────────────

/** Inklusive Tage zwischen zwei Datums-Strings (YYYY-MM-DD). */
function inclusiveDays(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const s = Date.UTC(sy, sm - 1, sd);
  const e = Date.UTC(ey, em - 1, ed);
  return Math.round((e - s) / 86400000) + 1;
}

/**
 * Verlängert die Laufzeit eines Pakets um `days` Tage. Bei pausiertem Paket
 * wird die eingefrorene Restzeit erhöht, sonst `expires_at`. Loggt optional
 * in package_extensions (für spätere Rücknahme bei gelöschter Abwesenheit).
 */
async function applyExtensionToPackage(
  admin: SupabaseClient,
  pkg: {
    id: string;
    student_id: string;
    expires_at: string | null;
    paused: boolean;
    pause_remaining_seconds: number | null;
  },
  days: number,
  absenceId: string | null,
  reason: string
) {
  if (days <= 0) return;
  const addSeconds = days * 86400;

  if (pkg.paused) {
    const next = (pkg.pause_remaining_seconds ?? 0) + addSeconds;
    await admin
      .from("packages")
      .update({ pause_remaining_seconds: next })
      .eq("id", pkg.id);
  } else if (pkg.expires_at) {
    const next = new Date(
      new Date(pkg.expires_at).getTime() + addSeconds * 1000
    ).toISOString();
    await admin.from("packages").update({ expires_at: next }).eq("id", pkg.id);
  } else {
    return; // Pakete ohne Ablauf (Einzellektion) werden nicht verlängert
  }

  await admin.from("package_extensions").insert({
    student_id: pkg.student_id,
    package_id: pkg.id,
    absence_id: absenceId,
    days_added: days,
    reason,
  });
}

type ExtendablePackage = {
  id: string;
  student_id: string;
  expires_at: string | null;
  paused: boolean;
  pause_remaining_seconds: number | null;
};

/** Admin/Schüler-Abwesenheit anlegen (Spec §7). */
export async function createAbsence(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const scope = formData.get("scope") as string; // admin | student
  const studentUserId = (formData.get("student_user_id") as string) || null;
  const title = (formData.get("title") as string) || "";
  const startDate = formData.get("start_date") as string;
  const endDate = formData.get("end_date") as string;
  const autoExtend = formData.get("auto_extend") !== "false";

  if (!startDate || !endDate) return { error: "Start- und Enddatum erforderlich." };
  if (scope === "student" && !studentUserId) {
    return { error: "Für eine Schüler-Abwesenheit ist ein Schüler nötig." };
  }
  if (endDate < startDate) return { error: "Enddatum liegt vor dem Startdatum." };

  const { data: absence, error } = await admin
    .from("absences")
    .insert({
      scope,
      student_id: scope === "student" ? studentUserId : null,
      title,
      start_date: startDate,
      end_date: endDate,
      auto_extend: autoExtend,
    })
    .select("id")
    .single();

  if (error || !absence) return { error: "Abwesenheit konnte nicht erstellt werden." };

  if (autoExtend) {
    const days = inclusiveDays(startDate, endDate);
    let query = admin
      .from("packages")
      .select("id, student_id, expires_at, paused, pause_remaining_seconds")
      .eq("status", "active");
    if (scope === "student") query = query.eq("student_id", studentUserId);

    const { data: pkgs } = await query;
    for (const pkg of (pkgs as ExtendablePackage[] | null) ?? []) {
      await applyExtensionToPackage(
        admin,
        pkg,
        days,
        absence.id,
        `Abwesenheit: ${title || (scope === "admin" ? "Admin" : "Schüler")}`
      );
    }
  }

  revalidatePath("/admin/abwesenheiten");
  if (scope === "student" && studentUserId) {
    revalidatePath("/admin/schueler");
  }
  return { success: true, error: undefined };
}

/** Abwesenheit löschen und die Timer-Verlängerung zurückrechnen. */
export async function deleteAbsence(id: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  // Verlängerungen dieser Abwesenheit zurücknehmen
  const { data: logs } = await admin
    .from("package_extensions")
    .select("id, package_id, days_added")
    .eq("absence_id", id);

  for (const log of logs ?? []) {
    const { data: pkg } = await admin
      .from("packages")
      .select("id, expires_at, paused, pause_remaining_seconds")
      .eq("id", log.package_id)
      .single();
    if (!pkg) continue;

    const subSeconds = log.days_added * 86400;
    if (pkg.paused) {
      const next = Math.max(0, (pkg.pause_remaining_seconds ?? 0) - subSeconds);
      await admin
        .from("packages")
        .update({ pause_remaining_seconds: next })
        .eq("id", pkg.id);
    } else if (pkg.expires_at) {
      const next = new Date(
        new Date(pkg.expires_at).getTime() - subSeconds * 1000
      ).toISOString();
      await admin.from("packages").update({ expires_at: next }).eq("id", pkg.id);
    }
    await admin.from("package_extensions").delete().eq("id", log.id);
  }

  const { error } = await admin.from("absences").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/abwesenheiten");
  return { success: true, error: undefined };
}

/** Einmaligen Zeitblock anlegen. */
export async function createTimeBlock(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const title = (formData.get("title") as string) || "";
  const date = formData.get("date") as string;
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;

  if (!date || !startTime || !endTime) return { error: "Alle Felder erforderlich." };
  if (endTime <= startTime) return { error: "Endzeit muss nach Startzeit liegen." };

  const { error } = await admin
    .from("time_blocks")
    .insert({ title, date, start_time: startTime, end_time: endTime });
  if (error) return { error: error.message };

  revalidatePath("/admin/abwesenheiten");
  return { success: true, error: undefined };
}

export async function deleteTimeBlock(id: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { error } = await admin.from("time_blocks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/abwesenheiten");
  return { success: true, error: undefined };
}

/** Wiederkehrende Sperrregel anlegen (alle 7/14 Tage). */
export async function createTimeBlockRule(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const title = (formData.get("title") as string) || "";
  const startDate = formData.get("start_date") as string;
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;
  const intervalDays = parseInt(formData.get("interval_days") as string) || 7;

  if (!startDate || !startTime || !endTime) return { error: "Alle Felder erforderlich." };
  if (endTime <= startTime) return { error: "Endzeit muss nach Startzeit liegen." };
  if (intervalDays !== 7 && intervalDays !== 14) return { error: "Intervall muss 7 oder 14 Tage sein." };

  const { error } = await admin.from("time_block_rules").insert({
    title,
    start_date: startDate,
    start_time: startTime,
    end_time: endTime,
    interval_days: intervalDays,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/abwesenheiten");
  return { success: true, error: undefined };
}

export async function deleteTimeBlockRule(id: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { error } = await admin.from("time_block_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/abwesenheiten");
  return { success: true, error: undefined };
}

/** Paket-Timer pausieren: Restzeit einfrieren. Spec §7. */
export async function pausePackage(packageId: string, schuelerId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { data: pkg } = await admin
    .from("packages")
    .select("id, expires_at, paused")
    .eq("id", packageId)
    .single();
  if (!pkg) return { error: "Paket nicht gefunden." };
  if (pkg.paused) return { success: true, error: undefined };

  const remaining = pkg.expires_at
    ? Math.max(0, Math.floor((new Date(pkg.expires_at).getTime() - Date.now()) / 1000))
    : null;

  const { error } = await admin
    .from("packages")
    .update({
      paused: true,
      pause_remaining_seconds: remaining,
      paused_at: new Date().toISOString(),
    })
    .eq("id", packageId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${schuelerId}`);
  return { success: true, error: undefined };
}

/** Paket-Timer fortsetzen: Ablauf = jetzt + eingefrorene Restzeit. Spec §7. */
export async function resumePackage(packageId: string, schuelerId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { data: pkg } = await admin
    .from("packages")
    .select("id, paused, pause_remaining_seconds")
    .eq("id", packageId)
    .single();
  if (!pkg) return { error: "Paket nicht gefunden." };
  if (!pkg.paused) return { success: true, error: undefined };

  const update: Record<string, unknown> = {
    paused: false,
    pause_remaining_seconds: null,
    paused_at: null,
  };
  if (pkg.pause_remaining_seconds != null) {
    update.expires_at = new Date(
      Date.now() + pkg.pause_remaining_seconds * 1000
    ).toISOString();
  }

  const { error } = await admin.from("packages").update(update).eq("id", packageId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${schuelerId}`);
  return { success: true, error: undefined };
}

/** Paket-Timer manuell um N Tage verlängern. */
export async function extendPackage(
  packageId: string,
  schuelerId: string,
  days: number,
  reason?: string
) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  if (!days || days <= 0) return { error: "Ungültige Anzahl Tage." };
  const admin = await createAdminClient();
  const { data: pkg } = await admin
    .from("packages")
    .select("id, student_id, expires_at, paused, pause_remaining_seconds")
    .eq("id", packageId)
    .single();
  if (!pkg) return { error: "Paket nicht gefunden." };

  await applyExtensionToPackage(
    admin,
    pkg as ExtendablePackage,
    days,
    null,
    reason || "Manuelle Verlängerung"
  );

  revalidatePath(`/admin/schueler/${schuelerId}`);
  return { success: true, error: undefined };
}

/**
 * Storniert ein Paket mit Einzelpreis-Nachberechnung (Spec §10, Meilenstein 10).
 * Erlaubt nur bis einschliesslich der 3. genutzten Lektion. Die genutzten
 * Lektionen werden anhand der tatsächlich gebuchten/abgeschlossenen Termine
 * gezählt; künftige gebuchte Termine dieses Pakets werden storniert. Gibt die
 * berechnete Abrechnung (Rückerstattung/Nachzahlung) zurück.
 */
export async function cancelPackage(packageId: string, schuelerId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: pkg } = await admin
    .from("packages")
    .select("*")
    .eq("id", packageId)
    .single();
  if (!pkg) return { error: "Paket nicht gefunden." };

  // Genutzte Lektionen = tatsächlich gehaltene Lektionen (vergangene booked
  // oder completed). Zukünftige gebuchte Termine werden weiter unten storniert
  // und dürfen NICHT verrechnet werden.
  const { count: usedCount } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("package_id", packageId)
    .in("status", ["booked", "completed"])
    .lte("start_at", new Date().toISOString());
  const lessonsUsed = usedCount ?? 0;

  if (!canCancelPackage(pkg as Paket, lessonsUsed)) {
    return {
      error:
        "Dieses Paket kann nicht mehr storniert werden (nur bis zur 3. genutzten Lektion bei aktiven/pausierten Paketen).",
    };
  }

  // Tatsächlich geflossenes Geld: alle bezahlten Rechnungen dieses Pakets.
  // Bei Ratenzahlung ist das oft nur die Anzahlung, der Paketpreis wäre
  // hier die falsche Bezugsgrösse und würde zu Rückerstattungen auf nie
  // eingegangenes Geld führen.
  const { data: bezahlteRechnungen } = await admin
    .from("invoices")
    .select("amount")
    .eq("package_id", packageId)
    .eq("status", "paid");
  const bereitsBezahlt = (bezahlteRechnungen ?? []).reduce(
    (summe, r) => summe + Number(r.amount ?? 0),
    0
  );

  const settlement = computeCancellationSettlement(
    pkg as Paket,
    lessonsUsed,
    bereitsBezahlt
  );

  // Künftige gebuchte Termine dieses Pakets stornieren.
  const { data: futureAppts } = await admin
    .from("appointments")
    .select("id")
    .eq("package_id", packageId)
    .eq("status", "booked")
    .gte("start_at", new Date().toISOString());
  if (futureAppts && futureAppts.length > 0) {
    const ids = futureAppts.map((a) => a.id);
    await admin.from("appointments").update({ status: "cancelled" }).in("id", ids);
    // Google-Events der stornierten Termine löschen
    for (const fid of ids) {
      await deleteCalendarEvent(admin, fid);
    }
    // Zugehörige offene Rechnungen archivieren (Invoice-Status kennt kein "cancelled")
    const { data: archivedInvoices } = await admin
      .from("invoices")
      .update({ status: "archived" })
      .in("appointment_id", ids)
      .in("status", ["unpaid", "pending_confirmation", "rejected"])
      .select("id");
    // Geplante Zahlungsmails dieser Rechnungen abbrechen (Payload trägt invoice_id)
    for (const inv of archivedInvoices ?? []) {
      await admin
        .from("scheduled_emails")
        .update({ status: "cancelled" })
        .eq("status", "pending")
        .contains("payload", { invoice_id: inv.id });
    }
  }

  // Noch nicht bezahlte Raten stilllegen. Ohne das würde der Tagesjob für
  // ein storniertes Paket weiter Monatsrechnungen erzeugen, und die offenen
  // Beträge liefen in der Admin-Übersicht als "ausstehend" mit.
  const { data: offeneRaten } = await admin
    .from("package_instalments")
    .update({ status: "cancelled" })
    .eq("package_id", packageId)
    .in("status", ["open", "invoiced", "overdue"])
    .select("id, invoice_id");

  for (const rate of offeneRaten ?? []) {
    if (!rate.invoice_id) continue;
    // Bereits gestellte, unbezahlte Ratenrechnungen archivieren …
    await admin
      .from("invoices")
      .update({ status: "archived" })
      .eq("id", rate.invoice_id)
      .in("status", ["unpaid", "pending_confirmation", "rejected"]);
    // … und die zugehörigen Zahlungsmails abbrechen.
    await admin
      .from("scheduled_emails")
      .update({ status: "cancelled" })
      .eq("status", "pending")
      .contains("payload", { invoice_id: rate.invoice_id });
  }

  // Alles, was an diesem Paket sonst noch offen hängt, ebenfalls stilllegen.
  //
  // Die beiden Schritte oben fassen nur Rechnungen an, die an einem Termin
  // oder an einer Rate hängen. Eine Rechnung über das Paket selbst — beim
  // Einmalkauf also der volle Betrag — hat weder das eine noch das andere
  // und blieb deshalb offen stehen. Im Schülerportal las sich das als
  // Forderung über ein Paket, das es nicht mehr gibt.
  //
  // Gefunden an einem echten Fall: CHF 700 für ein storniertes 10er-Paket.
  //
  // Muss vor dem Anlegen der Storno-Rechnung geschehen, sonst würde die
  // gleich wieder mit archiviert.
  const { data: restlicheRechnungen } = await admin
    .from("invoices")
    .update({ status: "archived" })
    .eq("package_id", packageId)
    .in("status", ["unpaid", "pending_confirmation", "rejected"])
    .select("id");
  for (const inv of restlicheRechnungen ?? []) {
    await admin
      .from("scheduled_emails")
      .update({ status: "cancelled" })
      .eq("status", "pending")
      .contains("payload", { invoice_id: inv.id });
  }

  // Offene Ausfälle enden mit dem Paket, siehe schliesseOffeneAusfaelle.
  await schliesseOffeneAusfaelle(admin, packageId);

  const { error } = await admin
    .from("packages")
    .update({
      status: "cancelled",
      auto_renew: false,
      paused: false,
      pause_remaining_seconds: null,
      paused_at: null,
      aktualisiert_am: new Date().toISOString(),
    })
    .eq("id", packageId);
  if (error) return { error: "Paket konnte nicht storniert werden." };

  // Schüler sofort benachrichtigen.
  const { data: profile } = await admin
    .from("profiles")
    .select("email, vorname, nachname, adresse, payment_method")
    .eq("id", pkg.student_id)
    .maybeSingle();
  await sendEmailNow(admin, "package_cancelled", {
    student_id: pkg.student_id,
    to: profile?.email,
    lessons_used: settlement.lessonsUsed,
    single_lesson_price: settlement.singleLessonPrice,
    refund: settlement.refund,
    owed: settlement.owed,
  });

  // Nachzahlung: zahlbare Storno-Rechnung anlegen, damit der Schüler sie über
  // das normale Zahlungssystem (TWINT/QR) begleichen kann (sofort fällig).
  if (settlement.owed > 0) {
    const paymentMethod: "twint" | "qr" =
      ((profile?.payment_method as "twint" | "qr" | null) ??
        (pkg.payment_method as "twint" | "qr" | null)) ??
      "qr";
    const studentName = profile
      ? `${profile.vorname} ${profile.nachname}`
      : "Schüler";
    const { data: inv } = await admin
      .from("invoices")
      .insert({
        student_id: pkg.student_id,
        appointment_id: null,
        amount: settlement.owed,
        payer_name: studentName,
        payer_address: profile?.adresse ?? null,
        status: "unpaid",
        method: paymentMethod,
        lesson_date: null,
        description: "Stornierung, Restbetrag",
      })
      .select("id, invoice_number")
      .maybeSingle();

    if (inv && profile?.email) {
      const basePayload = {
        to: profile.email,
        student_name: studentName,
        student_id: pkg.student_id,
        amount: settlement.owed,
        invoice_number: inv.invoice_number,
        invoice_id: inv.id,
      };
      if (paymentMethod === "qr") {
        await enqueueEmail(admin, "qr_invoice", basePayload);
      } else {
        // twint_link wird beim Versand aus Betrag + Lektionsdatum gebaut.
        await enqueueEmail(admin, "twint_payment_request", basePayload);
      }
    }
  }

  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin");
  return { success: true, error: undefined, settlement };
}

// ── Rechnungen / Zahlungen (Meilenstein 9) ────────────────────────────────────

/**
 * Erstellt eine Rechnung für einen Termin (neues Schema). Wird intern beim
 * Buchen aufgerufen; kann auch manuell ausgelöst werden.
 */
export async function createInvoiceForAppointment(appointmentId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: appt } = await admin
    .from("appointments")
    .select("id, student_id, start_at, end_at, package_id")
    .eq("id", appointmentId)
    .single();
  if (!appt) return { error: "Termin nicht gefunden." };

  const { data: profile } = await admin
    .from("profiles")
    .select("vorname, nachname, email, adresse, payment_method")
    .eq("id", appt.student_id)
    .maybeSingle();

  const { data: pkg } = await admin
    .from("packages")
    .select("price_per_lesson, payment_method")
    .eq("id", appt.package_id ?? "")
    .maybeSingle();

  const amount = Number(pkg?.price_per_lesson ?? 85);
  // Das Profil entscheidet, nicht das Paket. Der Paketwert ist eine
  // Momentaufnahme vom Anlegen; ändert der Admin die Zahlungsart beim
  // Schüler, muss die nächste Rechnung ihr folgen.
  const paymentMethod = zahlungsartFuer(profile, pkg);

  // invoice_number kommt aus dem DB-Default (fortlaufende Sequenz PIANO-{Jahr}-{NNNN}).
  const { data: inv, error } = await admin
    .from("invoices")
    .insert({
      student_id: appt.student_id,
      appointment_id: appointmentId,
      // Ohne package_id findet die Paketstornierung diese Rechnung nicht und
      // lässt sie offen stehen.
      package_id: appt.package_id ?? null,
      amount,
      payer_name: profile ? `${profile.vorname} ${profile.nachname}` : null,
      payer_address: profile?.adresse ?? null,
      status: "unpaid",
      method: paymentMethod,
      lesson_date: appt.start_at,
    })
    .select("id")
    .single();

  if (error || !inv) {
    // 23505 = der Unique-Index invoices_one_active_per_appointment.
    // Für diesen Termin gibt es bereits eine offene Rechnung.
    if (error?.code === "23505") {
      return { error: "Für diesen Termin besteht bereits eine Rechnung." };
    }
    return { error: "Rechnung konnte nicht erstellt werden." };
  }

  revalidatePath("/admin/zahlungen");
  return { success: true, error: undefined, invoiceId: inv.id };
}

/** Admin bestätigt eine Zahlung (pending_confirmation → paid). */
export async function confirmInvoicePayment(invoiceId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: inv } = await admin
    .from("invoices")
    .select(
      "id, student_id, invoice_number, amount, lesson_date, package_id, instalment_id, description"
    )
    .eq("id", invoiceId)
    .single();
  if (!inv) return { error: "Rechnung nicht gefunden." };

  const { error } = await admin
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { error: error.message };

  const { data: profile } = await admin
    .from("profiles")
    .select("email, vorname, nachname")
    .eq("id", inv.student_id)
    .maybeSingle();

  if (profile?.email) {
    // Eine Stornoabrechnung erkennt man daran, dass sie an nichts hängt:
    // keine Lektion, kein Paket, keine Rate. Früher wurde nur auf ein
    // fehlendes Lektionsdatum geprüft, seit es Paket- und Ratenrechnungen
    // gibt, landeten die fälschlich in der Stornierungsmail.
    const isSettlement =
      !inv.lesson_date && !inv.package_id && !inv.instalment_id;

    if (isSettlement) {
      await sendEmailNow(admin, "package_settlement_paid", {
        student_id: inv.student_id,
        amount: inv.amount,
      });
    } else {
      // Wurde die Anzahlung eines Ratenpakets bestätigt, ist damit auch die
      // Terminbuchung freigegeben, das gehört in die Bestätigung.
      let unlocksBooking = false;
      if (inv.instalment_id) {
        const { data: rate } = await admin
          .from("package_instalments")
          .select("kind")
          .eq("id", inv.instalment_id)
          .maybeSingle();
        unlocksBooking = rate?.kind === "anzahlung";
      }

      await sendEmailNow(admin, "payment_confirmed", {
        to: profile.email,
        student_name: `${profile.vorname} ${profile.nachname}`,
        student_id: inv.student_id,
        lesson_date: inv.lesson_date,
        amount: inv.amount,
        invoice_number: inv.invoice_number,
        description: inv.description,
        unlocks_booking: unlocksBooking,
      });
    }
  }

  revalidatePath("/admin/zahlungen");
  // Setzt `paid_at` — und genau danach rechnet die Abrechnung. Ohne diese
  // Zeile fehlt eine gerade bestätigte Zahlung dort, bis irgendetwas
  // anderes die Seite auffrischt.
  revalidatePath("/admin/abrechnung");
  return { success: true, error: undefined };
}

/** Admin lehnt eine Zahlung ab (pending_confirmation → rejected). */
export async function rejectInvoicePayment(invoiceId: string, reason?: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: inv } = await admin
    .from("invoices")
    .select("id, student_id, invoice_number, amount, lesson_date, description")
    .eq("id", invoiceId)
    .single();
  if (!inv) return { error: "Rechnung nicht gefunden." };

  const { error } = await admin
    .from("invoices")
    .update({ status: "rejected" })
    .eq("id", invoiceId);
  if (error) return { error: error.message };

  const { data: profile } = await admin
    .from("profiles")
    .select("email, vorname, nachname")
    .eq("id", inv.student_id)
    .maybeSingle();

  if (profile?.email) {
    await sendEmailNow(admin, "payment_rejected", {
      to: profile.email,
      student_name: `${profile.vorname} ${profile.nachname}`,
      student_id: inv.student_id,
      lesson_date: inv.lesson_date,
      amount: inv.amount,
      invoice_number: inv.invoice_number,
      description: inv.description,
      reason: reason ?? null,
    });
  }

  revalidatePath("/admin/zahlungen");
  return { success: true, error: undefined };
}

/** Admin archiviert eine Rechnung (aus der aktiven Liste entfernen). */
export async function archiveInvoice(invoiceId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ status: "archived" })
    .eq("id", invoiceId);
  if (error) return { error: error.message };
  revalidatePath("/admin/zahlungen");
  return { success: true, error: undefined };
}

/** Admin sendet die Zahlungsmail für eine Rechnung erneut (sofort). */
export async function resendPaymentEmail(invoiceId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: inv } = await admin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (!inv) return { error: "Rechnung nicht gefunden." };

  const { data: profile } = await admin
    .from("profiles")
    .select("email, vorname, nachname")
    .eq("id", inv.student_id)
    .maybeSingle();
  if (!profile?.email) return { error: "Schüler-E-Mail nicht gefunden." };

  const studentName = `${profile.vorname} ${profile.nachname}`;

  if (inv.method === "qr") {
    await sendEmailNow(admin, "qr_invoice", {
      to: profile.email,
      student_name: studentName,
      student_id: inv.student_id,
      lesson_date: inv.lesson_date,
      amount: inv.amount,
      invoice_number: inv.invoice_number,
      invoice_id: invoiceId,
    });
  } else {
    // twint_link wird beim Versand aus Betrag + Lektionsdatum gebaut.
    await sendEmailNow(admin, "twint_payment_request", {
      to: profile.email,
      student_name: studentName,
      student_id: inv.student_id,
      lesson_date: inv.lesson_date,
      amount: inv.amount,
      invoice_number: inv.invoice_number,
      invoice_id: invoiceId,
    });
  }

  revalidatePath("/admin/zahlungen");
  return { success: true, error: undefined };
}

/**
 * Lektion abrechnen: Rechnung erstellen **und** die Zahlungsmail sofort
 * verschicken.
 *
 * Beide Hälften gab es schon, nur nicht verbunden und nirgends anklickbar:
 * `createInvoiceForAppointment` wurde im ganzen Projekt kein einziges Mal
 * aufgerufen. Für den Alltag ist das aber der übliche Vorgang, gerade
 * während der Umstellung: Lektion war, Rechnung raus.
 *
 * Ohne diese Aktion müsste man auf den Tageslauf warten. Der läuft auf dem
 * Hobby-Tarif nur einmal täglich und trifft die Uhrzeit auf eine Stunde
 * genau. Wer nach dem Unterricht im Auto sitzt und die Zahlung anstossen
 * will, wartet damit bis zum nächsten Morgen.
 *
 * Ob TWINT oder QR-Rechnung entsteht, ergibt sich aus der Zahlungsart des
 * Pakets. Das wird hier nicht noch einmal entschieden.
 */
export async function abrechnenUndSenden(appointmentId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const rechnung = await createInvoiceForAppointment(appointmentId);
  if (rechnung.error || !("invoiceId" in rechnung) || !rechnung.invoiceId) {
    return { error: rechnung.error ?? "Rechnung konnte nicht erstellt werden." };
  }

  // Der Versand darf die schon erstellte Rechnung nicht zunichtemachen.
  // Scheitert er, bleibt sie bestehen und lässt sich über „Mail erneut
  // senden" nachschicken — das ist besser, als beides zu verlieren.
  const versand = await resendPaymentEmail(rechnung.invoiceId);
  if (versand.error) {
    return {
      error: `Rechnung erstellt, aber die Mail ging nicht raus: ${versand.error}`,
      invoiceId: rechnung.invoiceId,
    };
  }

  revalidatePath("/admin/zahlungen");
  return { success: true, error: undefined, invoiceId: rechnung.invoiceId };
}

// ── Aufräumen / Löschen ───────────────────────────────────────────────────────

/** Erledigte Buchungsanfrage (nicht open) endgültig löschen. */
export async function deleteBookingRequest(requestId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("booking_requests")
    .select("status")
    .eq("id", requestId)
    .single();
  if (!req) return { error: "Nicht gefunden." };
  if (req.status === "open") return { error: "Offene Anfragen können nicht gelöscht werden." };
  const { error } = await admin.from("booking_requests").delete().eq("id", requestId);
  if (error) return { error: error.message };
  revalidatePath("/admin/terminanfragen");
  return { success: true, error: undefined };
}

/** Erledigte Verschiebungsanfrage (nicht open) endgültig löschen. */
export async function deleteRescheduleRequest(rescheduleId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = createAdminClient();
  const { data: rr } = await admin
    .from("reschedule_requests")
    .select("status")
    .eq("id", rescheduleId)
    .single();
  if (!rr) return { error: "Nicht gefunden." };
  if (rr.status === "open") return { error: "Offene Anfragen können nicht gelöscht werden." };
  const { error } = await admin.from("reschedule_requests").delete().eq("id", rescheduleId);
  if (error) return { error: error.message };
  revalidatePath("/admin/terminanfragen");
  return { success: true, error: undefined };
}

/** Alle erledigten Buchungs- und Verschiebungsanfragen auf einmal löschen. */
export async function bulkDeleteProcessedRequests() {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = createAdminClient();
  await Promise.all([
    admin.from("booking_requests").delete().neq("status", "open"),
    admin.from("reschedule_requests").delete().neq("status", "open"),
  ]);
  revalidatePath("/admin/terminanfragen");
  return { success: true, error: undefined };
}

/** Einzelne archivierte/stornierte Rechnung endgültig löschen. */
export async function hardDeleteInvoice(invoiceId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();
  if (!inv) return { error: "Nicht gefunden." };
  if (!["archived", "cancelled"].includes(inv.status)) {
    return { error: "Nur archivierte oder stornierte Rechnungen können gelöscht werden." };
  }
  const { error } = await admin.from("invoices").delete().eq("id", invoiceId);
  if (error) return { error: error.message };
  revalidatePath("/admin/zahlungen");
  return { success: true, error: undefined };
}

/** Alle archivierten Rechnungen auf einmal löschen (Papierkorb leeren). */
export async function deleteArchivedInvoices() {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = createAdminClient();
  const { error } = await admin.from("invoices").delete().eq("status", "archived");
  if (error) return { error: error.message };
  revalidatePath("/admin/zahlungen");
  return { success: true, error: undefined };
}

/** Sendet eine Test-E-Mail an ADMIN_EMAIL zur Überprüfung der Resend-Konfiguration. */
export async function sendTestEmail() {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const to = process.env.ADMIN_EMAIL;
  if (!to) {
    return { error: "Umgebungsvariable ADMIN_EMAIL ist nicht gesetzt." };
  }
  const { sendEmail } = await import("@/lib/email-sender");
  try {
    await sendEmail({
      to,
      subject: "✓ Test-E-Mail: Klavierunterricht System",
      html: `<div style="font-family:sans-serif;padding:24px;background:#f3f4f6;">
        <div style="background:#fff;border-radius:8px;padding:24px;max-width:480px;">
          <h2 style="color:#1C244B;margin-top:0;">Test-E-Mail</h2>
          <p>Der E-Mail-Versand über Resend funktioniert korrekt.</p>
          <p style="color:#6b7280;font-size:13px;">Zeitstempel: ${new Date().toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}</p>
        </div>
      </div>`,
    });
    return { success: true as const, to };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Google Calendar (Meilenstein 12) ─────────────────────────────────────────

/** Testet die Verbindung zum Google-Kalender (Einstellungsseite). */
export async function testGoogleCalendar() {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  return await testCalendarConnection();
}

/** Synchronisiert alle zukünftigen gebuchten Termine in den Google-Kalender. */
export async function runFullCalendarSync() {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const result = await fullSyncFutureAppointments(admin);
  revalidatePath("/admin/einstellungen");
  return { success: true, error: undefined, ...result };
}

// ── Anfragen ─────────────────────────────────────────────────────────────────

export async function updateAnfrageStatus(id: string, status: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const supabase = await createClient();
  const { error } = await supabase
    .from("anfragen")
    .update({ status })
    .eq("id", id);
  if (error) return { error: "Status konnte nicht aktualisiert werden." };
  revalidatePath("/admin/anfragen");
  return { success: true, error: undefined };
}

// ── Gruppenkurse ─────────────────────────────────────────────────────────────

import {
  recomputeSessionDuration,
  adminCreateGroupSessions,
} from "@/lib/group-booking";
import { normalizePriceTiers } from "@/lib/group-courses";
import { BASIS_URL } from "@/lib/seo";
import { zahlungsartFuer } from "@/lib/zahlungsart";

export async function createGroupCourse(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "Titel erforderlich." };

  const maxParticipants = Number(formData.get("max_participants") ?? 4);
  const longDurationFrom = Number(formData.get("long_duration_from") ?? 3);
  const shortMinutes = Number(formData.get("short_minutes") ?? 45);
  const longMinutes = Number(formData.get("long_minutes") ?? 90);
  const description = (formData.get("description") as string)?.trim() || null;

  let priceTiers: Record<string, number>;
  try {
    priceTiers = normalizePriceTiers(JSON.parse(formData.get("price_tiers") as string ?? "{}"));
  } catch {
    return { error: "Ungültige Preis-Tiers (JSON erwartet)." };
  }
  if (Object.keys(priceTiers).length === 0) return { error: "Mindestens ein Preis-Tier erforderlich." };

  const admin = await createAdminClient();
  const { error } = await admin.from("group_courses").insert({
    title,
    description,
    max_participants: maxParticipants,
    long_duration_from: longDurationFrom,
    short_minutes: shortMinutes,
    long_minutes: longMinutes,
    price_tiers: priceTiers,
    status: "active",
  });
  if (error) return { error: "Kurs konnte nicht erstellt werden." };

  revalidatePath("/admin/gruppenkurse");
  return { success: true, error: undefined };
}

export async function updateGroupCourse(courseId: string, formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const title = (formData.get("title") as string)?.trim();
  if (!title) return { error: "Titel erforderlich." };

  let priceTiers: Record<string, number>;
  try {
    priceTiers = normalizePriceTiers(JSON.parse(formData.get("price_tiers") as string ?? "{}"));
  } catch {
    return { error: "Ungültige Preis-Tiers (JSON erwartet)." };
  }

  const admin = await createAdminClient();
  const { error } = await admin.from("group_courses").update({
    title,
    description: (formData.get("description") as string)?.trim() || null,
    max_participants: Number(formData.get("max_participants")),
    long_duration_from: Number(formData.get("long_duration_from")),
    short_minutes: Number(formData.get("short_minutes")),
    long_minutes: Number(formData.get("long_minutes")),
    price_tiers: priceTiers,
  }).eq("id", courseId);
  if (error) return { error: "Kurs konnte nicht aktualisiert werden." };

  revalidatePath("/admin/gruppenkurse");
  revalidatePath(`/admin/gruppenkurse/${courseId}`);
  return { success: true, error: undefined };
}

export async function archiveGroupCourse(courseId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { error } = await admin.from("group_courses").update({ status: "archived" }).eq("id", courseId);
  if (error) return { error: "Kurs konnte nicht archiviert werden." };
  revalidatePath("/admin/gruppenkurse");
  return { success: true, error: undefined };
}

export async function planGroupSessions(courseId: string, formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const date = (formData.get("date") as string)?.trim();
  const time = (formData.get("time") as string)?.trim();
  if (!date || !time) return { error: "Datum und Uhrzeit erforderlich." };

  // Lokale Zürcher Zeit → UTC-Instant.
  const startIso = zurichLocalToIso(date, time);
  if (!startIso) return { error: "Ungültiges Datum/Uhrzeit." };

  const count = Math.max(1, Math.min(52, Number(formData.get("count") ?? 1)));
  const intervalDays = Number(formData.get("interval_days") ?? 7) === 14 ? 14 : 7;

  const admin = await createAdminClient();
  const result = await adminCreateGroupSessions(admin, courseId, startIso, count, intervalDays);
  if ("error" in result) return result;

  revalidatePath("/admin/gruppenkurse");
  revalidatePath(`/admin/gruppenkurse/${courseId}`);
  return result;
}

export async function adminCancelGroupSession(sessionId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  // Teilnehmer-Termine laden.
  const { data: appts } = await admin
    .from("appointments")
    .select("id, student_id, google_event_id")
    .eq("group_session_id", sessionId)
    .in("status", ["booked", "pending"]);

  // Alle Teilnehmer-Termine absagen.
  for (const a of appts ?? []) {
    await admin.from("appointments").update({ status: "cancelled" }).eq("id", a.id);
    if (a.google_event_id) {
      await deleteCalendarEvent(admin, a.id).catch(() => null);
    }
  }

  // Pending Payment-Mails canceln.
  await admin
    .from("scheduled_emails")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .contains("payload", { group_session_id: sessionId });

  // Session absagen.
  const { error } = await admin
    .from("group_sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId);
  if (error) return { error: "Session konnte nicht abgesagt werden." };

  // Teilnehmer benachrichtigen.
  for (const a of appts ?? []) {
    await sendEmailNow(admin, "appointment_cancelled_by_admin", {
      student_id: a.student_id,
    }).catch(() => null);
  }

  revalidatePath("/admin/gruppenkurse");
  return { success: true, error: undefined };
}

export async function adminRemoveParticipant(appointmentId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: appt } = await admin
    .from("appointments")
    .select("id, student_id, group_session_id, google_event_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt?.group_session_id) return { error: "Termin nicht gefunden." };

  const sessionId = appt.group_session_id as string;

  // Termin absagen.
  await admin.from("appointments").update({ status: "cancelled" }).eq("id", appointmentId);

  // Google-Kalender-Event löschen.
  if (appt.google_event_id) {
    await deleteCalendarEvent(admin, appointmentId).catch(() => null);
  }

  // Pending Payment-Mail für diesen Termin canceln.
  await admin
    .from("scheduled_emails")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .contains("payload", { appointment_id: appointmentId });

  // Session + andere Teilnehmer-Termine neu berechnen.
  const { data: session } = await admin
    .from("group_sessions")
    .select("id, course_id, start_at, end_at, status")
    .eq("id", sessionId)
    .maybeSingle();
  const { data: course } = session
    ? await admin.from("group_courses").select("*").eq("id", session.course_id).maybeSingle()
    : { data: null };

  if (session && course) {
    const remaining = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("group_session_id", sessionId)
      .in("status", ["booked", "completed"]);

    if ((remaining.count ?? 0) === 0) {
      await admin.from("group_sessions").update({ status: "cancelled" }).eq("id", sessionId);
    } else {
      await recomputeSessionDuration(admin, session as Parameters<typeof recomputeSessionDuration>[1], course as Parameters<typeof recomputeSessionDuration>[2]);
    }
  }

  // Schüler benachrichtigen.
  await sendEmailNow(admin, "appointment_cancelled_by_admin", {
    student_id: appt.student_id,
  }).catch(() => null);

  revalidatePath("/admin/gruppenkurse");
  return { success: true, error: undefined };
}

export async function deleteGroupSession(sessionId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: session } = await admin
    .from("group_sessions")
    .select("id, status, course_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return { error: "Session nicht gefunden." };
  if (session.status === "open" || session.status === "full") {
    return { error: "Aktive Sessionen können nicht gelöscht werden. Bitte zuerst absagen." };
  }

  const { error } = await admin.from("group_sessions").delete().eq("id", sessionId);
  if (error) return { error: "Löschen fehlgeschlagen." };

  revalidatePath(`/admin/gruppenkurse/${session.course_id}`);
  return { success: true, error: undefined };
}

// ── Lektionen manuell anpassen ────────────────────────────────────────────────

export async function adjustPackageLessons(packageId: string, delta: number) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  if (!Number.isInteger(delta) || delta === 0) {
    return { error: "Ungültige Anpassung." };
  }

  const admin = await createAdminClient();

  const { data: pkg } = await admin
    .from("packages")
    .select("id, student_id, lessons_total, lessons_used, status")
    .eq("id", packageId)
    .maybeSingle();

  if (!pkg) return { error: "Paket nicht gefunden." };

  const newTotal = pkg.lessons_total + delta;

  if (newTotal < 1) {
    return { error: "Gesamtlektionen können nicht unter 1 fallen." };
  }
  if (newTotal < pkg.lessons_used) {
    return { error: `Kann nicht auf ${newTotal} reduzieren, bereits ${pkg.lessons_used} Lektionen verbraucht.` };
  }

  let newStatus = pkg.status;
  if (pkg.status === "exhausted" && delta > 0) newStatus = "active";
  if (newTotal <= pkg.lessons_used && pkg.status === "active") newStatus = "exhausted";

  const { error } = await admin
    .from("packages")
    .update({ lessons_total: newTotal, status: newStatus })
    .eq("id", packageId);

  if (error) return { error: "Anpassung fehlgeschlagen." };

  revalidatePath(`/admin/schueler/${pkg.student_id}`);
  return { success: true, error: undefined, newTotal };
}

// ── E-Mail-Einstellungen ──────────────────────────────────────────────────────

export async function saveEmailSettings(disabledTypes: string[]) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .upsert({ key: "email_disabled_types", value: disabledTypes, updated_at: new Date().toISOString() });
  if (error) return { error: "Einstellungen konnten nicht gespeichert werden." };
  return { success: true, error: undefined };
}

// ── Bewertungen ──────────────────────────────────────────────────────────────

/**
 * Einen Schüler um eine Bewertung bitten.
 *
 * Eine offene Einladung pro Schüler, dafür sorgt schon ein Index in der
 * Datenbank. Ein zweiter Klick schickt deshalb dieselbe Adresse noch einmal,
 * statt einen weiteren gültigen Link in die Welt zu setzen: Sonst
 * funktionieren nach dreimal Drücken drei Links, und über jeden davon lässt
 * sich schreiben.
 */
export async function bewertungAnfordern(studentId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: profil } = await admin
    .from("profiles")
    .select("vorname, email")
    .eq("id", studentId)
    .maybeSingle();
  if (!profil?.email) return { error: "Für diesen Schüler ist keine E-Mail hinterlegt." };

  const { data: offen } = await admin
    .from("review_einladungen")
    .select("token")
    .eq("student_id", studentId)
    .is("benutzt_am", null)
    .maybeSingle();

  let token = offen?.token as string | undefined;

  if (!token) {
    const { data: neu, error } = await admin
      .from("review_einladungen")
      .insert({ student_id: studentId })
      .select("token")
      .single();
    if (error || !neu) return { error: "Einladung konnte nicht angelegt werden." };
    token = neu.token as string;
  }

  await sendEmailNow(admin, "bewertung_anfrage", {
    student_id: studentId,
    vorname: profil.vorname ?? "",
    link: `${BASIS_URL}/bewerten/${token}`,
  });

  revalidatePath(`/admin/schueler/${studentId}`);
  return { success: true, error: undefined };
}

/**
 * Eine Bewertung freigeben oder ablehnen.
 *
 * Abgelehnte werden nicht gelöscht. Wer eine Bewertung wegklickt und sie
 * später doch sucht, soll sie finden können, und ausserdem gehört sie
 * jemandem: Sie einfach verschwinden zu lassen wäre etwas anderes, als sie
 * nicht zu veröffentlichen.
 */
export async function bewertungEntscheiden(
  reviewId: string,
  entscheidung: "freigegeben" | "abgelehnt",
) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { error } = await admin
    .from("reviews")
    .update({
      status: entscheidung,
      freigegeben_am: entscheidung === "freigegeben" ? new Date().toISOString() : null,
    })
    .eq("id", reviewId);

  if (error) return { error: "Das hat nicht geklappt." };

  revalidatePath("/admin/bewertungen");
  revalidatePath("/");
  revalidatePath("/ueber-mich");
  return { success: true, error: undefined };
}

/**
 * Die gekürzte Fassung für die Startseite setzen.
 *
 * Es wird ausschliesslich weggelassen. Die Datenbank achtet darauf, dass die
 * Kurzfassung nicht länger ist als das Original; sie kann aber nicht prüfen,
 * ob jemand umformuliert hat. Das bleibt eine Frage der Haltung, und die
 * steht im Kommentar über der Tabelle.
 */
export async function bewertungKuerzen(reviewId: string, textKurz: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const sauber = textKurz.trim();
  const admin = await createAdminClient();
  const { error } = await admin
    .from("reviews")
    .update({ text_kurz: sauber.length > 0 ? sauber : null })
    .eq("id", reviewId);

  if (error) return { error: "Die Kurzfassung muss kürzer sein als das Original." };

  revalidatePath("/admin/bewertungen");
  revalidatePath("/");
  return { success: true, error: undefined };
}

/**
 * Eine Bewertung von Hand eintragen.
 *
 * Der Weg für alles, was ausserhalb der eigenen Seite geschrieben wurde:
 * Google, Matchspace, eine Nachricht per WhatsApp. Ohne diesen Weg stünde
 * eine gute Google-Bewertung zwar bei Google, aber nie auf der Website, und
 * wer direkt auf der Startseite landet, sähe sie nie.
 *
 * Sie wird sofort freigegeben. Freigabe schützt vor Fremden mit einem
 * weitergeleiteten Link; hier tippt David selbst, da wäre ein zweiter Klick
 * auf „freigeben" nur eine Schleife.
 */
export async function bewertungVonHand(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const name = String(formData.get("name") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const sterne = Math.round(Number(formData.get("sterne") ?? 5));
  const quelle = String(formData.get("quelle") ?? "google");

  if (!Number.isFinite(sterne) || sterne < 1 || sterne > 5) {
    return { error: "Sterne müssen zwischen 1 und 5 liegen." };
  }
  if (text.length > 0 && name.length === 0) {
    return { error: "Zu einem Text gehört ein Name." };
  }
  if (!["google", "matchspace", "admin", "website_alt"].includes(quelle)) {
    return { error: "Unbekannte Herkunft." };
  }

  const admin = await createAdminClient();
  const { error } = await admin.from("reviews").insert({
    name: name.length > 0 ? name : null,
    sterne,
    text: text.length > 0 ? text : null,
    quelle,
    status: "freigegeben",
    freigegeben_am: new Date().toISOString(),
  });

  if (error) return { error: "Die Bewertung konnte nicht gespeichert werden." };

  revalidatePath("/admin/bewertungen");
  revalidatePath("/");
  revalidatePath("/ueber-mich");
  return { success: true, error: undefined };
}

// ── Alte Pakete aufräumen ──────────────────────────────────

/**
 * Ein beendetes Paket aus der Übersicht nehmen.
 *
 * Es bleibt vollständig in der Datenbank; nur die Liste im Schülerdetail
 * zeigt es nicht mehr. Rechnungen, Raten und Termine bleiben unberührt und
 * auffindbar.
 */
export async function paketArchivieren(
  packageId: string
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: pkg } = await admin
    .from("packages")
    .select("id, student_id, status")
    .eq("id", packageId)
    .maybeSingle();

  if (!pkg) return { error: "Paket nicht gefunden." };
  if (pkg.status === "active") {
    return {
      error:
        "Das Paket läuft noch. Beende es zuerst, sonst verschwindet es aus der Liste, während es weiter abgerechnet wird.",
    };
  }

  const { error } = await admin
    .from("packages")
    .update({ archiviert_am: new Date().toISOString() })
    .eq("id", packageId);

  if (error) return { error: "Das Paket konnte nicht archiviert werden." };

  revalidatePath(`/admin/schueler/${pkg.student_id}`);
  return { success: true, error: undefined };
}

/** Ein archiviertes Paket wieder einblenden. */
export async function paketWiederherstellen(
  packageId: string
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: pkg } = await admin
    .from("packages")
    .select("id, student_id")
    .eq("id", packageId)
    .maybeSingle();
  if (!pkg) return { error: "Paket nicht gefunden." };

  await admin
    .from("packages")
    .update({ archiviert_am: null })
    .eq("id", packageId);

  revalidatePath(`/admin/schueler/${pkg.student_id}`);
  return { success: true, error: undefined };
}

/**
 * Ein Paket endgültig löschen.
 *
 * ── Warum das nicht immer geht ──────────────────────────────
 *
 * Am Paket hängt der Zahlungsplan, und der wird beim Löschen mitgelöscht
 * (CASCADE). Gestellte Rechnungen überleben zwar, verlieren aber ihre
 * Zuordnung. Bei einem Paket, für das je Geld gefordert oder eingegangen ist,
 * risse das ein Loch in die Buchhaltung, das sich nicht mehr schliessen lässt
 * — und zwar unbemerkt, weil die Rechnung ja weiterhin dasteht.
 *
 * Gelöscht wird deshalb nur, was nie abgerechnet wurde: Fehlversuche,
 * Testeinträge, versehentlich angelegte Pakete. Alles andere wird archiviert.
 */
export async function paketLoeschen(
  packageId: string
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: pkg } = await admin
    .from("packages")
    .select("id, student_id, status")
    .eq("id", packageId)
    .maybeSingle();

  if (!pkg) return { error: "Paket nicht gefunden." };
  if (pkg.status === "active") {
    return { error: "Ein laufendes Paket lässt sich nicht löschen." };
  }

  const [{ count: rechnungen }, { count: raten }, { count: termine }] =
    await Promise.all([
      admin
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("package_id", packageId),
      admin
        .from("package_instalments")
        .select("id", { count: "exact", head: true })
        .eq("package_id", packageId)
        .neq("status", "offen"),
      admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("package_id", packageId)
        .in("status", ["booked", "completed"]),
    ]);

  if ((rechnungen ?? 0) > 0) {
    return {
      error: `Zu diesem Paket ${(rechnungen ?? 0) === 1 ? "gibt es eine Rechnung" : `gibt es ${rechnungen} Rechnungen`}. Es lässt sich deshalb nur archivieren, nicht löschen.`,
    };
  }
  if ((raten ?? 0) > 0) {
    return {
      error:
        "Zu diesem Paket wurden bereits Raten gestellt. Es lässt sich deshalb nur archivieren, nicht löschen.",
    };
  }
  if ((termine ?? 0) > 0) {
    return {
      error: `Am Paket hängen noch ${termine} Termine. Sage sie zuerst ab, sonst stehen sie ohne Paket im Kalender.`,
    };
  }

  const { error } = await admin.from("packages").delete().eq("id", packageId);
  if (error) return { error: "Das Paket konnte nicht gelöscht werden." };

  revalidatePath(`/admin/schueler/${pkg.student_id}`);
  return { success: true, error: undefined };
}

// ── Externe Schüler ────────────────────────────────────────

/**
 * Einen Schüler anlegen, dessen Unterricht über eine andere Plattform läuft.
 *
 * Kein Login, keine Rechnung, keine Mail — aber ein vollwertiger Eintrag in
 * Kalender und Routenplanung. Genau dafür ist er da: Der Termin belegt einen
 * echten Abend, und die Route muss ihn kennen.
 *
 * Die Adresse wird sofort geokodiert. Ohne Koordinaten fiele der Schüler
 * lautlos aus der Routenplanung, und der ganze Zweck wäre verfehlt.
 */
export async function externenAnlegen(
  formData: FormData
): Promise<
  | { success: true; error: undefined; termine: number; kollisionen: string[] }
  | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const vorname = String(formData.get("vorname") ?? "").trim();
  const nachname = String(formData.get("nachname") ?? "").trim();
  const adresse = String(formData.get("adresse") ?? "").trim();
  const plattform = String(formData.get("plattform") ?? "").trim() || null;
  const telefon = String(formData.get("telefon") ?? "").trim() || null;
  const notizen = String(formData.get("notizen") ?? "").trim() || null;
  const ertragRoh = String(formData.get("ertrag") ?? "").trim();

  const rhythmus =
    formData.get("rhythmus") === "zweiwoechentlich"
      ? "zweiwoechentlich"
      : "woechentlich";
  const wochentag = Number(formData.get("wochentag") ?? NaN);
  const zeit = String(formData.get("zeit") ?? "").trim();
  const dauer = Number(formData.get("dauer") ?? 45);
  const startDatum = String(formData.get("start_datum") ?? "").trim();
  const umfang = String(formData.get("umfang") ?? "unbefristet");
  const anzahlRoh = Number(formData.get("anzahl") ?? NaN);

  if (!vorname || !nachname) return { error: "Bitte Vor- und Nachnamen angeben." };
  if (!adresse) {
    return {
      error:
        "Ohne Adresse kann ich den Schüler nicht in die Route rechnen. Bitte mit Strasse, Nummer, PLZ und Ort angeben.",
    };
  }
  // Der Normalfall ist „planen": David fragt den Schüler, wann er kann, und
  // die Zuteilung sucht daraus einen Platz. Nur wenn der Termin extern
  // bereits abgemacht ist, wird er hier direkt gesetzt.
  const terminGeplant = formData.get("termin_art") !== "fix";

  let zeitfenster: {
    wochentag: number;
    fruehestens: string;
    spaetestens: string;
    praeferenz: number;
  }[] = [];

  if (terminGeplant) {
    try {
      const roh = JSON.parse(String(formData.get("zeiten") ?? "[]"));
      zeitfenster = Array.isArray(roh) ? roh : [];
    } catch {
      zeitfenster = [];
    }
    zeitfenster = zeitfenster.filter(
      (z) =>
        Number.isInteger(z.wochentag) &&
        z.wochentag >= 0 &&
        z.wochentag <= 6 &&
        /^\d{2}:\d{2}$/.test(z.fruehestens) &&
        /^\d{2}:\d{2}$/.test(z.spaetestens) &&
        z.fruehestens < z.spaetestens &&
        z.praeferenz >= 1 &&
        z.praeferenz <= 3
    );
    if (zeitfenster.length === 0) {
      return {
        error:
          "Ohne Zeiten kann die Zuteilung keinen Platz suchen. Bitte angeben, wann er kann.",
      };
    }
  } else {
    if (!Number.isInteger(wochentag) || wochentag < 0 || wochentag > 6) {
      return { error: "Bitte einen Wochentag wählen." };
    }
    if (!/^\d{2}:\d{2}$/.test(zeit)) {
      return { error: "Bitte eine Uhrzeit angeben." };
    }
  }

  if (!startDatum) return { error: "Bitte ein Startdatum angeben." };

  const anzahl =
    umfang === "anzahl"
      ? Number.isInteger(anzahlRoh) && anzahlRoh > 0
        ? anzahlRoh
        : null
      : null;
  if (umfang === "anzahl" && anzahl == null) {
    return { error: "Bitte angeben, wie viele Termine vereinbart sind." };
  }

  const admin = await createAdminClient();

  // Adresse zuerst auflösen: Schlägt es fehl, wird gar nichts angelegt.
  // Ein Schüler ohne Koordinaten wäre für die Routenplanung unsichtbar.
  const treffer = await geocode(adresse);
  if (!treffer) {
    return {
      error:
        "Diese Adresse liess sich nicht auflösen. Bitte so schreiben: Strasse Nummer, PLZ Ort.",
    };
  }

  const { data: profil, error: profilFehler } = await admin
    .from("profiles")
    .insert({
      role: "student",
      vorname,
      nachname,
      // Bewusst ohne Mailadresse: Externe bekommen keine Post, und eine
      // erfundene Adresse würde irgendwann doch angeschrieben.
      email: null,
      telefon,
      adresse,
      notizen,
      aktiv: true,
      extern: true,
      plattform,
      externer_ertrag: ertragRoh ? Number(ertragRoh) : null,
      lat: treffer.lat,
      lng: treffer.lng,
      geocoded_am: new Date().toISOString(),
      geocode_quelle: treffer.quelle,
      geocode_adresse: adresse,
    })
    .select("id")
    .single();

  if (profilFehler || !profil) {
    return { error: "Der Schüler konnte nicht angelegt werden." };
  }

  const { data: vereinbarung, error: vFehler } = await admin
    .from("externe_vereinbarungen")
    .insert({
      student_id: profil.id,
      rhythmus,
      // Offen lassen, wenn geplant werden soll: Die Zuteilung trägt den
      // Termin später ein.
      wochentag: terminGeplant ? null : wochentag,
      zeit: terminGeplant ? null : zeit,
      lektion_minuten: Number.isFinite(dauer) ? dauer : 45,
      woche_paritaet:
        !terminGeplant && rhythmus === "zweiwoechentlich"
          ? Number(formData.get("paritaet") ?? 0) === 1
            ? 1
            : 0
          : null,
      start_datum: startDatum,
      anzahl,
      aktiv: true,
    })
    .select("*")
    .single();

  if (vFehler || !vereinbarung) {
    // Profil wieder entfernen, sonst steht ein Schüler ohne Termine da und
    // niemand weiss, warum er im Kalender fehlt.
    await admin.from("profiles").delete().eq("id", profil.id);
    return { error: "Die Vereinbarung konnte nicht angelegt werden." };
  }

  // Beim Planen entstehen noch keine Termine: Die Verfügbarkeit wird als
  // Dauerangabe abgelegt (runde_id null, derselbe Weg wie beim Abo-Kauf),
  // und die Zuteilung sucht den Platz. Erst beim Anwenden wird gebucht.
  if (terminGeplant) {
    await admin.from("student_verfuegbarkeit").insert(
      zeitfenster.map((z) => ({
        student_id: profil.id,
        runde_id: null,
        wochentag: z.wochentag,
        fruehestens: z.fruehestens,
        spaetestens: z.spaetestens,
        praeferenz: z.praeferenz,
      }))
    );

    revalidatePath("/admin/schueler");
    revalidatePath("/admin/planung");
    revalidatePath("/admin/routenplanung");
    return { success: true, error: undefined, termine: 0, kollisionen: [] };
  }

  const ergebnis = await legeExterneTermineAn(
    admin,
    vereinbarung as unknown as ExterneVereinbarung
  );

  revalidatePath("/admin/schueler");
  revalidatePath("/admin/kalender");
  revalidatePath("/admin/routenplanung");
  return {
    success: true,
    error: undefined,
    termine: ergebnis.angelegt,
    kollisionen: ergebnis.kollisionen,
  };
}

/**
 * Die Vereinbarung eines externen Schülers ändern.
 *
 * Das Gegenstück zu „Paket anlegen" bei den eigenen Schülern — nur dass
 * hier nichts abgerechnet wird. Geändert werden können der Ertrag pro
 * Lektion, der Rhythmus, die Dauer und der feste Termin.
 *
 * Wird ein Wochentag samt Uhrzeit gesetzt, laufen künftige Termine neu:
 * alte absagen, Serie neu anlegen. Ohne Wochentag bleibt der Platz offen
 * und die Zuteilung sucht ihn.
 */
export async function externeVereinbarungSpeichern(
  formData: FormData
): Promise<
  { success: true; error: undefined; termine: number } | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const studentId = String(formData.get("student_id") ?? "");
  if (!studentId) return { error: "Kein Schüler angegeben." };

  const admin = await createAdminClient();

  const { data: profil } = await admin
    .from("profiles")
    .select("extern")
    .eq("id", studentId)
    .maybeSingle();
  if (profil?.extern !== true) {
    return { error: "Das ist kein externer Schüler." };
  }

  const { data: vereinbarung } = await admin
    .from("externe_vereinbarungen")
    .select("*")
    .eq("student_id", studentId)
    .eq("aktiv", true)
    .maybeSingle();
  if (!vereinbarung) return { error: "Keine aktive Vereinbarung gefunden." };

  const plattform = String(formData.get("plattform") ?? "").trim() || null;
  const ertragRoh = String(formData.get("externer_ertrag") ?? "").replace(",", ".");
  const rhythmus: Rhythmus =
    String(formData.get("rhythmus")) === "zweiwoechentlich"
      ? "zweiwoechentlich"
      : "woechentlich";
  const dauer = Number(formData.get("lektion_minuten") ?? 45);
  const wochentagRoh = String(formData.get("wochentag") ?? "");
  const zeit = String(formData.get("zeit") ?? "").trim();
  const paritaetRoh = String(formData.get("paritaet") ?? "");
  const abDatum =
    String(formData.get("ab_datum") ?? "").trim() || todayInZurich();

  const ertrag = ertragRoh === "" ? null : Number(ertragRoh);
  if (ertrag != null && (!Number.isFinite(ertrag) || ertrag < 0 || ertrag > 1000)) {
    return { error: "Ungültiger Ertrag pro Lektion." };
  }
  if (!Number.isFinite(dauer) || dauer < 15 || dauer > 180) {
    return { error: "Ungültige Lektionsdauer." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(abDatum)) {
    return { error: "Ungültiges Startdatum." };
  }

  await admin
    .from("profiles")
    .update({ plattform, externer_ertrag: ertrag })
    .eq("id", studentId);

  await admin
    .from("externe_vereinbarungen")
    .update({
      rhythmus,
      lektion_minuten: dauer,
      aktualisiert_am: new Date().toISOString(),
    })
    .eq("id", vereinbarung.id);

  let termine = 0;

  // Fester Termin angegeben? Dann Serie neu setzen. Sonst bleibt der Platz
  // offen — das ist kein Fehler, sondern der Weg über die Zuteilung.
  if (wochentagRoh !== "" && /^\d{2}:\d{2}$/.test(zeit)) {
    const wochentag = Number(wochentagRoh);
    if (!Number.isInteger(wochentag) || wochentag < 0 || wochentag > 6) {
      return { error: "Ungültiger Wochentag." };
    }
    const ergebnis = await setzeExternenTermin(admin, {
      studentId,
      wochentag,
      beginn: zeit,
      paritaet:
        rhythmus === "zweiwoechentlich"
          ? Number(paritaetRoh) === 1
            ? 1
            : 0
          : null,
      abDatum,
    });
    if ("error" in ergebnis) return { error: ergebnis.error };
    termine = ergebnis.termine;
  }

  revalidatePath(`/admin/schueler/${studentId}`);
  revalidatePath("/admin/schueler");
  revalidatePath("/admin/kalender");
  revalidatePath("/admin/routenplanung");
  revalidatePath("/admin/zahlungen");
  return { success: true, error: undefined, termine };
}

/**
 * Eine externe Vereinbarung beenden: künftige Termine absagen, nicht mehr
 * nachlegen. Vergangene Termine bleiben als Historie stehen.
 */
export async function externenBeenden(
  studentId: string
): Promise<{ success: true; error: undefined; abgesagt: number } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: vereinbarungen } = await admin
    .from("externe_vereinbarungen")
    .select("id")
    .eq("student_id", studentId)
    .eq("aktiv", true);

  let abgesagt = 0;
  for (const v of vereinbarungen ?? []) {
    const r = await beendeVereinbarung(admin, v.id as string);
    abgesagt += r.abgesagt;
  }

  await admin.from("profiles").update({ aktiv: false }).eq("id", studentId);

  revalidatePath("/admin/schueler");
  revalidatePath(`/admin/schueler/${studentId}`);
  revalidatePath("/admin/kalender");
  return { success: true, error: undefined, abgesagt };
}

/**
 * Von wo ein Unterrichtstag startet.
 *
 * An Tagen mit Hochschule kommt David nicht von zuhause, sondern aus
 * Zürich. Für die Routenplanung ist das der ganze Unterschied: Von
 * Neftenbach aus ist ein Schüler dort der naheliegende erste Halt und einer
 * in Winterthur ein Umweg — von Zürich HB aus genau umgekehrt.
 *
 * Leere Adresse setzt zurück auf „von zuhause".
 */
export async function startpunktSetzen(
  wochentag: number,
  adresse: string
): Promise<
  { success: true; error: undefined; adresse: string | null } | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  if (!Number.isInteger(wochentag) || wochentag < 0 || wochentag > 6) {
    return { error: "Ungültiger Wochentag." };
  }

  const admin = await createAdminClient();
  const sauber = adresse.trim();

  if (!sauber) {
    await admin
      .from("admin_verfuegbarkeit")
      .update({ start_adresse: null, start_lat: null, start_lng: null })
      .eq("wochentag", wochentag);

    revalidatePath("/admin/verfuegbarkeit");
    revalidatePath("/admin/routenplanung");
    return { success: true, error: undefined, adresse: null };
  }

  // Ohne Koordinaten wäre die Adresse nur Zierde: Der Planer könnte nichts
  // damit rechnen und fiele stillschweigend auf zuhause zurück, während in
  // der Oberfläche eine Adresse stünde. Die Datenbank verbietet diesen
  // Zustand, hier wird er gar nicht erst erzeugt.
  const treffer = await geocode(sauber);
  if (!treffer) {
    return {
      error:
        "Diese Adresse liess sich nicht auflösen. Bitte so schreiben: Strasse Nummer, PLZ Ort.",
    };
  }

  const { error } = await admin
    .from("admin_verfuegbarkeit")
    .update({
      start_adresse: sauber,
      start_lat: treffer.lat,
      start_lng: treffer.lng,
    })
    .eq("wochentag", wochentag);

  if (error) return { error: "Der Startpunkt liess sich nicht speichern." };

  revalidatePath("/admin/verfuegbarkeit");
  revalidatePath("/admin/routenplanung");
  return { success: true, error: undefined, adresse: sauber };
}

// ── Apple-Kalender ──────────────────────────────────────────


/**
 * iCal-Link hinterlegen und sofort einlesen.
 *
 * Nur lesen: Es wird nichts in Apples Kalender geschrieben. Der Link kommt
 * aus der Kalender-App über „Kalender freigeben" — wer ihn kennt, sieht die
 * Termine, darum steht in der Oberfläche ein Hinweis dazu.
 */
export async function appleKalenderSetzen(
  url: string,
  titelUebernehmen: boolean
): Promise<
  { success: true; termine: number; bloecke: number; error: undefined } | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const sauber = url.trim();
  if (!sauber) return { error: "Bitte einen Link angeben." };

  const admin = await createAdminClient();
  await admin.from("app_settings").upsert(
    {
      key: EINSTELLUNG_APPLE,
      value: { url: sauber, titelUebernehmen },
    },
    { onConflict: "key" }
  );

  // Sofort einlesen, damit ein falscher Link auffällt, solange David noch
  // davorsitzt — und nicht erst beim nächtlichen Cron.
  const res = await gleicheAppleKalenderAb(admin);
  if ("error" in res) return res;

  revalidatePath("/admin/einstellungen");
  revalidatePath("/admin/kalender");
  return {
    success: true,
    termine: res.termine,
    bloecke: res.bloecke,
    error: undefined,
  };
}

/** Von Hand neu einlesen. */
export async function appleKalenderAbgleichen(): Promise<
  { success: true; termine: number; bloecke: number; error: undefined } | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const res = await gleicheAppleKalenderAb(admin);
  if ("error" in res) return res;

  revalidatePath("/admin/einstellungen");
  revalidatePath("/admin/kalender");
  return {
    success: true,
    termine: res.termine,
    bloecke: res.bloecke,
    error: undefined,
  };
}

/** Kalender abmelden, importierte Sperren entfernen. */
export async function appleKalenderTrennen(): Promise<
  { success: true; entfernt: number; error: undefined } | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { entfernt } = await trenneAppleKalender(admin);

  revalidatePath("/admin/einstellungen");
  revalidatePath("/admin/kalender");
  return { success: true, entfernt, error: undefined };
}

// ── Günstige freie Termine ──────────────────────────────────

/**
 * Freie Slots einer Woche für einen Schüler, bewertet nach Routenkosten.
 *
 * „Frei" allein sagt nichts: Ein Slot direkt nach einer bestehenden Lektion
 * im Nachbardorf kostet fast nichts, derselbe freie Slot an einem leeren
 * Tag einen ganzen Hin- und Rückweg. Diese Action liefert die Slots aus
 * derselben Buchungs-Engine wie überall, aber sortiert nach dem, was sie
 * David tatsächlich kosten — für Direktbuchung und Terminvorschlag.
 */
export async function guenstigeSlots(
  studentUserId: string,
  weekOffset: number
): Promise<{ slots: BewerteterSlot[]; hinweis: string | null } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  const { data: profil } = await admin
    .from("profiles")
    .select("buffer_time_minutes, lat, lng, ist_test")
    .eq("id", studentUserId)
    .maybeSingle();
  if (!profil) return { error: "Schüler nicht gefunden." };
  const bufferMin = profil.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  const now = new Date();
  const todayCal = utcToZonedDate(now);
  const w = weekdayOf(todayCal);
  const mondayOffset = w === 0 ? -6 : 1 - w;
  const fromCal: CalDate = addDaysCal(todayCal, mondayOffset + weekOffset * 7);
  const fromInstant = zonedToUtc(fromCal.y, fromCal.m, fromCal.d, 0, 0);
  const toInstant = new Date(fromInstant.getTime() + 7 * 86400000);

  const ctx = await loadAvailabilityContext(
    admin,
    studentUserId,
    bufferMin,
    fromInstant,
    toInstant,
    now
  );
  const settings =
    (ctx as { blockSettings?: typeof DEFAULT_BLOCK_SETTINGS }).blockSettings ??
    DEFAULT_BLOCK_SETTINGS;
  const frei = gapAwareSlots(fromCal, 7, ctx, settings).map((s) => ({
    beginn: s.start.toISOString(),
    ende: s.end.toISOString(),
  }));

  // Gebuchte Termine der Woche mit Koordinaten, für die Routenkosten. Im
  // selben Kreis wie der Schüler: Testschüler-Termine dürfen echte
  // Bewertungen nicht verzerren und umgekehrt.
  const { data: termine } = await admin
    .from("appointments")
    .select("start_at, end_at, student_id, profiles!inner(vorname, lat, lng, ist_test)")
    .eq("status", "booked")
    .eq("profiles.ist_test", profil.ist_test === true)
    .gte("start_at", fromInstant.toISOString())
    .lt("start_at", toInstant.toISOString());

  type TerminRow = {
    start_at: string;
    end_at: string;
    student_id: string;
    profiles: { vorname: string | null; lat: number | null; lng: number | null };
  };
  const nachbarn = ((termine ?? []) as unknown as TerminRow[])
    .filter(
      (t) =>
        t.student_id !== studentUserId &&
        Number.isFinite(Number(t.profiles?.lat)) &&
        Number.isFinite(Number(t.profiles?.lng))
    )
    .map((t) => ({
      start_at: t.start_at,
      end_at: t.end_at,
      lat: Number(t.profiles.lat),
      lng: Number(t.profiles.lng),
      name: t.profiles.vorname ?? "einer Lektion",
    }));

  const zuhause = await ladeZuhause(admin);
  const schueler =
    Number.isFinite(Number(profil.lat)) && Number.isFinite(Number(profil.lng))
      ? { lat: Number(profil.lat), lng: Number(profil.lng) }
      : null;

  return {
    slots: bewerteSlots({
      slots: frei,
      termine: nachbarn,
      schueler,
      zuhause: { lat: zuhause.lat, lng: zuhause.lng },
    }),
    hinweis: schueler
      ? null
      : "Ohne aufgelöste Adresse des Schülers zählt nur die Lage im Tagesablauf, nicht die Fahrzeit.",
  };
}
