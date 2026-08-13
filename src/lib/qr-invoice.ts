/**
 * QR-Rechnung via LivingTech API (Spec §6, QR-Rechnung).
 * Serverseitiger Code: API-Key aus env, nie im Client verwenden.
 */

import { erzeugeQrRechnungPdf, parseSchweizerAdresse } from "./qr-pdf";

const LIVINGTECH_API_KEY = process.env.LIVINGTECH_API_KEY ?? "";
const PIANO_IBAN = (process.env.PIANO_IBAN ?? "CH6808307000541179306").replace(/\s/g, "");
const PIANO_CREDITOR_NAME = process.env.PIANO_CREDITOR_NAME ?? "David Ramchandani";
const PIANO_CREDITOR_ADDRESS = process.env.PIANO_CREDITOR_ADDRESS ?? "Sattleracherstrasse 59, 8413 Neftenbach";

export type QRInvoiceParams = {
  invoiceNumber: string;
  amount: number;
  debtorName: string;
  debtorAddress: string;
  message?: string;
};

export type QRInvoiceResult =
  | { type: "pdf"; pdfBuffer: Buffer }
  | { type: "spc"; spcData: string };

/**
 * Baut den SPC-Fallback-String (Swiss Payment Code) als plain text.
 * Format: https://www.paymentstandards.ch/dam/downloads/ig-qr-bill-en.pdf
 */
export function buildSpcData(params: QRInvoiceParams): string {
  const { invoiceNumber, amount, debtorName, debtorAddress, message } = params;

  // Adresse aufteilen: "Sattleracherstrasse 59, 8413 Neftenbach" → AddressLine1 / AddressLine2
  const creditorParts = PIANO_CREDITOR_ADDRESS.split(",").map((s) => s.trim());
  const creditorLine1 = creditorParts[0] ?? "";
  const creditorLine2 = creditorParts.slice(1).join(", ") ?? "";

  // Debtor-Adresse aufteilen
  const debtorParts = debtorAddress.split(",").map((s) => s.trim());
  const debtorLine1 = debtorParts[0] ?? "";
  const debtorLine2 = debtorParts.slice(1).join(", ") ?? "";

  const msg = message ?? `Klavierunterricht, Rechnung ${invoiceNumber}`;
  const amountStr = amount.toFixed(2);

  const lines = [
    "SPC",           // QR type
    "0200",          // Version
    "1",             // Coding type
    PIANO_IBAN,      // Account
    "S",             // Creditor address type
    PIANO_CREDITOR_NAME,
    creditorLine1,
    creditorLine2,
    "",
    "",
    "CH",
    "",              // Ultimate creditor (leer)
    "",
    "",
    "",
    "",
    "",
    "",
    amountStr,       // Amount
    "CHF",           // Currency
    "S",             // Debtor address type
    debtorName,
    debtorLine1,
    debtorLine2,
    "",
    "",
    "CH",
    "NON",           // Reference type
    "",              // Reference
    msg,             // Unstructured message
    "EPD",           // End payment data
  ];

  return lines.join("\n");
}

/**
 * Erzeugt eine QR-Rechnung als PDF.
 *
 * Zuerst lokal (`qr-pdf.ts`), weil die Rechnung der Weg ist, auf dem das Geld
 * hereinkommt, sie darf nicht von einem fremden Dienst abhängen. Der frühere
 * Ausweg bei einem Ausfall war eine Textdatei mit dem rohen QR-Datenstring,
 * die kein Mensch bezahlen kann; genau das ist im Bestand auch passiert.
 *
 * Die LivingTech-API bleibt als ausdrückliche Ausweichmöglichkeit bestehen,
 * falls die Adresse sich nicht zerlegen lässt und ein Schlüssel hinterlegt
 * ist. Der SPC-String ist nur noch die letzte Notlage, und wird vom
 * Aufrufer bewusst **nicht** dauerhaft gespeichert.
 */
export async function generateQRInvoicePdf(
  params: QRInvoiceParams
): Promise<QRInvoiceResult> {
  const { invoiceNumber, amount, debtorName, debtorAddress, message } = params;

  // ── Weg 1: lokal erzeugen ────────────────────────────────
  const debtorAdresse = parseSchweizerAdresse(debtorAddress);
  const creditorAdresse = parseSchweizerAdresse(PIANO_CREDITOR_ADDRESS);

  if (debtorAdresse && creditorAdresse) {
    try {
      const pdfBuffer = await erzeugeQrRechnungPdf({
        invoiceNumber,
        amount,
        debtorName,
        debtorAdresse,
        creditor: {
          name: PIANO_CREDITOR_NAME,
          iban: PIANO_IBAN,
          adresse: creditorAdresse,
        },
        message,
      });
      return { type: "pdf", pdfBuffer };
    } catch (err) {
      console.error("[qr] Lokale PDF-Erzeugung fehlgeschlagen:", err);
    }
  } else if (!debtorAdresse) {
    console.error(
      `[qr] Adresse von ${debtorName} laesst sich nicht zerlegen: "${debtorAddress}". ` +
        "Erwartet wird: Strasse Nr., PLZ Ort"
    );
  }

  // ── Weg 2: LivingTech, nur mit hinterlegtem Schlüssel ────
  const debtorParts = debtorAddress.split(",").map((s) => s.trim());
  const debtorLine1 = debtorParts[0] ?? "";
  const debtorLine2 = debtorParts.slice(1).join(", ") ?? "";

  const creditorParts = PIANO_CREDITOR_ADDRESS.split(",").map((s) => s.trim());
  const creditorLine1 = creditorParts[0] ?? "";
  const creditorLine2 = creditorParts.slice(1).join(", ") ?? "";

  const requestBody = {
    Language: "DE",
    Format: "PDF",
    Account: PIANO_IBAN,
    Creditor: {
      Name: PIANO_CREDITOR_NAME,
      AddressLine1: creditorLine1,
      AddressLine2: creditorLine2,
      CountryCode: "CH",
    },
    Debtor: {
      Name: debtorName,
      AddressLine1: debtorLine1,
      AddressLine2: debtorLine2,
      CountryCode: "CH",
    },
    Amount: amount,
    Currency: "CHF",
    UnstructuredMessage:
      message ?? `Klavierunterricht, Rechnung ${invoiceNumber}`,
  };

  try {
    if (!LIVINGTECH_API_KEY) {
      throw new Error("LIVINGTECH_API_KEY not configured");
    }

    const response = await fetch("https://api.livingtech.ch/v1/qr-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": LIVINGTECH_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`LivingTech API error ${response.status}: ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return { type: "pdf", pdfBuffer: Buffer.from(arrayBuffer) };
  } catch (err) {
    console.error("QR invoice API failed, falling back to SPC:", err);
    return { type: "spc", spcData: buildSpcData(params) };
  }
}
