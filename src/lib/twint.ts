/**
 * TWINT Deep-Link Hilfsfunktion (Spec §6 – TWINT).
 * Kein echtes Payment-API – nur Deep-Link-Generator.
 */

const TWINT_BASE_URL =
  process.env.TWINT_BASE_URL ??
  "https://go.twint.ch/1/e/tw?tw=acq.6YabPo0CSR6u1rxllpn-W0WWPnkfZMQnBMX_JvCpUKrIMZZJaBhIz5pjf-UeImB-.";

/**
 * Baut den TWINT Deep-Link zusammen.
 * @param amount  Betrag in CHF
 * @param trxInfo Zahlungsreferenz / Beschreibung (z.B. Rechnungsnummer)
 */
export function buildTwintLink(amount: number, trxInfo: string): string {
  return `${TWINT_BASE_URL}&trxInfo=${encodeURIComponent(trxInfo)}&amount=${amount.toFixed(2)}`;
}
