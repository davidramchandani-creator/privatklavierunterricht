import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { istTest, KREIS_LABEL, type Kreis } from "./kreis";

describe("Kreis", () => {
  it("unterscheidet Test und Ernst", () => {
    expect(istTest("test")).toBe(true);
    expect(istTest("echt")).toBe(false);
  });

  it("hat für jeden Kreis eine Beschriftung", () => {
    const alle: Kreis[] = ["echt", "test"];
    for (const k of alle) expect(KREIS_LABEL[k]).toBeTruthy();
  });
});

/**
 * Wächter gegen die Wiederkehr des Fehlers.
 *
 * Der Schaden entsteht nicht dort, wo jemand falsch filtert, sondern dort, wo
 * jemand das Filtern **vergisst**, dann mischen sich fünf erfundene und
 * sieben echte Adressen in einer Rechnung, das Ergebnis sieht plausibel aus
 * und ist trotzdem für keinen der beiden Fälle richtig.
 *
 * Darum prüft dieser Test die Regel maschinell: wer Schülerprofile für eine
 * Auswertung lädt, muss sich zum Kreis äussern. Wenn du hier landest, ist die
 * Frage nicht „wie mache ich den Test still", sondern „gilt meine neue
 * Abfrage für Testschüler, für echte, oder muss der Aufrufer entscheiden".
 */
function sammleDateien(verzeichnis: string, treffer: string[] = []): string[] {
  for (const eintrag of readdirSync(verzeichnis)) {
    if (eintrag === "node_modules" || eintrag.startsWith(".")) continue;
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) sammleDateien(pfad, treffer);
    else if (/\.(ts|tsx)$/.test(pfad) && !pfad.endsWith(".test.ts")) {
      treffer.push(pfad);
    }
  }
  return treffer;
}

describe("Trennung von Test und Ernst", () => {
  it("jede Schülerabfrage äussert sich zum Kreis", () => {
    const wurzel = join(process.cwd(), "src");
    const verstoesse: string[] = [];

    // Stellen, die bewusst über alle Schüler gehen: Stammdaten pflegen,
    // Rechte prüfen, Testdaten verwalten. Sie werten nichts aus und dürfen
    // darum beide sehen.
    //
    // Einzelne Abfragen können sich stattdessen mit dem Kommentar
    // „kreis-uebergreifend" ausnehmen, das steht dann direkt daneben und
    // muss begründet werden, statt in einer Liste am anderen Ende zu
    // verschwinden.
    const erlaubt = [
      "src/app/admin/actions.ts",
      "src/app/admin/schueler",
      "src/app/admin/testmodus/actions.ts",
      "src/lib/kreis.ts",
    ];

    for (const datei of sammleDateien(wurzel)) {
      const rel = datei.slice(datei.indexOf("src"));
      if (erlaubt.some((e) => rel.startsWith(e))) continue;

      const inhalt = readFileSync(datei, "utf8");
      // Abfragen der Form .eq("role", "student") ohne ist_test in der Nähe.
      const zeilen = inhalt.split("\n");
      for (let i = 0; i < zeilen.length; i++) {
        if (!/\.eq\(\s*"role"\s*,\s*"student"\s*\)/.test(zeilen[i])) continue;
        const umfeld = zeilen.slice(Math.max(0, i - 12), i + 12).join("\n");
        if (!umfeld.includes("ist_test") && !umfeld.includes("kreis-uebergreifend")) {
          verstoesse.push(`${rel}:${i + 1}`);
        }
      }
    }

    expect(verstoesse).toEqual([]);
  });
});
