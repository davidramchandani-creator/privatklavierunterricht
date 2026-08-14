/**
 * Womit bezahlt dieser Schüler?
 *
 * Klingt trivial, war aber an drei Stellen im Code drei verschiedene
 * Antworten:
 *
 *   createInvoiceForAppointment   nur das Paket, Profil ignoriert
 *   resendPaymentEmail            Profil, dann Paket
 *   package-invoice.resolveMethod Paket, dann Profil
 *
 * Das hat einer Schülerin eine QR-Rechnung gebracht, obwohl bei ihr TWINT
 * hinterlegt war: Ihr Paket trug noch das alte `qr` vom Anlegen, und
 * ausgerechnet die Stelle, die die Lektion abrechnet, sah nur aufs Paket.
 *
 * **Das Profil gewinnt.** Es ist der Ort, an dem der Admin die Zahlungsart
 * pflegt; sagt ein Schüler „ich zahle mit TWINT", ändert er sie dort. Der
 * Wert im Paket ist eine Momentaufnahme vom Tag des Anlegens und altert
 * still vor sich hin.
 *
 * Der Notnagel ist bewusst TWINT und nicht QR: Ein TWINT-Link entsteht aus
 * Betrag und Verwendungszweck und funktioniert immer. Eine QR-Rechnung
 * braucht eine zerlegbare Adresse und eine erfolgreiche PDF-Erzeugung — wo
 * die fehlschlägt, bekommt der Schüler eine kaputte Rechnung statt gar
 * keiner.
 */
export type Zahlungsart = "twint" | "qr";

function gueltig(wert: unknown): Zahlungsart | null {
  return wert === "twint" || wert === "qr" ? wert : null;
}

export function zahlungsartFuer(
  profil: { payment_method?: string | null } | null | undefined,
  paket?: { payment_method?: string | null } | null,
): Zahlungsart {
  return (
    gueltig(profil?.payment_method) ?? gueltig(paket?.payment_method) ?? "twint"
  );
}
