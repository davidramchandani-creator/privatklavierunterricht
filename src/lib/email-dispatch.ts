import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email-sender";
import { renderEmail } from "@/lib/email-templates";
import { generateQRInvoicePdf } from "@/lib/qr-invoice";
import { buildLessonTwintLink, buildTwintLink } from "@/lib/twint";
import { pricePerPersonFor } from "@/lib/group-courses";
import { sendPushToUser, sendPushToAdmin } from "@/lib/push";
import { buildPush } from "@/lib/notification-push";
import { BASIS_URL } from "@/lib/seo";
import { zahlungsartFuer } from "@/lib/zahlungsart";

export const ADMIN_RECIPIENT_TYPES = [
  // Mahnwesen: beide gehen an David, obwohl eine student_id im Payload
  // steht — sie handeln von einem Schüler, sind aber nicht an ihn.
  "zahlung_ueberfaellig_admin",
  "bestaetigung_offen_admin",
  "wochenbriefing",
  "monatsbriefing",
  "booking_request_admin",
  "booking_request_withdrawn",
  "appointment_cancelled_by_student",
  "reschedule_request_admin",
  "reschedule_request_withdrawn",
  "proposal_rejected_admin",
  "group_session_admin",
  // Kontaktformular + Probelektion-Anfragen (nur Push; die Mail wird in den
  // jeweiligen Actions direkt versendet).
  "anfrage_admin",
  // Schüler-Aktionen, über die der Admin informiert werden muss.
  "payment_reported_admin",
  "package_purchased_admin",
  "proposal_accepted_admin",
  // Abo-Modell
  "subscription_renewed_admin",
  "subscription_cancelled_admin",
  // Fixplatz-Modell
  "fixplatz_admin",
  "ausfall_admin",
  // Eine Bewertung wartet auf Freigabe. Ohne diese Mail bliebe sie liegen:
  // Niemand schaut taeglich in eine Liste, die meistens leer ist.
  "bewertung_eingegangen",
  // Abo-Modell
  "abo_gestartet_admin",
  "abo_verlaengert_admin",
  // Ein Schüler ist in eine freigewordene Lücke vorgerückt — Davids Abend
  // sieht jetzt anders aus, das muss er sofort wissen.
  "vorrueck_admin",
  // Monatsende: an die Ausgaben erinnern, solange er sie noch weiss.
  "ausgaben_erinnerung",
];

export const STUDENT_PAYLOAD_TO_TYPES = [
  "booking_request_received",
  "booking_confirmed",
  "reschedule_request_received",
  "reschedule_confirmed",
  "package_cancelled",
  "twint_payment_request",
  "qr_invoice",
  "payment_confirmed",
  "payment_rejected",
  "group_session_created",
  "group_session_joined",
  "group_session_left",
  "group_payment_request",
];

export const STUDENT_LOOKUP_TYPES = [
  "zahlung_erinnerung",
  "lesson_reminder_24h",
  "lesson_reminder_2h",
  "payment_overdue",
  "package_expiring",
  "booking_rejected",
  "reschedule_rejected",
  "appointment_cancelled_student",
  "appointment_cancelled_by_admin",
  "proposal_new",
  "package_settlement_paid",
  // Abo-Modell
  "subscription_renewal_notice",
  "subscription_renewed",
  "subscription_expired",
  "subscription_cancelled",
  "package_created",
  // Fixplatz-Modell
  "fixplatz_confirmed",
  "ausfall_ersatz_vorschlag",
  "ausfall_gutschrift",
  "ausfall_nachgeholt",
  "bewertung_anfrage",
  "ausfall_kurzfristig",
  "rhythmus_changed",
  // Abo-Modell
  "abo_gestartet",
  "abo_verlaengert",
  "abo_beendet",
  "abo_endet_bald",
  // Terminplanung
  "verfuegbarkeit_anfrage",
  "verfuegbarkeit_einzelanfrage",
  "verfuegbarkeit_erinnerung",
  "verfuegbarkeit_zuteilung",
  // Umstellung aufs Abo
  "umstellung_info",
  "umstellung_erinnerung",
  "umstellung_bestaetigung",
  // Vorrücken in eine freigewordene Lücke
  "vorrueck_angebot",
  "vorrueck_bestaetigt",
];

async function getDisabledEmailTypes(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "email_disabled_types")
    .maybeSingle();
  if (!data?.value) return [];
  return Array.isArray(data.value) ? (data.value as string[]) : [];
}

const PAYMENT_TYPES = ["twint_payment_request", "qr_invoice", "group_payment_request"];

export async function dispatchEmail(
  admin: SupabaseClient,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Deaktivierte E-Mail-Typen überspringen.
  const disabled = await getDisabledEmailTypes(admin);
  if (disabled.includes(type)) return;

  // ── Externe Schüler bekommen nie Post ────────────────────
  //
  // Ihr Unterricht läuft über eine andere Plattform. Sie haben hier kein
  // Konto, keine Rechnung und oft nicht einmal eine Mailadresse — was sie
  // von uns bekämen, wäre bestenfalls verwirrend und schlimmstenfalls eine
  // Zahlungsaufforderung für etwas, das sie längst anderswo bezahlt haben.
  //
  // Die Sperre steht hier und nicht an den einzelnen Aufrufstellen: Es gibt
  // Dutzende davon, und jede neue müsste daran denken. An dieser einen
  // Stelle kommt alles vorbei.
  //
  // Mails an David selbst (ADMIN_RECIPIENT_TYPES) sind ausgenommen, auch
  // wenn sie einen externen Schüler betreffen — er will ja wissen, wenn bei
  // ihnen etwas ausfällt.
  if (payload.student_id && !ADMIN_RECIPIENT_TYPES.includes(type)) {
    const { data: empfaenger } = await admin
      .from("profiles")
      .select("extern")
      .eq("id", payload.student_id as string)
      .maybeSingle();
    if (empfaenger?.extern === true) return;
  }

  // Zahlungsmails: vor Versand prüfen, ob noch fällig.
  if (PAYMENT_TYPES.includes(type)) {
    // Lektionsbezogene Zahlung: Termin muss noch booked/completed sein
    // (verhindert Versand nach Stornierung/Löschung).
    if (payload.appointment_id) {
      const { data: appt } = await admin
        .from("appointments")
        .select("status")
        .eq("id", payload.appointment_id as string)
        .maybeSingle();
      if (!appt || !["booked", "completed"].includes(appt.status as string)) {
        return;
      }
    }
    // Paket- oder Lektions-Rechnung: bereits bezahlt/archiviert/storniert → nicht (erneut) senden.
    if (payload.invoice_id) {
      const { data: inv } = await admin
        .from("invoices")
        .select("status")
        .eq("id", payload.invoice_id as string)
        .maybeSingle();
      if (!inv || ["paid", "archived", "cancelled"].includes(inv.status as string)) {
        return;
      }
    }
  }

  let to: string | null = null;
  const extraContext: Record<string, unknown> = {};

  if (ADMIN_RECIPIENT_TYPES.includes(type)) {
    to = process.env.ADMIN_EMAIL ?? null;
    if (
      payload.student_id &&
      (type === "booking_request_withdrawn" ||
        type === "appointment_cancelled_by_student")
    ) {
      const { data: profile } = await admin
        .from("profiles")
        .select("vorname, nachname")
        .eq("id", payload.student_id)
        .single();
      if (profile)
        extraContext.student_name = `${profile.vorname} ${profile.nachname}`;
    }
  } else if (STUDENT_PAYLOAD_TO_TYPES.includes(type)) {
    to = (payload.to as string) ?? null;
  } else if (STUDENT_LOOKUP_TYPES.includes(type)) {
    if (payload.student_id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("email, vorname, nachname")
        .eq("id", payload.student_id)
        .single();
      if (profile) {
        // Kann seit den externen Schülern null sein. Der Wurf unten ist
        // dann richtig: lieber ein sichtbarer Fehler in der Outbox als
        // eine Mail ins Leere.
        to = profile.email ?? null;
        extraContext.student_name = `${profile.vorname} ${profile.nachname}`;
      }
    }
  }

  if (!to) throw new Error(`No recipient email resolved for type: ${type}`);

  // QR-Rechnung: PDF erzeugen und in Storage ablegen.
  //
  // Scheitert die Erzeugung, wird **nicht** versendet. Vorher ging die Mail
  // trotzdem raus, mit einem Link auf eine Datei, die es nicht gab: Die
  // Schülerin klickte auf ihre Rechnung und bekam einen Fehler. Eine Mail,
  // die nie ankommt, ist besser als eine, die den Empfänger ratlos
  // zurücklässt — und der Fehlschlag steht so sichtbar in der Outbox, statt
  // still in einem Protokoll zu verschwinden.
  if (type === "qr_invoice" && payload.invoice_id) {
    const link = await ensureInvoicePdfLink(admin, String(payload.invoice_id));
    if (!link) {
      throw new Error(
        `QR-Rechnung ${payload.invoice_id}: PDF konnte nicht erzeugt werden, ` +
          `Mail nicht versendet. Adresse prüfen (Format: Strasse Nr., PLZ Ort) ` +
          `oder auf TWINT umstellen.`,
      );
    }
    extraContext.pdf_link = link;
  }

  // TWINT: Deep-Link mit Betrag + Zahlungszweck bauen.
  // Überschreibt einen evtl. im Payload gesetzten Basis-Link (Spec §6).
  if (type === "twint_payment_request") {
    const amount = Number(payload.amount ?? 0);
    if (!payload.lesson_date && payload.description) {
      // Paket-Rechnung: Paketname als Zahlungszweck (kein Lektionsdatum).
      extraContext.twint_link =
        buildTwintLink(amount, String(payload.description)) || undefined;
    } else {
      extraContext.twint_link = buildLessonTwintLink(
        amount,
        payload.lesson_date ? String(payload.lesson_date) : null
      );
    }
  }

  // Gruppenkurs-Zahlung: Preis dynamisch aus der finalen Teilnehmerzahl
  // berechnen, Rechnung erst jetzt anlegen (nach der Lektion), dann TWINT/QR.
  if (type === "group_payment_request") {
    const group = await prepareGroupPayment(
      admin,
      String(payload.appointment_id ?? ""),
      String(payload.group_session_id ?? "")
    );
    Object.assign(extraContext, group);
  }

  const rendered = renderEmail(type, { ...payload, ...extraContext });
  if (!rendered) throw new Error(`No template for type: ${type}`);

  await sendEmail({ to, subject: rendered.subject, html: rendered.html });

  // Zusaetzlich Push senden (fehlertolerant: Mail ist bereits raus).
  await dispatchPush(admin, type, { ...payload, ...extraContext });
}

/**
 * Sendet die Push-Variante einer Benachrichtigung.
 * Wirft nie, eine fehlgeschlagene Push-Nachricht darf weder die E-Mail noch
 * die ausloesende Aktion beeintraechtigen.
 */
export async function dispatchPush(
  admin: SupabaseClient,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const push = buildPush(type, payload);
    if (!push) return;

    if (ADMIN_RECIPIENT_TYPES.includes(type)) {
      await sendPushToAdmin(admin, push);
      return;
    }

    // Schueler-Benachrichtigung: user_id ermitteln.
    let userId = (payload.student_id as string | undefined) ?? undefined;
    if (!userId && payload.invoice_id) {
      const { data: inv } = await admin
        .from("invoices")
        .select("student_id")
        .eq("id", payload.invoice_id as string)
        .maybeSingle();
      userId = (inv?.student_id as string | undefined) ?? undefined;
    }
    if (!userId && payload.appointment_id) {
      const { data: appt } = await admin
        .from("appointments")
        .select("student_id")
        .eq("id", payload.appointment_id as string)
        .maybeSingle();
      userId = (appt?.student_id as string | undefined) ?? undefined;
    }
    if (!userId && payload.to) {
      const { data: prof } = await admin
        .from("profiles")
        .select("id")
        .eq("email", payload.to as string)
        .maybeSingle();
      userId = (prof?.id as string | undefined) ?? undefined;
    }

    if (userId) await sendPushToUser(admin, userId, push);
  } catch (err) {
    console.error(
      "[push] dispatchPush fehlgeschlagen:",
      type,
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Stellt sicher, dass für eine Rechnung ein PDF (oder SPC-Fallback) existiert,
 * und gibt den signierten Download-Link zurück. Idempotent.
 */
async function ensureInvoicePdfLink(
  admin: SupabaseClient,
  invoiceId: string
): Promise<string | null> {
  const { data: inv } = await admin
    .from("invoices")
    .select("id, invoice_number, amount, payer_name, payer_address, pdf_url, access_token")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return null;

  const appUrl = BASIS_URL;

  if (!inv.pdf_url) {
    const result = await generateQRInvoicePdf({
      invoiceNumber: inv.invoice_number ?? invoiceId,
      amount: Number(inv.amount ?? 0),
      debtorName: inv.payer_name ?? "Unbekannt",
      debtorAddress: inv.payer_address ?? "",
    });

    // Nur ein echtes PDF wird festgeschrieben.
    //
    // Vorher landete auch der SPC-Notbehelf dauerhaft in `pdf_url`, mit der
    // Folge, dass eine einmal fehlgeschlagene Erzeugung die Rechnung für
    // immer kaputt liess: beim nächsten Aufruf war `pdf_url` ja gesetzt, also
    // wurde nichts mehr versucht, und der Schüler bekam bis ans Ende eine
    // Textdatei statt eines Einzahlungsscheins. Genau so steht es im Bestand.
    //
    // Jetzt bleibt `pdf_url` bei einem Fehlschlag leer, und der nächste
    // Versuch erzeugt sie neu.
    if (result.type === "pdf") {
      const storagePath = `invoices/${invoiceId}.pdf`;
      const { error: uploadErr } = await admin.storage
        .from("invoices")
        .upload(storagePath, result.pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (uploadErr) {
        console.error(`[qr] Upload der Rechnung ${invoiceId} fehlgeschlagen:`, uploadErr);
        return null;
      }
      await admin
        .from("invoices")
        .update({ pdf_url: storagePath })
        .eq("id", invoiceId);
    } else {
      console.error(
        `[qr] Rechnung ${invoiceId}: kein PDF erzeugbar, bleibt offen für einen neuen Versuch.`
      );
      // Kein Link zurückgeben. Der Aufrufer bricht damit den Versand ab,
      // statt auf eine nicht vorhandene Datei zu verweisen.
      return null;
    }
  }

  return `${appUrl}/api/invoices/${invoiceId}/pdf?token=${inv.access_token}`;
}

/**
 * Bereitet die Gruppenkurs-Abrechnung am Versandzeitpunkt vor: zählt die
 * tatsächlichen Teilnehmer, berechnet den Preis pro Person aus den Kurs-Tiers,
 * legt (idempotent) die Rechnung an und liefert den Render-Kontext (Betrag,
 * Methode, TWINT-Link oder PDF-Link). So gilt „mehr Leute = günstiger" auch
 * rückwirkend, weil die Lektion zu diesem Zeitpunkt vorbei ist.
 */
async function prepareGroupPayment(
  admin: SupabaseClient,
  appointmentId: string,
  sessionId: string
): Promise<Record<string, unknown>> {
  const { data: appt } = await admin
    .from("appointments")
    .select("id, student_id, start_at")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) throw new Error(`Group appointment not found: ${appointmentId}`);

  const { data: session } = await admin
    .from("group_sessions")
    .select("id, course_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) throw new Error(`Group session not found: ${sessionId}`);

  const { data: course } = await admin
    .from("group_courses")
    .select("id, title, price_tiers")
    .eq("id", session.course_id)
    .maybeSingle();
  if (!course) throw new Error(`Group course not found: ${session.course_id}`);

  const { count } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("group_session_id", sessionId)
    .in("status", ["booked", "completed"]);
  const participantCount = count ?? 1;
  const amount = pricePerPersonFor(
    { price_tiers: course.price_tiers as Record<string, number> },
    participantCount
  );

  // Ohne hinterlegte Preisstaffel liefert pricePerPersonFor 0. Dann lieber
  // gar keine Rechnung stellen als eine über CHF 0, die würde als bezahlt
  // durchlaufen und der Betrag wäre für immer verloren.
  if (!(amount > 0)) {
    throw new Error(
      `Gruppenkurs "${course.title}" hat keine gültige Preisstaffel: ` +
        `Rechnung für Termin ${appointmentId} wurde nicht erstellt.`
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("vorname, nachname, adresse, payment_method")
    .eq("id", appt.student_id)
    .maybeSingle();
  const method: "twint" | "qr" = zahlungsartFuer(profile);
  const studentName = profile
    ? `${profile.vorname} ${profile.nachname}`
    : "Schüler";

  // Idempotenz: existiert schon eine Rechnung für diesen Termin?
  let invoiceId: string | null = null;
  let invoiceNumber: string | null = null;
  const { data: existing } = await admin
    .from("invoices")
    .select("id, invoice_number")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  if (existing) {
    invoiceId = existing.id;
    invoiceNumber = existing.invoice_number;
  } else {
    const { data: inv } = await admin
      .from("invoices")
      .insert({
        student_id: appt.student_id,
        appointment_id: appointmentId,
        group_session_id: sessionId,
        amount,
        payer_name: studentName,
        payer_address: profile?.adresse ?? null,
        status: "unpaid",
        method,
        lesson_date: appt.start_at,
      })
      .select("id, invoice_number")
      .maybeSingle();
    invoiceId = inv?.id ?? null;
    invoiceNumber = inv?.invoice_number ?? null;
  }

  const ctx: Record<string, unknown> = {
    student_name: studentName,
    course_title: course.title,
    lesson_date: appt.start_at,
    amount,
    method,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    participant_count: participantCount,
  };
  if (method === "twint") {
    ctx.twint_link = buildLessonTwintLink(amount, appt.start_at, course.title);
  } else if (invoiceId) {
    const link = await ensureInvoicePdfLink(admin, invoiceId);
    if (link) ctx.pdf_link = link;
  }
  return ctx;
}
