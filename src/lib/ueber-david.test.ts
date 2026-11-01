import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { davidsAlter, jahreKlaviererfahrung } from "./ueber-david";

describe("Alter und Erfahrung", () => {
  it("das Alter springt am Geburtstag, 15. September", () => {
    expect(davidsAlter(new Date("2026-09-14T12:00:00+02:00"))).toBe(21);
    expect(davidsAlter(new Date("2026-09-15T12:00:00+02:00"))).toBe(22);
    expect(davidsAlter(new Date("2026-11-01T12:00:00+01:00"))).toBe(22);
    expect(davidsAlter(new Date("2027-09-14T12:00:00+02:00"))).toBe(22);
    expect(davidsAlter(new Date("2027-09-15T12:00:00+02:00"))).toBe(23);
  });

  it("der Sprung gilt nach Schweizer Zeit, nicht nach UTC", () => {
    // 15.9. 00:30 Uhr in Zürich ist noch der 14.9. in UTC.
    expect(davidsAlter(new Date("2026-09-15T00:30:00+02:00"))).toBe(22);
  });

  it("die Erfahrung zählt Kalenderjahre seit 2009", () => {
    expect(jahreKlaviererfahrung(new Date("2026-11-01T12:00:00+01:00"))).toBe(17);
    expect(jahreKlaviererfahrung(new Date("2026-12-31T12:00:00+01:00"))).toBe(17);
    expect(jahreKlaviererfahrung(new Date("2027-01-01T12:00:00+01:00"))).toBe(18);
  });

  it("keine festen Zahlen mehr in den Seiten", () => {
    const ohne = (t: string) =>
      t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const dateien = [
      ["src", "components", "sections", "Hero.tsx"],
      ["src", "components", "sections", "UeberMichTeaser.tsx"],
      ["src", "app", "ueber-mich", "page.tsx"],
      ["src", "app", "preise", "page.tsx"],
    ];
    for (const d of dateien) {
      const t = ohne(readFileSync(join(process.cwd(), ...d), "utf8"));
      expect(t, d.join("/")).not.toMatch(/\b(16|17|21|22)\s*(\+\s*)?Jahre/);
      expect(t, d.join("/")).not.toMatch(/value:\s*"1[67]"/);
      expect(t, d.join("/")).not.toMatch(/>\s*1[4-9]\+?\s*</);
    }
  });

  it("das Studium an der PH Zürich steht überall, wo es um die Ausbildung geht", () => {
    const lies = (...d: string[]) => readFileSync(join(process.cwd(), ...d), "utf8").replace(/\s+/g, " ");
    const stellen = [
      lies("src", "lib", "faq.ts"),
      lies("src", "app", "agb", "page.tsx"),
      lies("src", "app", "preise", "page.tsx"),
      lies("src", "components", "sections", "UeberMichTeaser.tsx"),
      lies("src", "components", "sections", "Hero.tsx"),
    ];
    for (const t of stellen) {
      expect(t).toContain("PH Zürich");
      expect(t).not.toMatch(/über 14 Jahren/);
    }
  });

  it("Unterrichtserfahrung seit Anfang 2024, ehrlich gerundet", async () => {
    const { unterrichtserfahrungText } = await import("./ueber-david");
    expect(unterrichtserfahrungText(new Date("2026-02-10T12:00:00+01:00"))).toBe("zwei Jahren");
    expect(unterrichtserfahrungText(new Date("2026-05-10T12:00:00+02:00"))).toBe("über zwei Jahren");
    expect(unterrichtserfahrungText(new Date("2026-11-01T12:00:00+01:00"))).toBe("knapp drei Jahren");
    expect(unterrichtserfahrungText(new Date("2027-01-15T12:00:00+01:00"))).toBe("drei Jahren");
    const preise = readFileSync(join(process.cwd(), "src", "app", "preise", "page.tsx"), "utf8");
    expect(preise).toContain("In {unterrichtserfahrungText()} Unterrichtserfahrung");
    expect(preise).not.toMatch(/zwei Jahren Unterrichtserfahrung/);
  });
});
