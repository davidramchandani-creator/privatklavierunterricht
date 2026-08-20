import { describe, expect, it } from "vitest";
import { schlageOptimierungen } from "./optimierung";
import type { PlanEingabe, PlanSchueler } from "./routing";

/**
 * Die Vorschläge müssen zwei Fälle abdecken: einen herausgefallenen Schüler
 * hineinholen (wichtigster Fall) und Fahrzeit sparen, ohne jemanden zu
 * verlieren. Und sie dürfen nie eine Änderung vorschlagen, die einen heute
 * eingeplanten Schüler hinauswirft — sonst wäre der „Vorschlag" eine Falle.
 */

const zuhause = { lat: 47.5282, lng: 8.6696 }; // Neftenbach

function schueler(
  id: string,
  lat: number,
  lng: number,
  fenster?: PlanSchueler["fenster"]
): PlanSchueler {
  return {
    id,
    name: id,
    lat,
    lng,
    rhythmus: "woechentlich",
    lektionMinuten: 45,
    fenster,
  };
}

describe("schlageOptimierungen", () => {
  it("liefert nichts ohne Schüler", () => {
    const eingabe: PlanEingabe = {
      zuhause,
      schueler: [],
      fenster: [{ wochentag: 1, beginn: "16:00", ende: "20:00" }],
      pufferMinuten: 0,
    };
    expect(schlageOptimierungen(eingabe)).toEqual([]);
  });

  it("findet die Fensterverlängerung, die einen Schüler hineinholt", () => {
    // Drei Schüler, aber das Fenster fasst nur zwei Lektionen. Erst die
    // Verlängerung nach hinten schafft Platz für den dritten.
    const eingabe: PlanEingabe = {
      zuhause,
      schueler: [
        schueler("A", 47.5282, 8.6696),
        schueler("B", 47.53, 8.671),
        schueler("C", 47.531, 8.672),
      ],
      fenster: [{ wochentag: 1, beginn: "17:00", ende: "18:40" }],
      pufferMinuten: 0,
    };

    const vorschlaege = schlageOptimierungen(eingabe);
    expect(vorschlaege.length).toBeGreaterThan(0);

    const holtC = vorschlaege.find((v) => v.neuEingeplant.includes("C"));
    expect(holtC).toBeDefined();
    // Wer Schüler hineinholt, steht vor reinen Zeitspar-Vorschlägen.
    expect(vorschlaege[0].neuEingeplant.length).toBeGreaterThan(0);
  });

  it("schlägt nichts vor, was einen Schüler hinauswirft", () => {
    // Zwei Tage, auf jedem ein Schüler, der NUR an diesem Tag kann. Einen
    // Tag zu streichen würde Fahrzeit sparen, aber einen Schüler kosten —
    // das darf nie als Vorschlag erscheinen.
    const eingabe: PlanEingabe = {
      zuhause,
      schueler: [
        schueler("NurMontag", 47.5282, 8.6696, [
          { wochentag: 1, fruehestens: "16:00", spaetestens: "20:00" },
        ]),
        schueler("NurDonnerstag", 47.3769, 8.5417, [
          { wochentag: 4, fruehestens: "16:00", spaetestens: "20:00" },
        ]),
      ],
      fenster: [
        { wochentag: 1, beginn: "16:00", ende: "20:00" },
        { wochentag: 4, beginn: "16:00", ende: "20:00" },
      ],
      pufferMinuten: 0,
    };

    for (const v of schlageOptimierungen(eingabe)) {
      expect(v.nachher.eingeplant).toBeGreaterThanOrEqual(
        v.vorher.eingeplant
      );
    }
  });

  it("nennt das Streichen eines überflüssigen Tages", () => {
    // Zwei nahe Schüler, beide flexibel, verteilt auf zwei Tage — ein Tag
    // reicht, der zweite Heimweg ist verschenkt.
    const eingabe: PlanEingabe = {
      zuhause,
      schueler: [
        schueler("A", 47.3769, 8.5417), // Zürich, weiter weg → Streichen lohnt
        schueler("B", 47.378, 8.543),
      ],
      fenster: [
        { wochentag: 1, beginn: "16:00", ende: "17:00" },
        { wochentag: 4, beginn: "16:00", ende: "17:00" },
      ],
      pufferMinuten: 0,
    };

    const vorschlaege = schlageOptimierungen(eingabe);
    // Entweder ein Tag wird gestrichen oder ein Fenster so verlängert, dass
    // beide auf einen Tag passen — beides drückt auf einen Tag.
    const drueckt = vorschlaege.find((v) => v.nachher.tage < v.vorher.tage);
    expect(drueckt).toBeDefined();
  });

  it("höchstens ein Vorschlag pro Art und Tag, maximal sechs", () => {
    const eingabe: PlanEingabe = {
      zuhause,
      schueler: [
        schueler("A", 47.5282, 8.6696),
        schueler("B", 47.53, 8.671),
        schueler("C", 47.531, 8.672),
        schueler("D", 47.532, 8.673),
      ],
      fenster: [{ wochentag: 1, beginn: "17:00", ende: "18:00" }],
      pufferMinuten: 0,
    };

    const vorschlaege = schlageOptimierungen(eingabe);
    expect(vorschlaege.length).toBeLessThanOrEqual(6);
    const arten = vorschlaege.map((v) => `${v.art}:${v.wochentag}`);
    expect(new Set(arten).size).toBe(arten.length);
  });
});

describe("Anzeige im Routenplaner", () => {
  it("das Board zeigt die Vorschläge an", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const board = readFileSync(
      join(
        process.cwd(),
        "src",
        "app",
        "admin",
        "routenplanung",
        "_components",
        "RoutenplanerBoard.tsx"
      ),
      "utf8"
    );
    expect(board).toContain("optimierungen");
    const actions = readFileSync(
      join(process.cwd(), "src", "app", "admin", "routenplanung", "actions.ts"),
      "utf8"
    );
    // Auf allen Fenstern gerechnet, nicht auf der gefilterten Auswahl.
    expect(actions).toContain("schlageOptimierungen(kontext.eingabe)");
  });
});
