import { describe, expect, it } from "vitest";
import {
  alsCsv,
  baueAbrechnung,
  istErinnerungsTag,
  letzterTagDesMonats,
  monatsSchluessel,
  type Einnahme,
} from "./abrechnung";

/**
 * Die Abrechnung geht in die Steuererklärung. Zwei Dinge müssen darum
 * stimmen und werden hier festgenagelt:
 *
 * 1. Es wird nach **Zahlungseingang** abgegrenzt, nicht nach Lektionsdatum.
 *    Eine im Dezember gehaltene, im Januar bezahlte Lektion gehört ins neue
 *    Jahr — sonst weicht die Aufstellung vom Kontoauszug ab.
 * 2. Geschätzte Einnahmen (externe Plattformen) bleiben von belegten
 *    getrennt. Beides zu addieren wäre bequem und würde eine Schätzung wie
 *    eine Buchung aussehen lassen.
 */

const ein = (
  datum: string,
  betrag: number,
  quelle: Einnahme["quelle"] = "rechnung"
): Einnahme => ({ datum, betrag, quelle, bezeichnung: "Test" });

describe("Monatsabgrenzung", () => {
  it("rechnet Zürcher Ortszeit, nicht UTC", () => {
    // 31.12. 23:30 Zürich ist 22:30 UTC — beides Dezember.
    expect(monatsSchluessel("2026-12-31T22:30:00.000Z")).toBe("2026-12");
    // 1.1. 00:30 Zürich ist 31.12. 23:30 UTC — das ist Januar.
    expect(monatsSchluessel("2026-12-31T23:30:00.000Z")).toBe("2027-01");
  });

  it("nimmt nur Zahlungen des gewählten Monats", () => {
    const a = baueAbrechnung({
      monat: "2026-08",
      einnahmen: [
        ein("2026-07-31T10:00:00.000Z", 100),
        ein("2026-08-15T10:00:00.000Z", 70),
        ein("2026-09-01T10:00:00.000Z", 200),
      ],
      ausgaben: [],
    });
    expect(a.einnahmenTotal).toBe(70);
    expect(a.einnahmen).toHaveLength(1);
  });
});

describe("Belegt und geschätzt bleiben getrennt", () => {
  it("weist externe Einnahmen einzeln aus", () => {
    const a = baueAbrechnung({
      monat: "2026-08",
      einnahmen: [
        ein("2026-08-05T10:00:00.000Z", 70),
        ein("2026-08-12T10:00:00.000Z", 68, "extern"),
        ein("2026-08-19T10:00:00.000Z", 68, "extern"),
      ],
      ausgaben: [],
    });
    expect(a.einnahmenSystem).toBe(70);
    expect(a.einnahmenExtern).toBe(136);
    expect(a.einnahmenTotal).toBe(206);
  });
});

describe("Ausgaben und Ergebnis", () => {
  it("summiert je Kategorie und zieht vom Ertrag ab", () => {
    const a = baueAbrechnung({
      monat: "2026-08",
      einnahmen: [ein("2026-08-05T10:00:00.000Z", 300)],
      ausgaben: [
        { id: "1", datum: "2026-08-03", kategorie: "fahrt", betrag: 42.5, notiz: null },
        { id: "2", datum: "2026-08-10", kategorie: "fahrt", betrag: 17.5, notiz: null },
        { id: "3", datum: "2026-08-11", kategorie: "verpflegung", betrag: 18, notiz: null },
      ],
    });
    expect(a.ausgabenNachKategorie.fahrt).toBe(60);
    expect(a.ausgabenNachKategorie.verpflegung).toBe(18);
    expect(a.ausgabenNachKategorie.material).toBe(0);
    expect(a.ausgabenTotal).toBe(78);
    expect(a.ergebnis).toBe(222);
  });

  it("rundet auf Rappen statt Fliesskomma-Schwänze zu zeigen", () => {
    const a = baueAbrechnung({
      monat: "2026-08",
      einnahmen: [
        ein("2026-08-01T10:00:00.000Z", 70.1),
        ein("2026-08-02T10:00:00.000Z", 70.2),
      ],
      ausgaben: [],
    });
    expect(a.einnahmenTotal).toBe(140.3);
  });
});

describe("Erinnerung vor Monatsende", () => {
  it("kennt die Monatslänge, auch im Februar", () => {
    expect(letzterTagDesMonats(new Date("2026-02-10T12:00:00Z"))).toBe(28);
    expect(letzterTagDesMonats(new Date("2028-02-10T12:00:00Z"))).toBe(29);
    expect(letzterTagDesMonats(new Date("2026-08-10T12:00:00Z"))).toBe(31);
  });

  it("fragt in den letzten fünf Tagen, vorher nicht", () => {
    // August hat 31 Tage: ab dem 27. wird gefragt.
    expect(istErinnerungsTag(new Date("2026-08-26T12:00:00Z"))).toBe(false);
    expect(istErinnerungsTag(new Date("2026-08-27T12:00:00Z"))).toBe(true);
    expect(istErinnerungsTag(new Date("2026-08-31T12:00:00Z"))).toBe(true);
    // Februar hat 28: ab dem 24.
    expect(istErinnerungsTag(new Date("2026-02-23T12:00:00Z"))).toBe(false);
    expect(istErinnerungsTag(new Date("2026-02-24T12:00:00Z"))).toBe(true);
  });
});

describe("CSV-Export", () => {
  const monate = [
    baueAbrechnung({
      monat: "2026-08",
      einnahmen: [ein("2026-08-05T10:00:00.000Z", 300)],
      ausgaben: [
        { id: "1", datum: "2026-08-03", kategorie: "fahrt", betrag: 60, notiz: null },
      ],
    }),
    baueAbrechnung({
      monat: "2026-09",
      einnahmen: [ein("2026-09-05T10:00:00.000Z", 200)],
      ausgaben: [],
    }),
  ];

  it("trennt mit Semikolon, für Excel in der Schweiz", () => {
    const csv = alsCsv(monate);
    expect(csv.split("\n")[0]).toContain(";");
    expect(csv.split("\n")[0]).not.toMatch(/,[A-Za-zÄÖÜ]/);
  });

  it("beginnt mit BOM, sonst zerlegt Excel die Umlaute", () => {
    expect(alsCsv(monate).charCodeAt(0)).toBe(0xfeff);
  });

  it("hängt eine Jahressumme an", () => {
    const zeilen = alsCsv(monate).split("\n");
    const letzte = zeilen[zeilen.length - 1];
    expect(letzte).toContain("Total");
    expect(letzte).toContain("500.00"); // 300 + 200
    expect(letzte).toContain("440.00"); // Ergebnis 240 + 200
  });

  it("lässt die Summe weg, wenn es nur einen Monat gibt", () => {
    const csv = alsCsv([monate[0]]);
    expect(csv).not.toContain("Total");
  });
});

describe("Verdrahtung", () => {
  it("hängt am täglichen Cron", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const jobs = readFileSync(
      join(process.cwd(), "src", "lib", "subscription-jobs.ts"),
      "utf8"
    );
    expect(jobs).toContain("erinnereAnAusgaben(admin, now)");
  });

  it("erinnert höchstens einmal pro Monat", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const server = readFileSync(
      join(process.cwd(), "src", "lib", "abrechnung-server.ts"),
      "utf8"
    );
    // Ohne diese Sperre kämen in den letzten fünf Tagen fünf gleiche Mails,
    // und David würde die Erinnerung abschalten.
    expect(server).toContain("abschluss?.erinnert_am");
    expect(server).toContain("monatsabschluss");
  });

  it("zählt bei Externen nur, was schon stattgefunden hat", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const server = readFileSync(
      join(process.cwd(), "src", "lib", "abrechnung-server.ts"),
      "utf8"
    );
    // Ein Termin nächste Woche ist noch kein Einkommen, auch wenn er im
    // selben Monat liegt.
    expect(server).toContain("new Date(t.start_at) <= jetzt");
  });
});
