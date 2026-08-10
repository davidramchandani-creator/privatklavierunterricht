/**
 * TWINT Deep-Link Hilfsfunktion (Spec §6 – TWINT).
 * Kein echtes Payment-API – nur Deep-Link-Generator.
 */

/**
 * Der Acquirer-Link enthält ein Zahlungs-Token und gehört deshalb NICHT
 * in den Quellcode (öffentliches Repo). Er kommt ausschliesslich aus der
 * Umgebungsvariable TWINT_BASE_URL.
 *
 * Fehlt sie, liefern die Builder einen leeren String. Aufrufer behandeln
 * das als "TWINT nicht verfügbar" und zeigen nur die QR-Rechnung an –
 * es entstehen also keine kaputten Zahlungslinks.
 */
const TWINT_BASE_URL = (process.env.TWINT_BASE_URL ?? "").trim();

let warned = false;
function warnMissing(): void {
  if (warned) return;
  warned = true;
  console.error(
    "[twint] TWINT_BASE_URL ist nicht gesetzt – TWINT-Zahlungen sind deaktiviert, " +
      "es wird nur die QR-Rechnung angeboten."
  );
}

/** Ist TWINT konfiguriert? */
export function isTwintConfigured(): boolean {
  return TWINT_BASE_URL.length > 0;
}

/**
 * Baut den TWINT Deep-Link zusammen.
 * @param amount  Betrag in CHF
 * @param trxInfo Zahlungsreferenz / Beschreibung (z.B. Rechnungsnummer)
 */
export function buildTwintLink(amount: number, trxInfo: string): string {
  if (!TWINT_BASE_URL) {
    warnMissing();
    return "";
  }
  return `${TWINT_BASE_URL}&trxInfo=${encodeURIComponent(trxInfo)}&amount=${amount.toFixed(2)}`;
}

/**
 * Baut den Zahlungszweck (trxInfo) für eine gehaltene Lektion.
 * Erscheint in der TWINT-App als Verwendungszweck.
 * @param lessonDate ISO-Datum der Lektion (oder null für Sonderzahlungen)
 * @param label      optionaler Präfix (z.B. Kursname für Gruppenkurse)
 */
export function buildLessonTrxInfo(
  lessonDate: string | null,
  label?: string
): string {
  const prefix = label ?? "Klavierlektion";
  if (!lessonDate) return prefix;
  let datum = lessonDate;
  try {
    datum = new Intl.DateTimeFormat("de-CH", {
      timeZone: "Europe/Zurich",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(lessonDate));
  } catch {
    // Fallback: roher Wert
  }
  return `${prefix} vom ${datum}`;
}

/**
 * Vollständiger TWINT-Link für eine Lektion (Betrag + Zahlungszweck).
 */
export function buildLessonTwintLink(
  amount: number,
  lessonDate: string | null,
  label?: string
): string {
  return buildTwintLink(amount, buildLessonTrxInfo(lessonDate, label));
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
  if (!TWINT_BASE_URL) {
    warnMissing();
    return "";
  }
  return `<a href="${TWINT_BASE_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
  <img alt="Mit TWINT bezahlen" src="https://go.twint.ch/static/img/button_dark_en.svg" style="height:58px;width:auto;border:none;" />
</a>`;
}
