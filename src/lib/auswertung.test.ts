import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MINDEST_ANFRAGEN_FUER_QUOTE,
  baueAuswertung,
  listenpreisSemester,
  monatVon,
} from "./auswertung";

const jetzt = new Date("2027-01-15T10:00:00Z");

describe("Monat und Listenpreis", () => {
  it("rechnet in Zürcher Zeit", () => {
    // 23:30 UTC am 31. Oktober ist schon der 1. November in Zürich.
    expect(monatVon("2026-10-31T23:30:00Z")).toBe("2026-11");
  });
  it("kennt den Listenpreis vor und nach der Umstellung", () => {
    expect(listenpreisSemester("2026-11-02")).toBe(70);
    expect(listenpreisSemester("2026-11-03")).toBe(80);
  });
});

describe("baueAuswertung", () => {
  it("liefert zwölf Monate bis und mit dem aktuellen", () => {
    const a = baueAuswertung({ anfragen: [], warteliste: [], schueler: [] }, jetzt);
    expect(a.monate).toHaveLength(12);
    expect(a.monate[0].monat).toBe("2026-02");
    expect(a.monate[11].monat).toBe("2027-01");
  });

  it("zählt Anfragen, Warteliste und neue Schüler pro Monat", () => {
    const a = baueAuswertung(
      {
        anfragen: [
          { erstellt_am: "2026-12-02T10:00:00Z", email: "a@x.ch" },
          { erstellt_am: "2026-12-20T10:00:00Z", email: "b@x.ch" },
          { erstellt_am: "2027-01-05T10:00:00Z", email: "c@x.ch" },
        ],
        warteliste: [{ erstellt_am: "2026-12-10T10:00:00Z", quelle: "webseite" }],
        schueler: [{ erstellt_am: "2026-12-15T10:00:00Z", email: "a@x.ch", price_halbjahr: 80 }],
      },
      jetzt
    );
    const dez = a.monate.find((m) => m.monat === "2026-12")!;
    expect(dez.anfragen).toBe(2);
    expect(dez.warteliste).toBe(1);
    expect(dez.neueSchueler).toBe(1);
    expect(dez.zuListenpreis).toBe(1);
    expect(dez.ausAnfrage).toBe(1);
  });

  it("erkennt einen günstigeren Preis gegenüber dem Listenpreis des Tages", () => {
    const a = baueAuswertung(
      {
        anfragen: [],
        warteliste: [],
        schueler: [
          // Nach der Umstellung: 75 ist günstiger als 80.
          { erstellt_am: "2026-12-01T10:00:00Z", email: null, price_halbjahr: 75 },
          // Vor der Umstellung war 70 der Listenpreis, also kein Rabatt.
          { erstellt_am: "2026-10-01T10:00:00Z", email: null, price_halbjahr: "70.00" },
        ],
      },
      jetzt
    );
    expect(a.monate.find((m) => m.monat === "2026-12")!.guenstiger).toBe(1);
    expect(a.monate.find((m) => m.monat === "2026-10")!.guenstiger).toBe(0);
    expect(a.monate.find((m) => m.monat === "2026-10")!.zuListenpreis).toBe(1);
    expect(a.seitPreisstart.guenstiger).toBe(1);
    expect(a.seitPreisstart.neueSchueler).toBe(1);
  });

  it("ordnet einen Schüler nur einer Anfrage zu, die davor lag und nicht zu alt ist", () => {
    const a = baueAuswertung(
      {
        anfragen: [
          { erstellt_am: "2026-06-01T10:00:00Z", email: "alt@x.ch" },
          { erstellt_am: "2026-12-20T10:00:00Z", email: "spaeter@x.ch" },
        ],
        warteliste: [],
        schueler: [
          // Anfrage über 90 Tage her
          { erstellt_am: "2026-12-01T10:00:00Z", email: "ALT@x.ch", price_halbjahr: 80 },
          // Anfrage kam erst nach dem Anlegen
          { erstellt_am: "2026-12-10T10:00:00Z", email: "spaeter@x.ch", price_halbjahr: 80 },
        ],
      },
      jetzt
    );
    expect(a.monate.find((m) => m.monat === "2026-12")!.ausAnfrage).toBe(0);
  });

  it("zeigt die Quote erst ab genug Anfragen", () => {
    const wenige = baueAuswertung(
      {
        anfragen: Array.from({ length: MINDEST_ANFRAGEN_FUER_QUOTE - 1 }, (_, i) => ({
          erstellt_am: "2026-12-02T10:00:00Z",
          email: `p${i}@x.ch`,
        })),
        warteliste: [],
        schueler: [],
      },
      jetzt
    );
    expect(wenige.seitPreisstart.quote).toBeNull();

    const genug = baueAuswertung(
      {
        anfragen: Array.from({ length: 5 }, (_, i) => ({
          erstellt_am: "2026-12-02T10:00:00Z",
          email: `p${i}@x.ch`,
        })),
        warteliste: [],
        schueler: [
          { erstellt_am: "2026-12-10T10:00:00Z", email: "p0@x.ch", price_halbjahr: 80 },
          { erstellt_am: "2026-12-11T10:00:00Z", email: "p1@x.ch", price_halbjahr: 80 },
        ],
      },
      jetzt
    );
    expect(genug.seitPreisstart.quote).toBeCloseTo(0.4);
  });

  it("rechnet den Schnitt vor der Umstellung erst ab dem ersten Monat mit Anfrage", () => {
    const a = baueAuswertung(
      {
        anfragen: [
          { erstellt_am: "2026-09-10T10:00:00Z", email: "a@x.ch" },
          { erstellt_am: "2026-09-12T10:00:00Z", email: "b@x.ch" },
          { erstellt_am: "2026-10-05T10:00:00Z", email: "c@x.ch" },
        ],
        warteliste: [],
        schueler: [],
      },
      jetzt
    );
    // September 2 und Oktober 1: Schnitt 1,5. Die Monate davor ohne Anfrage zählen nicht.
    expect(a.vorPreisstart.monate).toBe(2);
    expect(a.vorPreisstart.anfragenProMonat).toBe(1.5);
  });
});

describe("Admin-Seite", () => {
  const seite = readFileSync(join(process.cwd(), "src/app/admin/auswertung/page.tsx"), "utf8");
  const ohne = seite.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("liest Schüler ohne Test- und externe Profile", () => {
    expect(ohne).toContain('.eq("ist_test", false)');
    expect(ohne).toContain('.eq("extern", false)');
    expect(ohne).toContain('.eq("role", "student")');
  });

  it("weist auf die kleinen Zahlen hin", () => {
    expect(seite).toContain("Zufall");
  });
});
