import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCHUELERVIDEOS } from "./schuelervideos";

/**
 * Die Liste ist zunächst leer; diese Prüfungen greifen erst, sobald Videos
 * eingetragen werden. Genau dann sind sie nützlich: Ein Tippfehler im
 * Dateinamen fällt sonst erst auf der fertigen Website auf, als schwarzer
 * Kasten, den niemand meldet.
 */
describe("Schülervideos", () => {
  it("hat keine doppelten IDs", () => {
    const ids = SCHUELERVIDEOS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Pfade zeigen in den Videoordner", () => {
    for (const v of SCHUELERVIDEOS) {
      expect(v.datei.startsWith("/schuelervideos/"), `${v.id}: ${v.datei}`).toBe(true);
      expect(v.poster.startsWith("/schuelervideos/"), `${v.id}: ${v.poster}`).toBe(true);
    }
  });

  it("Video und Standbild liegen tatsächlich unter public/", () => {
    for (const v of SCHUELERVIDEOS) {
      for (const pfad of [v.datei, v.poster]) {
        const voll = join(process.cwd(), "public", pfad.replace(/^\//, ""));
        expect(existsSync(voll), `${v.id}: ${pfad} fehlt`).toBe(true);
      }
    }
  });

  it("jedes Video hat Titel, Name, Woche und Dauer", () => {
    for (const v of SCHUELERVIDEOS) {
      expect(v.titel.trim().length, `${v.id}: Titel fehlt`).toBeGreaterThan(0);
      expect(v.name.trim().length, `${v.id}: Name fehlt`).toBeGreaterThan(0);
      expect(v.dauer, `${v.id}: Dauer fehlt`).toBeGreaterThan(0);
      // Woche 0 gäbe es nicht, und die Zeitachse teilt durch die grösste
      // Woche, eine 0 als einziger Wert liesse sie durch null teilen.
      expect(v.woche, `${v.id}: Woche fehlt oder ist 0`).toBeGreaterThan(0);
      expect(Number.isInteger(v.woche), `${v.id}: Woche ist keine ganze Zahl`).toBe(true);
    }
  });

  it("bleibt kurz, lange Videos sieht sich auf einer Startseite niemand an", () => {
    for (const v of SCHUELERVIDEOS) {
      expect(v.dauer, `${v.id}: ${v.dauer}s`).toBeLessThanOrEqual(90);
    }
  });
});
