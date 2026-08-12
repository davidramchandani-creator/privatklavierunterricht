import { describe, expect, it } from "vitest";
import { formatDauer, HOERPROBEN } from "./hoerproben";

describe("formatDauer", () => {
  it("schreibt Sekunden als Minuten:Sekunden", () => {
    expect(formatDauer(0)).toBe("0:00");
    expect(formatDauer(9)).toBe("0:09");
    expect(formatDauer(134)).toBe("2:14");
    expect(formatDauer(600)).toBe("10:00");
  });

  it("schneidet angebrochene Sekunden ab, statt zu runden", () => {
    // Beim Abspielen läuft die Position stetig. Aufrunden liesse die Anzeige
    // eine Sekunde zu früh auf die Endzeit springen.
    expect(formatDauer(59.9)).toBe("0:59");
  });
});

describe("Hörproben-Liste", () => {
  it("jede Aufnahme hat eine Wellenform und eine Dauer", () => {
    for (const p of HOERPROBEN) {
      expect(p.wellenform.length, `${p.id}: Wellenform fehlt`).toBeGreaterThan(0);
      expect(p.dauer, `${p.id}: Dauer fehlt`).toBeGreaterThan(0);
      // Werte ausserhalb 0–1 würden Balken über den Rahmen hinaus zeichnen.
      for (const w of p.wellenform) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
    }
  });

  it("Dateipfade zeigen in den Hörproben-Ordner", () => {
    for (const p of HOERPROBEN) {
      expect(p.datei.startsWith("/hoerproben/"), `${p.id}: ${p.datei}`).toBe(true);
    }
  });
});
