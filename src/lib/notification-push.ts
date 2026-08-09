/**
 * Push-Texte für alle Benachrichtigungstypen.
 *
 * Jede Benachrichtigung, die per E-Mail rausgeht, bekommt hier eine kurze
 * Push-Variante. Gibt eine Funktion null zurück, wird für diesen Typ kein Push
 * gesendet (z. B. weil er rein informativ und nicht dringend ist).
 */

import type { PushPayload } from "@/lib/push";

const PORTAL = "/schueler/portal";
const ADMIN_TERMINE = "/admin/terminanfragen";
const ADMIN_ZAHLUNGEN = "/admin/zahlungen";

/** Datum/Zeit in Zürcher Lokalzeit, kurz. */
function fmt(iso: unknown): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("de-CH", {
      timeZone: "Europe/Zurich",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(String(iso)));
  } catch {
    return "";
  }
}

function money(v: unknown): string {
  const n = Number(v ?? 0);
  return `CHF ${n.toFixed(2)}`;
}

type Builder = (p: Record<string, unknown>) => PushPayload | null;

const BUILDERS: Record<string, Builder> = {
  // ── Termine: Schüler ──────────────────────────────────────────────
  booking_confirmed: (p) => ({
    title: "Termin bestätigt",
    body: p.starts && Array.isArray(p.starts) && p.starts.length > 1
      ? `${(p.starts as string[]).length} Lektionen ab ${fmt((p.starts as string[])[0])}`
      : `Deine Lektion am ${fmt(p.lesson_date ?? (p.starts as string[] | undefined)?.[0] ?? p.start_at)} ist fix.`,
    url: PORTAL,
    tag: "booking",
  }),
  booking_rejected: (p) => ({
    title: "Terminanfrage abgelehnt",
    body: p.reason ? String(p.reason) : "Deine Anfrage konnte leider nicht bestätigt werden.",
    url: PORTAL,
    tag: "booking",
  }),
  booking_request_received: () => ({
    title: "Anfrage eingegangen",
    body: "Ich melde mich, sobald ich sie bestätigt habe.",
    url: PORTAL,
    tag: "booking",
  }),
  proposal_new: (p) => ({
    title: "Neuer Terminvorschlag",
    body: `${fmt(p.proposed_start)} – im Portal bestätigen oder ablehnen.`,
    url: PORTAL,
    tag: "proposal",
  }),
  reschedule_confirmed: (p) => ({
    title: "Verschiebung bestätigt",
    body: `Neuer Termin: ${fmt(p.proposed_start)}`,
    url: PORTAL,
    tag: "reschedule",
  }),
  reschedule_rejected: (p) => ({
    title: "Verschiebung abgelehnt",
    body: p.reason ? String(p.reason) : `Der Termin am ${fmt(p.original_start)} bleibt bestehen.`,
    url: PORTAL,
    tag: "reschedule",
  }),
  reschedule_request_received: () => ({
    title: "Verschiebung beantragt",
    body: "Ich schaue sie mir an und melde mich.",
    url: PORTAL,
    tag: "reschedule",
  }),
  appointment_cancelled_student: (p) => ({
    title: "Termin storniert",
    body: `Deine Lektion am ${fmt(p.start_at)} wurde storniert.`,
    url: PORTAL,
    tag: "cancel",
  }),
  appointment_cancelled_by_admin: (p) => ({
    title: "Termin abgesagt",
    body: p.start_at
      ? `Die Lektion am ${fmt(p.start_at)} musste ich leider absagen.`
      : "Eine deiner Lektionen musste ich leider absagen.",
    url: PORTAL,
    tag: "cancel",
  }),

  // ── Zahlungen: Schüler ────────────────────────────────────────────
  twint_payment_request: (p) => ({
    title: "Zahlung offen",
    body: `${money(p.amount)} – jetzt per TWINT begleichen.`,
    url: PORTAL,
    tag: "payment",
  }),
  qr_invoice: (p) => ({
    title: "Neue Rechnung",
    body: `${money(p.amount)} – QR-Rechnung im Portal.`,
    url: PORTAL,
    tag: "payment",
  }),
  payment_confirmed: (p) => ({
    title: "Zahlung bestätigt",
    body: `Danke! ${money(p.amount)} ist eingegangen.`,
    url: PORTAL,
    tag: "payment",
  }),
  payment_rejected: (p) => ({
    title: "Zahlung nicht gefunden",
    body: p.reason ? String(p.reason) : `${money(p.amount)} konnte ich nicht zuordnen.`,
    url: PORTAL,
    tag: "payment",
  }),
  package_cancelled: () => ({
    title: "Paket storniert",
    body: "Die Abrechnung findest du in deiner Mail.",
    url: PORTAL,
    tag: "package",
  }),
  package_settlement_paid: () => ({
    title: "Zahlung bestätigt",
    body: "Der offene Betrag ist beglichen. Danke!",
    url: PORTAL,
    tag: "payment",
  }),

  // ── Gruppenkurse ──────────────────────────────────────────────────
  group_session_created: (p) => ({
    title: "Neuer Gruppenkurs-Termin",
    body: `${p.course_title ?? "Gruppenkurs"} am ${fmt(p.start_at)}`,
    url: PORTAL,
    tag: "group",
  }),
  group_session_joined: (p) => ({
    title: "Anmeldung bestätigt",
    body: `${p.course_title ?? "Gruppenkurs"} am ${fmt(p.start_at)}`,
    url: PORTAL,
    tag: "group",
  }),
  group_payment_request: (p) => ({
    title: "Gruppenkurs – Zahlung offen",
    body: `${money(p.amount)} für ${p.course_title ?? "den Kurs"}.`,
    url: PORTAL,
    tag: "payment",
  }),

  // ── Reminder (neu) ────────────────────────────────────────────────
  lesson_reminder_24h: (p) => ({
    title: "Morgen Klavierunterricht",
    body: `${fmt(p.start_at)} – bis heute Abend kannst du noch verschieben.`,
    url: PORTAL,
    tag: `reminder-${p.appointment_id ?? ""}`,
  }),
  lesson_reminder_2h: (p) => ({
    title: "Gleich Klavierunterricht",
    body: `Deine Lektion beginnt um ${fmt(p.start_at)}.`,
    url: PORTAL,
    tag: `reminder2-${p.appointment_id ?? ""}`,
  }),
  payment_overdue: (p) => ({
    title: "Zahlung überfällig",
    body: `${money(p.amount)} ist seit dem ${fmt(p.due_date)} fällig.`,
    url: PORTAL,
    tag: "payment",
  }),
  package_expiring: (p) => ({
    title: "Paket läuft bald ab",
    body: p.lessons_remaining
      ? `Noch ${p.lessons_remaining} Lektion(en) bis ${fmt(p.expires_at)}.`
      : `Gültig noch bis ${fmt(p.expires_at)}.`,
    url: PORTAL,
    tag: "package",
  }),

  package_created: (p) => ({
    title: p.billing_mode === "raten" ? "Paket bereit – Anzahlung offen" : "Paket bereit",
    body:
      p.billing_mode === "raten"
        ? "Nach der Anzahlung kannst du Termine buchen."
        : `${p.package_label ?? "Dein Paket"} ist ab sofort buchbar.`,
    url: PORTAL,
    tag: "abo",
  }),

  // ── Abo-Modell ────────────────────────────────────────────────────
  subscription_renewal_notice: (p) => ({
    title: "Abo verlängert sich bald",
    body: p.lessons_remaining
      ? `Noch ${p.lessons_remaining} Lektion(en) bis ${fmt(p.expires_at)}. Kündbar im Portal.`
      : `Verlängerung am ${fmt(p.expires_at)}. Kündbar im Portal.`,
    url: PORTAL,
    tag: "abo",
  }),
  subscription_renewed: (p) => ({
    title: "Abo verlängert",
    body: `${p.package_label ?? "Dein Paket"} ist wieder buchbar${
      p.expires_at ? ` – gültig bis ${fmt(p.expires_at)}` : ""
    }.`,
    url: PORTAL,
    tag: "abo",
  }),
  subscription_expired: (p) => ({
    title: "Paket abgelaufen",
    body: p.lessons_forfeited
      ? `${p.lessons_forfeited} nicht genutzte Lektion(en) sind verfallen.`
      : "Du kannst jederzeit ein neues Paket lösen.",
    url: PORTAL,
    tag: "abo",
  }),
  subscription_cancelled: (p) => ({
    title: "Verlängerung abgeschaltet",
    body: `Dein Paket läuft am ${fmt(p.expires_at)} aus. Restliche Lektionen vorher buchen.`,
    url: PORTAL,
    tag: "abo",
  }),

  // ── Admin ─────────────────────────────────────────────────────────
  booking_request_admin: (p) => ({
    title: "Neue Terminanfrage",
    body: `${p.student_name ?? "Ein Schüler"} – ${p.lessons_count ?? 1} Termin(e)`,
    url: ADMIN_TERMINE,
    tag: "admin-booking",
  }),
  reschedule_request_admin: (p) => ({
    title: "Verschiebung angefragt",
    body: `${p.student_name ?? "Ein Schüler"}: ${fmt(p.original_start)} → ${fmt(p.proposed_start)}`,
    url: ADMIN_TERMINE,
    tag: "admin-reschedule",
  }),
  appointment_cancelled_by_student: (p) => ({
    title: "Termin storniert",
    body: `${p.student_name ?? "Ein Schüler"} hat ${fmt(p.start_at)} abgesagt.`,
    url: "/admin/kalender",
    tag: "admin-cancel",
  }),
  booking_request_withdrawn: (p) => ({
    title: "Anfrage zurückgezogen",
    body: `${p.student_name ?? "Ein Schüler"} hat eine Anfrage zurückgezogen.`,
    url: ADMIN_TERMINE,
    tag: "admin-booking",
  }),
  reschedule_request_withdrawn: (p) => ({
    title: "Verschiebung zurückgezogen",
    body: `${p.student_name ?? "Ein Schüler"} hat die Anfrage zurückgezogen.`,
    url: ADMIN_TERMINE,
    tag: "admin-reschedule",
  }),
  proposal_rejected_admin: (p) => ({
    title: "Vorschlag abgelehnt",
    body: `${p.student_name ?? "Ein Schüler"} hat ${fmt(p.proposed_start)} abgelehnt.`,
    url: ADMIN_TERMINE,
    tag: "admin-proposal",
  }),
  anfrage_admin: (p) => ({
    title: p.quelle === "kontakt" ? "Neue Kontaktanfrage" : "Neue Probelektion-Anfrage",
    body: `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || "Neue Anfrage eingegangen.",
    url: "/admin/anfragen",
    tag: "admin-anfrage",
  }),
  payment_reported_admin: (p) => ({
    title: "Zahlung gemeldet",
    body: `${p.student_name ?? "Ein Schüler"} hat ${money(p.amount)} als bezahlt markiert – bitte prüfen.`,
    url: ADMIN_ZAHLUNGEN,
    tag: "admin-payment",
  }),
  package_purchased_admin: (p) => ({
    title: "Neues Paket gebucht",
    body: `${p.student_name ?? "Ein Schüler"}: ${p.package_label ?? "Paket"} für ${money(p.total_price)}`,
    url: ADMIN_ZAHLUNGEN,
    tag: "admin-package",
  }),
  proposal_accepted_admin: (p) => ({
    title: "Vorschlag angenommen",
    body: `${p.student_name ?? "Ein Schüler"} hat ${fmt(p.proposed_start)} bestätigt.`,
    url: "/admin/kalender",
    tag: "admin-proposal",
  }),
  group_session_admin: (p) => ({
    title: "Gruppenkurs-Anmeldung",
    body: `${p.student_name ?? "Ein Schüler"} – ${p.course_title ?? "Gruppenkurs"}`,
    url: "/admin/gruppenkurse",
    tag: "admin-group",
  }),
  subscription_renewed_admin: (p) => ({
    title: "Abo verlängert",
    body: `${p.student_name ?? "Ein Schüler"} – ${p.package_label ?? "Paket"} automatisch erneuert.`,
    url: "/admin/schueler",
    tag: "abo-admin",
  }),
  subscription_cancelled_admin: (p) => ({
    title: "Abo gekündigt",
    body: `${p.student_name ?? "Ein Schüler"} hat die Verlängerung abgeschaltet.`,
    url: "/admin/schueler",
    tag: "abo-admin",
  }),
};

/** Push-Inhalt für einen Benachrichtigungstyp – oder null, wenn keiner gewünscht. */
export function buildPush(
  type: string,
  payload: Record<string, unknown>
): PushPayload | null {
  const builder = BUILDERS[type];
  if (!builder) return null;
  try {
    return builder(payload);
  } catch {
    return null;
  }
}
