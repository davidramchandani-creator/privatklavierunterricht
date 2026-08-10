import { describe, expect, it } from "vitest";
import { bestimmeBehandlung, gutschriftTage, istKurzfristig } from "./ausfall";

const JETZT = new Date("2026-08-09T10:00:00Z");

describe("24-Stunden-Grenze", () => {
  it("erkennt eine Absage weniger als 24 h vorher", () => {
    const in20h = new Date(JETZT.getTime() + 20 * 3600000);
    expect(istKurzfristig(in20h, JETZT)).toBe(true);
  });

  it("erkennt eine rechtzeitige Absage", () => {
    const in30h = new Date(JETZT.getTime() + 30 * 3600000);
    expect(istKurzfristig(in30h, JETZT)).toBe(false);
  });

  it("behandelt exakt 24 h als rechtzeitig", () => {
    const genau = new Date(JETZT.getTime() + 24 * 3600000);
    expect(istKurzfristig(genau, JETZT)).toBe(false);
  });
});

describe("Behandlung eines Ausfalls", () => {
  it("gibt bei rechtzeitiger Schülerabsage die Lektion zurück", () => {
    const b = bestimmeBehandlung({ verursacher: "schueler", kurzfristig: false });
    expect(b.lektionErhalten).toBe(true);
    expect(b.ersatzSuchen).toBe(true);
    expect(b.mailTyp).toBe("ausfall_ersatz_vorschlag");
  });

  it("wertet eine kurzfristige Schülerabsage als gehaltene Lektion", () => {
    const b = bestimmeBehandlung({ verursacher: "schueler", kurzfristig: true });
    expect(b.lektionErhalten).toBe(false);
    expect(b.ersatzSuchen).toBe(false);
    expect(b.mailTyp).toBe("ausfall_kurzfristig");
  });

  it("gleicht eine Absage durch die Lehrperson immer aus", () => {
    // Hier gibt es die 24-Stunden-Ausnahme bewusst nicht: David ist der
    // Verursacher und schuldet den Ausgleich, egal wie kurzfristig.
    const kurz = bestimmeBehandlung({ verursacher: "admin", kurzfristig: true });
    const lang = bestimmeBehandlung({ verursacher: "admin", kurzfristig: false });
    for (const b of [kurz, lang]) {
      expect(b.lektionErhalten).toBe(true);
      expect(b.ersatzSuchen).toBe(true);
      expect(b.mailTyp).toBe("ausfall_ersatz_vorschlag");
    }
  });

  it("begründet jede Entscheidung in Worten", () => {
    const faelle = [
      { verursacher: "schueler" as const, kurzfristig: true },
      { verursacher: "schueler" as const, kurzfristig: false },
      { verursacher: "admin" as const, kurzfristig: true },
    ];
    for (const f of faelle) {
      expect(bestimmeBehandlung(f).begruendung.length).toBeGreaterThan(20);
    }
  });
});

describe("Laufzeitgutschrift", () => {
  it("verschiebt die Serie um genau einen Takt", () => {
    // Eine ausgefallene Lektion hängt sich hinten an – die Laufzeit wächst
    // um ein Rhythmusintervall, nicht um einen pauschalen Wert.
    expect(gutschriftTage("woechentlich")).toBe(7);
    expect(gutschriftTage("zweiwoechentlich")).toBe(14);
  });

  it("nimmt ohne bekannten Rhythmus den vorsichtigeren Wert", () => {
    expect(gutschriftTage(null)).toBe(7);
    expect(gutschriftTage("unbekannt")).toBe(7);
  });
});
