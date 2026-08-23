import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { schlageSchuelerAnfragen } from "./optimierung";
import type { PlanSchueler, Tagesfenster } from "./routing";

/**
 * Die Frage-Vorschläge auf Schülerseite — insbesondere die zweite Sorte:
 * Beinahe-Paare.
 *
 * Der echte Fall, aus dem sie entstand: Marina (14-täglich, Mo 17:15–18:00)
 * und Justine (14-täglich, Mo ab 17:30) verpassen den geteilten
 * Montagsplatz um eine Viertelstunde. Der Plan war korrekt — zwei
 * getrennte Plätze —, aber David sah nur das Ergebnis und nicht die knapp
 * verpasste Gelegenheit. Er fragte zu Recht: „Warum schlägt mir das
 * niemand vor?"
 */

const zuhause = { lat: 47.532, lng: 8.669 };

const s = (
  id: string,
  name: string,
  lat: number,
  lng: number,
  rh: "woechentlich" | "zweiwoechentlich",
  f: { wochentag: number; fruehestens: string; spaetestens: string }[]
): PlanSchueler => ({
  id,
  name,
  lat,
  lng,
  rhythmus: rh,
  lektionMinuten: 45,
  moeglicheTage: [...new Set(f.map((x) => x.wochentag))],
  fenster: f,
});

const FENSTER: Tagesfenster[] = [
  { wochentag: 1, beginn: "16:15", ende: "18:15" },
  { wochentag: 4, beginn: "13:30", ende: "21:00" },
];

describe("Beinahe-Paare werden vorgeschlagen", () => {
  // Marina nur Mo bis 18:00, Justine Mo erst ab 17:30 und Do —
  // Schnittmenge Mo: 30 Minuten, keine Lektion.
  const marina = s("m", "Marina", 47.5282, 8.6696, "zweiwoechentlich", [
    { wochentag: 1, fruehestens: "17:15", spaetestens: "18:00" },
  ]);
  const justine = s("j", "Justine", 47.544, 8.7049, "zweiwoechentlich", [
    { wochentag: 1, fruehestens: "17:30", spaetestens: "20:30" },
    { wochentag: 4, fruehestens: "17:30", spaetestens: "20:30" },
  ]);

  const anfragen = schlageSchuelerAnfragen({
    zuhause,
    schueler: [marina, justine],
    fenster: FENSTER,
    pufferMinuten: 0,
  });

  it("schlägt die Frage vor, obwohl beide untergebracht sind", () => {
    // Das war die Lücke: Vorschläge gab es nur für Herausgefallene. Ein
    // um 15 Minuten verpasstes Paar ist aber genauso eine Gelegenheit —
    // ein ganzer Platz pro Woche.
    expect(anfragen.length).toBeGreaterThan(0);
  });

  it("benennt die Wirkung: geteilter Platz, freier Slot", () => {
    const teilen = anfragen.find((a) => a.wirkung.includes("teilen sich"));
    expect(teilen).toBeDefined();
    expect(teilen!.wirkung).toContain("Slot");
    // Die Zahlen belegen es: nachher ein Platz weniger belegt.
    expect(teilen!.nachher.plaetze).toBeLessThan(teilen!.vorher.plaetze);
  });

  it("schlägt nichts vor, wenn das Paar heute schon möglich ist", () => {
    // Können beide längst zur selben Zeit, hat der Planer sich anders
    // entschieden (meist wegen der Fahrzeit) — dann ist eine Nachfrage
    // beim Schüler das falsche Werkzeug.
    const justineFrueh = s("j", "Justine", 47.544, 8.7049, "zweiwoechentlich", [
      { wochentag: 1, fruehestens: "17:15", spaetestens: "20:30" },
    ]);
    const a = schlageSchuelerAnfragen({
      zuhause,
      schueler: [marina, justineFrueh],
      fenster: FENSTER,
      pufferMinuten: 0,
    });
    expect(a.filter((x) => x.wirkung.includes("teilen sich"))).toHaveLength(0);
  });

  it("schlägt nichts vor, wenn die beiden zu weit auseinander wohnen", () => {
    // Ein geteilter Platz wird mit dem Mittelpunkt gerechnet — bei 15 km
    // Abstand läge der dort, wo niemand wohnt.
    const fern = s("f2", "Fernab", 47.4922, 8.863, "zweiwoechentlich", [
      { wochentag: 1, fruehestens: "17:30", spaetestens: "20:30" },
      { wochentag: 4, fruehestens: "17:30", spaetestens: "20:30" },
    ]);
    const a = schlageSchuelerAnfragen({
      zuhause,
      schueler: [marina, fern],
      fenster: FENSTER,
      pufferMinuten: 0,
    });
    expect(a.filter((x) => x.wirkung.includes("teilen sich"))).toHaveLength(0);
  });
});

describe("Die Werkstatt ist verdrahtet", () => {
  it("Board rendert sie, Aktion liefert die Eingabe", () => {
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
    const actions = readFileSync(
      join(process.cwd(), "src", "app", "admin", "routenplanung", "actions.ts"),
      "utf8"
    );
    expect(board).toContain("<WasWaereWennWerkstatt");
    expect(actions).toContain("werkstatt:");
  });

  it("rechnet im Browser mit der Schätzung und speichert nichts", () => {
    const werkstatt = readFileSync(
      join(
        process.cwd(),
        "src",
        "app",
        "admin",
        "routenplanung",
        "_components",
        "WasWaereWennWerkstatt.tsx"
      ),
      "utf8"
    );
    // Client-seitig rechnen heisst: planeRouten direkt importieren …
    expect(werkstatt).toContain('from "@/lib/routing"');
    expect(werkstatt).toContain("schaetzeFahrzeit");
    // … und keine Server-Action aufrufen oder gar schreiben.
    expect(werkstatt).not.toContain("use server");
    expect(werkstatt).not.toContain("createAdminClient");
    expect(werkstatt).not.toContain("supabase");
  });
});
