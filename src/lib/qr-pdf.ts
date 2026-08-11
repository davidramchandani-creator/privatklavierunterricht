// ============================================================
// Schweizer QR-Rechnung als PDF — lokal erzeugt
//
// Warum lokal und nicht über einen Dienst: Die Rechnung ist der Weg, auf dem
// das Geld hereinkommt. Hängt sie an einem fremden HTTP-Dienst, hängt auch
// der Zahlungseingang daran — und der bisherige Ausweg bei einem Ausfall war
// eine Textdatei mit dem rohen QR-Datenstring, die niemand bezahlen kann.
//
// Der Swiss-QR-Standard ist vollständig offengelegt, das Erzeugen braucht
// keinen Dienst. Damit gibt es keinen Schlüssel zu pflegen, keinen Ausfall
// abzufangen und keine Kosten pro Rechnung.
// ============================================================

import PDFDocument from "pdfkit";
import { SwissQRBill } from "swissqrbill/pdf";

/** Zerlegte Schweizer Adresse, wie der QR-Standard sie verlangt. */
export type SchweizerAdresse = {
  strasse: string;
  nummer: string;
  plz: string;
  ort: string;
};

/**
 * Zerlegt „Sattleracherstrasse 59, 8413 Neftenbach" in seine Teile.
 *
 * Der QR-Standard verlangt Strasse, Hausnummer, PLZ und Ort einzeln — eine
 * einzeilige Adresse genügt ihm nicht. Gespeichert wird sie bei uns aber als
 * eine Zeile, also muss sie hier zerlegt werden.
 *
 * Gibt `null` zurück, wenn etwas fehlt. Das ist Absicht: eine Rechnung mit
 * geratener Adresse wäre schlimmer als gar keine, weil sie zwar zugestellt
 * wird, aber im schlimmsten Fall nicht zuordenbar ist. Wer hier `null`
 * bekommt, soll die Adresse im Profil vervollständigen.
 */
export function parseSchweizerAdresse(text: string | null): SchweizerAdresse | null {
  if (!text) return null;

  const roh = text.trim().replace(/\s+/g, " ");
  if (!roh) return null;

  // Erwartet wird „Strassenteil, PLZ Ort". Ohne Komma fehlt der Ortsteil —
  // etwa bei einer Adresse, die nur aus Strasse und Nummer besteht.
  const teile = roh.split(",").map((t) => t.trim()).filter(Boolean);
  if (teile.length < 2) return null;

  // Der Ortsteil ist der letzte Abschnitt: vierstellige PLZ, dann der Ort.
  // Klammerzusätze wie „Aesch (Neftenbach)" bleiben erhalten – sie gehören
  // zum amtlichen Ortsnamen und stören die Zustellung nicht.
  const ortsTeil = teile[teile.length - 1];
  const ortsTreffer = ortsTeil.match(/^(\d{4})\s+(.+)$/);
  if (!ortsTreffer) return null;

  const [, plz, ort] = ortsTreffer;

  // Der Strassenteil ist alles davor. Bei mehreren Kommas (z. B. „c/o Meier,
  // Bahnhofstrasse 10, 8400 Winterthur") zählt der letzte Abschnitt vor dem
  // Ort als Strasse.
  const strassenTeil = teile[teile.length - 2];

  // Hausnummer: die letzte Zahl am Ende, samt möglichem Zusatz wie „12a"
  // oder „7-9". Fehlt sie, ist die Adresse trotzdem gültig — es gibt Häuser
  // ohne Nummer, und der Standard erlaubt ein leeres Feld.
  const nummerTreffer = strassenTeil.match(/^(.*?)\s+(\d+\s*[a-zA-Z]?(?:[-/]\d+\s*[a-zA-Z]?)?)$/);

  const strasse = (nummerTreffer ? nummerTreffer[1] : strassenTeil).trim();
  const nummer = nummerTreffer ? nummerTreffer[2].replace(/\s+/g, "") : "";

  if (!strasse || !ort) return null;

  return { strasse, nummer, plz, ort };
}

export type QrRechnungParams = {
  invoiceNumber: string;
  amount: number;
  /** Zahlungspflichtiger. */
  debtorName: string;
  debtorAdresse: SchweizerAdresse;
  /** Zahlungsempfänger – deine Angaben. */
  creditor: {
    name: string;
    iban: string;
    adresse: SchweizerAdresse;
  };
  /** Zahlungszweck; erscheint auf dem Einzahlungsschein. */
  message?: string;
};

/**
 * Erzeugt die Rechnung als PDF: eine Seite mit Kopf und dem
 * standardkonformen Einzahlungsteil am unteren Rand.
 */
export async function erzeugeQrRechnungPdf(
  params: QrRechnungParams
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];

  const fertig = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const betrag = params.amount.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  doc.fontSize(18).fillColor("#1C244B").text("Rechnung", 50, 60);
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#333333");
  doc.text(`Nummer: ${params.invoiceNumber}`);
  doc.text(
    `Datum: ${new Date().toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}`
  );
  doc.moveDown(1);

  doc.fontSize(11).fillColor("#333333");
  doc.text(params.debtorName);
  doc.text(`${params.debtorAdresse.strasse} ${params.debtorAdresse.nummer}`.trim());
  doc.text(`${params.debtorAdresse.plz} ${params.debtorAdresse.ort}`);
  doc.moveDown(1.5);

  doc.fontSize(12).fillColor("#000000");
  doc.text(params.message ?? `Klavierunterricht – Rechnung ${params.invoiceNumber}`);
  doc.moveDown(0.5);
  doc.fontSize(14).text(`Betrag: CHF ${betrag}`);
  doc.moveDown(1);
  doc
    .fontSize(10)
    .fillColor("#666666")
    .text(
      "Bitte mit dem untenstehenden Einzahlungsschein bezahlen. Vielen Dank."
    );

  const bill = new SwissQRBill({
    amount: params.amount,
    currency: "CHF",
    creditor: {
      account: params.creditor.iban.replace(/\s+/g, ""),
      name: params.creditor.name,
      address: params.creditor.adresse.strasse,
      buildingNumber: params.creditor.adresse.nummer || undefined,
      zip: params.creditor.adresse.plz,
      city: params.creditor.adresse.ort,
      country: "CH",
    },
    debtor: {
      name: params.debtorName,
      address: params.debtorAdresse.strasse,
      buildingNumber: params.debtorAdresse.nummer || undefined,
      zip: params.debtorAdresse.plz,
      city: params.debtorAdresse.ort,
      country: "CH",
    },
    message: params.message ?? `Klavierunterricht - Rechnung ${params.invoiceNumber}`,
  });

  bill.attachTo(doc);
  doc.end();

  return fertig;
}
