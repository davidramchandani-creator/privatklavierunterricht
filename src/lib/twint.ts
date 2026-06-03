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

/** Reiner TWINT-Acquirer-Link (für den offiziellen TWINT-Button). */
export function getTwintBaseUrl(): string {
  return TWINT_BASE_URL;
}

/**
 * Offizieller TWINT-Button als HTML-Snippet (für E-Mails). Verwendet das
 * offizielle TWINT-SVG. Klick öffnet den Acquirer-Link.
 */
export function twintButtonHtml(): string {
  return `<a href="${TWINT_BASE_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
  <img alt="Mit TWINT bezahlen" src="https://go.twint.ch/static/img/button_dark_en.svg" style="height:58px;width:auto;border:none;" />
</a>`;
}
