import { describe, expect, it } from "vitest";
import { bewerteSlots } from "./slot-bewertung";

/**
 * Die Bewertung muss die Rangfolge liefern, wegen der es sie gibt: Anschluss
 * an bestehende Lektionen vor Slots mit Lücke, und beides vor Slots an einem
 * leeren Tag. Sonst zeigt die Liste dieselbe Beliebigkeit wie vorher, nur
 * mit Farben dran.
 */

const zuhause = { lat: 47.5282, lng: 8.6696 }; // Neftenbach
const schueler = { lat: 47.5001, lng: 8.7241 }; // Winterthur

// Ein Dienstag mit einer bestehenden Lektion 17:00–17:45 in Winterthur.
const dienstagTermin = {
  start_at: "2026-09-01T15:00:00.000Z", // 17:00 Zürich (Sommerzeit)
  end_at: "2026-09-01T15:45:00.000Z",
  lat: 47.4989,
  lng: 8.7286,
  name: "Marina",
};

describe("bewerteSlots", () => {
  it("Anschluss schlägt Lücke schlägt leeren Tag", () => {
    const slots = [
      // Mittwoch, ganz leerer Tag
      { beginn: "2026-09-02T15:00:00.000Z", ende: "2026-09-02T15:45:00.000Z" },
      // Dienstag mit grosser Lücke zur bestehenden Lektion (17:45 + 2h)
      { beginn: "2026-09-01T17:45:00.000Z", ende: "2026-09-01T18:30:00.000Z" },
      // Dienstag direkt nach Marina
      { beginn: "2026-09-01T15:45:00.000Z", ende: "2026-09-01T16:30:00.000Z" },
    ];

    const bewertet = bewerteSlots({
      slots,
      termine: [dienstagTermin],
      schueler,
      zuhause,
    });

    expect(bewertet.map((s) => s.kategorie)).toEqual([
      "anschluss",
      "zwischenhalt",
      "leerer_tag",
    ]);
    expect(bewertet[0].begruendung).toContain("Marina");
  });

  it("direkt vor einer Lektion zählt auch als Anschluss", () => {
    const bewertet = bewerteSlots({
      slots: [
        { beginn: "2026-09-01T14:15:00.000Z", ende: "2026-09-01T15:00:00.000Z" },
      ],
      termine: [dienstagTermin],
      schueler,
      zuhause,
    });
    expect(bewertet[0].kategorie).toBe("anschluss");
    expect(bewertet[0].begruendung).toContain("vor Marina");
  });

  it("leerer Tag kostet den ganzen Hin- und Rückweg", () => {
    const bewertet = bewerteSlots({
      slots: [
        { beginn: "2026-09-02T15:00:00.000Z", ende: "2026-09-02T15:45:00.000Z" },
      ],
      termine: [],
      schueler,
      zuhause,
    });
    expect(bewertet[0].kategorie).toBe("leerer_tag");
    // Neftenbach–Winterthur und zurück: deutlich mehr als null.
    expect(bewertet[0].zusatzfahrtSekunden).toBeGreaterThan(10 * 60);
  });

  it("kommt ohne Schüler-Koordinaten nicht ins Straucheln", () => {
    const bewertet = bewerteSlots({
      slots: [
        { beginn: "2026-09-01T15:45:00.000Z", ende: "2026-09-01T16:30:00.000Z" },
        { beginn: "2026-09-02T15:00:00.000Z", ende: "2026-09-02T15:45:00.000Z" },
      ],
      termine: [dienstagTermin],
      schueler: null,
      zuhause,
    });
    // Die Lage im Tag trägt auch ohne Fahrzeit: Anschluss bleibt oben.
    expect(bewertet[0].kategorie).toBe("anschluss");
    expect(bewertet[1].kategorie).toBe("leerer_tag");
  });
});

describe("Verdrahtung in den Admin-Formularen", () => {
  it("Direktbuchung und Vorschlag zeigen die günstigen Zeiten", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const actions = readFileSync(
      join(process.cwd(), "src", "app", "admin", "actions.ts"),
      "utf8"
    );
    // Kreis-Trennung: Testschüler-Termine dürfen echte Bewertungen nicht
    // verzerren. Genau dieser Filter ist schon einmal vergessen worden.
    const fn = actions.slice(actions.indexOf("export async function guenstigeSlots"));
    expect(fn).toContain('"profiles.ist_test"');

    const form = readFileSync(
      join(
        process.cwd(),
        "src",
        "app",
        "admin",
        "schueler",
        "[id]",
        "_components",
        "SchuelerDetailActions.tsx"
      ),
      "utf8"
    );
    // In beiden Formularen, nicht nur in einem.
    const erste = form.indexOf("<GuenstigeSlots");
    const zweite = form.indexOf("<GuenstigeSlots", erste + 1);
    expect(erste).toBeGreaterThan(-1);
    expect(zweite).toBeGreaterThan(-1);
  });
});
