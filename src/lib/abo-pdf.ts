// ============================================================
// Abo-Bestätigung als PDF
//
// Dasselbe, was in der Bestätigungsmail steht, zum Ablegen und Ausdrucken.
// Kein Unterschriftsfeld: Bestätigt wurde beim Absenden des Formulars, mit
// Zeitstempel in der Datenbank. Ein Blatt, das zurückgeschickt werden müsste,
// bekäme man von der Hälfte nie zurück, und dann stünde die Frage im Raum,
// ob die andere Hälfte überhaupt gilt.
//
// ── Warum auf Abruf und nicht abgelegt ──────────────────────
//
// Erzeugt wird bei jedem Aufruf neu, aus dem, was gerade in der Datenbank
// steht. Eine einmal gespeicherte Datei wäre am Tag nach der ersten
// Terminverschiebung falsch, ohne dass es jemandem auffiele. Das Erzeugen
// dauert Millisekunden, das Risiko einer veralteten Bestätigung ist es nicht
// wert.
// ============================================================

import PDFDocument from "pdfkit";
import type { Bestaetigungsdaten } from "./umstellung-server";

const DUNKEL = "#1C244B";
const GRAU = "#64748b";
const TEXT = "#334155";

function datum(iso: string): string {
  const d = iso.length > 10 ? new Date(iso) : new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function terminZeile(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function franken(n: number): string {
  return n.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function erzeugeAboBestaetigungPdf(
  b: Bestaetigungsdaten
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];

  const fertig = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // ── Kopf ────────────────────────────────────────────────
  doc.fontSize(20).fillColor(DUNKEL).text("Abo-Bestätigung", 50, 55);
  doc
    .fontSize(10)
    .fillColor(GRAU)
    .text("Klavierunterricht David Ramchandani", 50, 80);

  doc
    .fontSize(9)
    .fillColor(GRAU)
    .text(`Ausgestellt am ${datum(new Date().toISOString())}`, 50, 80, {
      align: "right",
      width: doc.page.width - 100,
    });

  doc.moveTo(50, 102).lineTo(doc.page.width - 50, 102).strokeColor("#e2e8f0").stroke();

  // ── Empfänger ───────────────────────────────────────────
  doc.fontSize(12).fillColor(TEXT).text(b.studentName, 50, 122);

  // ── Eckdaten ────────────────────────────────────────────
  let y = 160;
  doc.fontSize(13).fillColor(DUNKEL).text("Dein Abo", 50, y);
  y += 24;

  const zeilen: [string, string][] = [
    ["Abo", b.aboLabel],
    ["Unterricht", b.fixplatzText],
    ["Laufzeit", `${datum(b.periodeStart)} bis ${datum(b.periodeEnde)}`],
    ["Lektionen", `${b.lektionen} à 45 Minuten`],
    ["Preis pro Lektion", `CHF ${franken(b.preisProLektion)}`],
    ["Gesamtbetrag", `CHF ${franken(b.gesamtpreis)}`],
  ];

  for (const [k, v] of zeilen) {
    doc.fontSize(10).fillColor(GRAU).text(k, 50, y, { width: 150 });
    doc.fontSize(10).fillColor(TEXT).text(v, 200, y, { width: 300 });
    y += 20;
  }

  // Der Monatsbetrag ist die Zahl, die zählt: Sie steht auf jeder Rechnung
  // und ist die einzige, die monatlich wiederkehrt. Deshalb hervorgehoben.
  y += 6;
  doc.rect(50, y, doc.page.width - 100, 38).fillColor("#F3F5F8").fill();
  doc.fontSize(10).fillColor(GRAU).text("Pro Monat", 62, y + 13);
  doc
    .fontSize(14)
    .fillColor(DUNKEL)
    .text(`CHF ${franken(b.monatsbetrag)}`, 200, y + 11);
  y += 54;

  doc
    .fontSize(9)
    .fillColor(GRAU)
    .text(
      `Der Betrag bleibt über alle ${b.laufzeitMonate} Monate gleich, auch in Monaten mit mehr oder weniger Lektionen.`,
      50,
      y,
      { width: doc.page.width - 100 }
    );
  y += 30;

  // ── Bedingungen ─────────────────────────────────────────
  doc.fontSize(13).fillColor(DUNKEL).text("Was vereinbart ist", 50, y);
  y += 22;

  const punkte = [
    "In den Schulferien findet kein Unterricht statt. Diese Wochen sind in der Lektionszahl bereits abgezogen; sie werden weder verrechnet noch ersetzt.",
    "Der feste Termin gilt für die ganze Laufzeit. Alle Termine sind im Voraus eingetragen und im Portal einsehbar.",
    "Absagen bitte spätestens 24 Stunden vorher im Portal. Danach verfällt die Lektion. Bei rechtzeitiger Absage werden Ausweichtermine vorgeschlagen.",
    "Fällt der Unterricht von meiner Seite aus, gibt es in jedem Fall Ersatz, unabhängig von der Frist.",
    b.autoRenew
      ? "Das Abo verlängert sich am Ende der Laufzeit automatisch um dieselbe Dauer. Kündbar bis 30 Tage vor Ablauf, jederzeit im Portal."
      : "Das Abo endet am Ende der Laufzeit und verlängert sich nicht automatisch.",
  ];

  for (const p of punkte) {
    doc.fontSize(9).fillColor(TEXT).text(`•  ${p}`, 50, y, {
      width: doc.page.width - 100,
      lineGap: 1.5,
    });
    y = doc.y + 7;
  }

  // ── Ferien ──────────────────────────────────────────────
  if (b.ferientage.length > 0) {
    if (y > 680) {
      doc.addPage();
      y = 60;
    }
    y += 8;
    doc.fontSize(13).fillColor(DUNKEL).text("Ferien in dieser Laufzeit", 50, y);
    y += 20;
    doc
      .fontSize(9)
      .fillColor(GRAU)
      .text("Bereits abgezogen, du zahlst nichts dafür.", 50, y);
    y += 16;

    for (const f of b.ferientage) {
      if (y > 760) {
        doc.addPage();
        y = 60;
      }
      doc
        .fontSize(9)
        .fillColor(TEXT)
        .text(`${terminZeile(`${f.tag}T12:00:00Z`)}   ${f.grund}`, 50, y);
      y += 14;
    }
  }

  // ── Termine ─────────────────────────────────────────────
  if (b.termine.length > 0) {
    doc.addPage();
    y = 60;
    doc.fontSize(13).fillColor(DUNKEL).text("Deine Termine", 50, y);
    y += 20;
    doc
      .fontSize(9)
      .fillColor(GRAU)
      .text(
        `${b.termine.length} Lektionen, alle bereits eingetragen. Du musst nichts einzeln buchen.`,
        50,
        y
      );
    y += 22;

    // Zwei Spalten: eine einspaltige Liste über 39 Jahresabo-Termine
    // bräuchte zwei Seiten für Information, die auf eine passt.
    const proSpalte = Math.ceil(b.termine.length / 2);
    const startY = y;
    b.termine.forEach((t, i) => {
      const spalte = i < proSpalte ? 0 : 1;
      const zeile = i - spalte * proSpalte;
      const x = 50 + spalte * 250;
      const zy = startY + zeile * 16;
      doc
        .fontSize(9)
        .fillColor(GRAU)
        .text(`${i + 1}.`, x, zy, { width: 24 });
      const uhr = new Date(t).toLocaleTimeString("de-CH", {
        timeZone: "Europe/Zurich",
        hour: "2-digit",
        minute: "2-digit",
      });
      doc
        .fontSize(9)
        .fillColor(TEXT)
        .text(`${terminZeile(t)}, ${uhr}`, x + 24, zy, { width: 200 });
    });
  }

  doc.end();
  return fertig;
}
