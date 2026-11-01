import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unterrichtsort, STUDIO_ADRESSE_VORGABE } from "./studio";

describe("Wo die Lektion stattfindet", () => {
  it("wer zu David kommt, bekommt das Studio als Ort", () => {
    expect(unterrichtsort({ adresse: "Bahnhofstr. 1, Winterthur", hausbesuch: false }, STUDIO_ADRESSE_VORGABE))
      .toBe(STUDIO_ADRESSE_VORGABE);
  });
  it("beim Hausbesuch bleibt die Adresse des Schülers", () => {
    expect(unterrichtsort({ adresse: "Bahnhofstr. 1, Winterthur", hausbesuch: true }, STUDIO_ADRESSE_VORGABE))
      .toBe("Bahnhofstr. 1, Winterthur");
  });

  const ohne = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  it("Schülerkalender und Davids Google-Kalender nutzen den Ort", () => {
    const feed = ohne(readFileSync(join(process.cwd(), "src", "lib", "kalender-feed-server.ts"), "utf8"));
    const google = ohne(readFileSync(join(process.cwd(), "src", "lib", "google-calendar.ts"), "utf8"));
    expect(feed).toContain("unterrichtsort(z.profiles, studioAdresse)");
    expect(google).toContain("unterrichtsort(appt.student, appt.studioAdresse)");
    expect(google).toMatch(/adresse, hausbesuch\)/);
  });

  it("neue Schüler kommen standardmässig ins Studio", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase", "migrations", "066_studio_statt_hausbesuch.sql"),
      "utf8"
    );
    expect(sql).toMatch(/alter column hausbesuch set default false/);
  });
});
