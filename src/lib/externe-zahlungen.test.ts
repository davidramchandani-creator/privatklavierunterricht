import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { baueAbrechnung, type Einnahme } from "./abrechnung";

/**
 * Externe Schüler zahlen über ihre Plattform. Bisher konnte David das nur
 * hochrechnen lassen; jetzt kann er bestätigen, was angekommen ist.
 *
 * Die Gefahr dabei ist immer dieselbe: dass eine Lektion zweimal zählt —
 * einmal bestätigt, einmal geschätzt — oder dass eine Schätzung
 * unbemerkt in die Steuererklärung rutscht.
 */
describe("Bestätigt und geschätzt bleiben getrennt", () => {
  const einnahmen: Einnahme[] = [
    {
      datum: "2026-08-05T10:00:00Z",
      betrag: 65,
      quelle: "rechnung",
      bezeichnung: "Flurina",
      belegt: true,
    },
    {
      datum: "2026-08-12T10:00:00Z",
      betrag: 68,
      quelle: "extern",
      bezeichnung: "Justine (Matchspace)",
      belegt: true,
    },
    {
      datum: "2026-08-26T15:00:00Z",
      betrag: 68,
      quelle: "extern",
      bezeichnung: "Justine (Matchspace)",
      belegt: false,
    },
  ];

  const a = baueAbrechnung({ monat: "2026-08", einnahmen, ausgaben: [] });

  it("bestätigte externe Zahlungen zählen voll mit", () => {
    // Sie sind so belegt wie eine bezahlte Rechnung: David hat den Eingang
    // selbst erfasst.
    expect(a.einnahmenExtern).toBe(68);
    expect(a.einnahmenTotal).toBe(133);
  });

  it("die Schätzung bleibt aussen vor", () => {
    // Der ganze Sinn der Trennung. Eine Schätzung in der Steuererklärung
    // wäre der teuerste Rundungsfehler des Jahres.
    expect(a.einnahmenGeschaetzt).toBe(68);
    expect(a.einnahmenTotal).not.toContain(a.einnahmenGeschaetzt);
    expect(a.einnahmenTotal).toBe(a.einnahmenSystem + a.einnahmenExtern);
  });

  it("das Ergebnis rechnet nur mit Belegtem", () => {
    expect(a.ergebnis).toBe(133);
  });

  it("die Schätzung ist trotzdem sichtbar", () => {
    // Sie ist Davids Merkzettel, was er bei der Plattform noch abgleichen
    // muss — verstecken wäre so falsch wie mitzählen.
    expect(a.einnahmen.filter((e) => !e.belegt)).toHaveLength(1);
  });
});

describe("Was der Server garantieren muss", () => {
  const server = readFileSync(
    join(process.cwd(), "src", "lib", "externe-zahlungen.ts"),
    "utf8"
  );
  const abrechnung = readFileSync(
    join(process.cwd(), "src", "lib", "abrechnung-server.ts"),
    "utf8"
  );

  it("verschickt nichts", () => {
    // Die harte Regel des ganzen Externen-Modells: nie Post an Externe.
    // Diese Datei darf gar keinen Zugang zum Mailversand haben.
    expect(server).not.toContain("sendEmail");
    expect(server).not.toContain("email-templates");
    expect(server).not.toContain("invoices");
  });

  it("lässt keinen eigenen Schüler durch", () => {
    // Ein eigener Schüler gehört über die Rechnung abgerechnet. Beides
    // gleichzeitig hiesse: doppelt gezählt.
    expect(server).toContain('profil?.extern !== true');
  });

  it("fängt den Doppelklick ab", () => {
    // 23505 ist die Unique-Verletzung des Index auf appointment_id.
    expect(server).toContain("23505");
  });

  it("nimmt eine bestätigte Lektion aus der Schätzung heraus", () => {
    // Sonst stünde dieselbe Lektion zweimal in der Abrechnung.
    expect(abrechnung).toContain("bestaetigt.has");
  });

  it("zählt bestätigte Zahlungen nach Eingangsdatum, nicht nach Lektionsdatum", () => {
    // Dieselbe Regel wie bei den Rechnungen — sonst landet eine im
    // Januar bezahlte Dezemberlektion im falschen Steuerjahr.
    expect(abrechnung).toContain("bezahlt_am");
    expect(abrechnung).toContain('datum: z.bezahlt_am');
  });

  it("hält Testschüler aus der Abrechnung", () => {
    expect(abrechnung).toContain('eq("profiles.ist_test", false)');
  });
});
