// ============================================================
// Mailkategorien: welche Adresse eines Schülers welche Post bekommt
//
// Vier Kategorien statt vierzig Mailtypen. Der Vater will die Rechnungen,
// die Mutter die Terminerinnerungen; niemand will vierzig Häkchen setzen.
//
// Die Zuordnung Mailtyp → Kategorie steht hier, an einer Stelle, und ein
// Test prüft, dass jeder Mailtyp, der an Schüler geht, eine hat. Eine neue
// Mail ohne Kategorie fällt damit beim ersten Testlauf auf, nicht beim
// ersten Elternteil, das sie nicht bekommen hat.
//
// Reine Funktionen. Datenbank in mail-empfaenger-server.ts.
// ============================================================

export const KATEGORIEN = ["zahlungen", "termine", "abo", "sonstiges"] as const;
export type MailKategorie = (typeof KATEGORIEN)[number];

export const KATEGORIE_LABELS: Record<MailKategorie, { titel: string; hinweis: string }> = {
  zahlungen: {
    titel: "Zahlungen",
    hinweis: "Rechnungen, TWINT, Zahlungsbestätigungen, Erinnerungen an offene Beträge",
  },
  termine: {
    titel: "Termine",
    hinweis: "Terminbestätigungen, Erinnerungen vor der Lektion, Verschiebungen, Ausfälle",
  },
  abo: {
    titel: "Abo und Vertrag",
    hinweis: "Abo-Bestätigung, Verlängerung, Kündigung, Umstellung, Terminplanung",
  },
  sonstiges: {
    titel: "Sonstiges",
    hinweis: "Bitte um Bewertung, Gruppenkurse",
  },
};

/**
 * Mailtyp → Kategorie. Nur Mails an Schüler; was an David geht, steht hier
 * nicht. Login-Mails (Passwort, Zugang) laufen nicht über diese Tabelle:
 * Sie gehen immer an die Adresse des Kontos.
 */
const ZUORDNUNG: Record<string, MailKategorie> = {
  // Zahlungen
  twint_payment_request: "zahlungen",
  qr_invoice: "zahlungen",
  payment_confirmed: "zahlungen",
  payment_rejected: "zahlungen",
  group_payment_request: "zahlungen",
  zahlung_erinnerung: "zahlungen",
  payment_overdue: "zahlungen",
  package_settlement_paid: "zahlungen",
  ausfall_gutschrift: "zahlungen",

  // Termine
  booking_request_received: "termine",
  booking_confirmed: "termine",
  booking_rejected: "termine",
  proposal_new: "termine",
  reschedule_request_received: "termine",
  reschedule_confirmed: "termine",
  reschedule_rejected: "termine",
  appointment_cancelled_student: "termine",
  appointment_cancelled_by_admin: "termine",
  lesson_reminder_24h: "termine",
  lesson_reminder_2h: "termine",
  fixplatz_confirmed: "termine",
  ausfall_ersatz_vorschlag: "termine",
  ausfall_nachgeholt: "termine",
  ausfall_kurzfristig: "termine",
  vorrueck_angebot: "termine",
  vorrueck_bestaetigt: "termine",

  // Abo und Vertrag
  package_created: "abo",
  package_cancelled: "abo",
  package_expiring: "abo",
  subscription_renewal_notice: "abo",
  subscription_renewed: "abo",
  subscription_expired: "abo",
  subscription_cancelled: "abo",
  rhythmus_changed: "abo",
  abo_gestartet: "abo",
  abo_verlaengert: "abo",
  abo_beendet: "abo",
  abo_endet_bald: "abo",
  verfuegbarkeit_anfrage: "abo",
  verfuegbarkeit_einzelanfrage: "abo",
  verfuegbarkeit_erinnerung: "abo",
  verfuegbarkeit_zuteilung: "abo",
  umstellung_info: "abo",
  umstellung_erinnerung: "abo",
  umstellung_bestaetigung: "abo",

  // Sonstiges
  bewertung_anfrage: "sonstiges",
  group_session_created: "sonstiges",
  group_session_joined: "sonstiges",
  group_session_left: "sonstiges",
};

/** Kategorie eines Mailtyps, oder null für Typen, die nicht an Schüler gehen. */
export function kategorieVon(type: string): MailKategorie | null {
  return ZUORDNUNG[type] ?? null;
}

export type Adresse = { email: string; kategorien: readonly string[] };

/**
 * Wer bekommt diese Mail?
 *
 * Alle Adressen, die die Kategorie angekreuzt haben, die Hauptadresse
 * eingeschlossen. Hat niemand sie angekreuzt, springt die Hauptadresse ein:
 * Ein fehlendes Häkchen darf keine Rechnung verschlucken.
 *
 * Unbekannter Typ: nur die Hauptadresse. Das ist die Sicherheit für eine
 * Mail, die jemand baut und hier vergisst.
 */
export function empfaengerFuer(
  type: string,
  haupt: Adresse | null,
  weitere: Adresse[]
): string[] {
  const kategorie = kategorieVon(type);
  const raus: string[] = [];
  const nimm = (e: string | null | undefined) => {
    const sauber = (e ?? "").trim();
    if (!sauber) return;
    if (raus.some((x) => x.toLowerCase() === sauber.toLowerCase())) return;
    raus.push(sauber);
  };

  if (kategorie) {
    if (haupt && haupt.kategorien.includes(kategorie)) nimm(haupt.email);
    for (const a of weitere) if (a.kategorien.includes(kategorie)) nimm(a.email);
  }

  if (raus.length === 0 && haupt) nimm(haupt.email);
  return raus;
}
