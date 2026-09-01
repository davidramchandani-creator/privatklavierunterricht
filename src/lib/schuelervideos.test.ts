import { existsSync, readFileSync } from "node:fs";
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

  it("jedes Video hat Titel, Name, Stand und Dauer", () => {
    for (const v of SCHUELERVIDEOS) {
      expect(v.titel.trim().length, `${v.id}: Titel fehlt`).toBeGreaterThan(0);
      expect(v.name.trim().length, `${v.id}: Name fehlt`).toBeGreaterThan(0);
      expect(v.dauer, `${v.id}: Dauer fehlt`).toBeGreaterThan(0);
      expect(v.stand.trim().length, `${v.id}: Stand fehlt`).toBeGreaterThan(0);
    }
  });

  it("der Stand bleibt kurz genug für eine Zeile", () => {
    /*
      Er steht in Grossbuchstaben mit weitem Zeichenabstand über dem Titel.
      Länger als etwa 30 Zeichen bricht die Zeile um, und die Karte
      verliert ihre Ruhe. „Woche 5" braucht sieben, „In 4 Monaten
      aufgebaut" zwanzig.
    */
    for (const v of SCHUELERVIDEOS) {
      expect(v.stand.length, `${v.id}: „${v.stand}" ist zu lang`).toBeLessThanOrEqual(30);
    }
  });


  it("der Satz über dem Block behauptet nichts über den Rhythmus", () => {
    /*
      Zweimal ist dieser Satz schon falsch geworden, weil er etwas über
      eine Liste behauptete, die sich ändert: erst „Keiner der vier", dann
      „Eine Lektion pro Woche, mehr nicht". Marina kommt alle zwei Wochen.
      Was für alle gilt, steht oben; alles andere gehört auf die Karte.
    */
    // Ohne Kommentare: Der Kommentar in der Datei zitiert den alten Satz,
    // um zu erklären, warum er weg ist. Sonst schlüge der Test auf seiner
    // eigenen Dokumentation an, wie es hier prompt passiert ist.
    const block = readFileSync(
      join(process.cwd(), "src", "components", "sections", "Schuelervideos.tsx"),
      "utf8"
    )
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ");
    expect(block).not.toContain("Eine Lektion pro Woche");
    expect(block).not.toMatch(/Keiner der (vier|fünf|sechs)/);
  });

  it("bleibt kurz, lange Videos sieht sich auf einer Startseite niemand an", () => {
    for (const v of SCHUELERVIDEOS) {
      expect(v.dauer, `${v.id}: ${v.dauer}s`).toBeLessThanOrEqual(90);
    }
  });
});
