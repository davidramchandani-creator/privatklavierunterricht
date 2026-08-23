import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { baueWochenbriefing, veraenderungProzent } from "./briefing";

/**
 * Die wichtigste Eigenschaft eines Briefings ist, wann es **nicht** kommt.
 *
 * Eine Mail, die jeden Montag „alles in Ordnung" meldet, trainiert einen
 * darauf, sie ungelesen zu löschen — und dann fehlt sie in der einen
 * Woche, in der etwas drinsteht. Darum ist ein Briefing ohne
 * Auffälligkeiten leer, und leer heisst: kein Versand.
 */

const leer = {
  woche: "2026-08-24",
  lektionen: 0,
  offeneZahlungen: { anzahl: 0, betrag: 0 },
  wartetAufBestaetigung: 0,
  stilleSchueler: [],
  abosLaufenAus: [],
  unbeantworteteAnfragen: 0,
};

describe("Wann ein Wochenbriefing kommt", () => {
  it("kommt gar nicht, wenn nichts anliegt", () => {
    expect(baueWochenbriefing(leer).lohntSich).toBe(false);
  });

  it("kommt auch bei vollem Kalender nicht, wenn nichts quer liegt", () => {
    // Zwölf Lektionen sind kein Anlass für eine Mail — das sieht David im
    // Kalender. Nur was eine Handlung auslöst, rechtfertigt eine.
    const b = baueWochenbriefing({ ...leer, lektionen: 12 });
    expect(b.lohntSich).toBe(false);
    expect(b.punkte).toHaveLength(1);
  });

  it("kommt, sobald Geld offen ist", () => {
    const b = baueWochenbriefing({
      ...leer,
      offeneZahlungen: { anzahl: 2, betrag: 135 },
    });
    expect(b.lohntSich).toBe(true);
    expect(b.punkte[0].text).toContain("135");
  });

  it("kommt, wenn jemand still geworden ist", () => {
    // Der teuerste Posten überhaupt: Wer aufhört, ohne es zu sagen, kostet
    // nicht eine Lektion, sondern alle künftigen.
    const b = baueWochenbriefing({ ...leer, stilleSchueler: ["Marina"] });
    expect(b.lohntSich).toBe(true);
    expect(b.punkte.some((p) => p.text.includes("Marina"))).toBe(true);
  });

  it("stellt Dringendes nach oben", () => {
    const b = baueWochenbriefing({
      ...leer,
      lektionen: 5,
      abosLaufenAus: [{ name: "Angela", bis: "30.09." }],
      unbeantworteteAnfragen: 1,
    });
    // Eine unbeantwortete Anfrage ist ein wartender Mensch — das schlägt
    // ein Abo, das erst in einem Monat ausläuft.
    expect(b.punkte[0].art).toBe("unbeantwortet");
    // Die Lektionszahl ist Einordnung, kein Auftrag: immer zuunterst.
    expect(b.punkte[b.punkte.length - 1].art).toBe("lektionen");
  });

  it("nennt Einzahl und Mehrzahl richtig", () => {
    // Kleinigkeit, aber „1 Rechnungen sind offen" liest sich wie ein Fehler
    // im System und untergräbt das Vertrauen in den Rest.
    const eins = baueWochenbriefing({
      ...leer,
      offeneZahlungen: { anzahl: 1, betrag: 70 },
    });
    expect(eins.punkte[0].text).toContain("Eine Rechnung ist offen");
    const zwei = baueWochenbriefing({
      ...leer,
      offeneZahlungen: { anzahl: 2, betrag: 140 },
    });
    expect(zwei.punkte[0].text).toContain("2 Rechnungen sind offen");
  });
});

describe("Veränderung zum Vormonat", () => {
  it("rechnet Prozent", () => {
    expect(veraenderungProzent(120, 100)).toBe(20);
    expect(veraenderungProzent(80, 100)).toBe(-20);
  });

  it("sagt nichts, wenn der Vormonat leer war", () => {
    // „Von 0 auf 300" in Prozent ist keine sinnvolle Zahl, und „+∞ %" in
    // einer Mail sieht nach Defekt aus.
    expect(veraenderungProzent(300, 0)).toBeNull();
  });
});

describe("Verdrahtung", () => {
  const server = readFileSync(
    join(process.cwd(), "src", "lib", "briefing-server.ts"),
    "utf8"
  );
  const jobs = readFileSync(
    join(process.cwd(), "src", "lib", "subscription-jobs.ts"),
    "utf8"
  );
  const dashboard = readFileSync(
    join(process.cwd(), "src", "app", "admin", "page.tsx"),
    "utf8"
  );

  it("beide Briefings laufen im täglichen Cron", () => {
    expect(jobs).toContain("verschickeWochenbriefing");
    expect(jobs).toContain("verschickeMonatsbriefing");
  });

  it("verschickt höchstens einmal pro Woche bzw. Monat", () => {
    expect(server).toContain("briefing_woche");
    expect(server).toContain("briefing_monat");
  });

  it("vermerkt auch eine stille Woche, sonst versucht es der Cron erneut", () => {
    // Der Vermerk steht vor dem Abbruch bei `!lohntSich` — sonst liefe die
    // ganze Abfrage bei jedem Cron-Lauf des Montags noch einmal.
    const vermerk = server.indexOf('key: "briefing_woche"');
    const abbruch = server.indexOf("!briefing.lohntSich");
    expect(vermerk).toBeGreaterThan(-1);
    expect(vermerk).toBeLessThan(abbruch);
  });

  it("nimmt den abgeschlossenen Monat, nicht den angebrochenen", () => {
    expect(server).toContain("monatsSchluessel(gestern)");
  });

  it("hält Testschüler aus beiden Briefings", () => {
    expect(server).toContain('eq("profiles.ist_test", false)');
  });

  it("das Dashboard zeigt dieselben Punkte", () => {
    expect(dashboard).toContain("ladeWochenbriefing");
    expect(dashboard).toContain("Diese Woche liegt");
  });
});
