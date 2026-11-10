import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FLOWKEY, FLOWKEY_FUNKTIONEN } from "./flowkey";

const lies = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Partnerschaft mit flowkey", () => {
  /**
   * Vertrag 4.2: Werbematerial, das flowkey prominent zeigt, gibt flowkey
   * vorher frei. Bis dahin ist die Seite nur für die Freigabe erreichbar.
   * Wer den Schalter umlegt, passt diesen Test bewusst an.
   */
  it("bleibt aus, bis flowkey freigegeben hat", () => {
    expect(FLOWKEY.aktiv).toBe(false);
  });

  it("solange aus: Seite nicht in Suchmaschinen, nicht verlinkt, kein Abschnitt", () => {
    expect(lies("src/app/flowkey/page.tsx")).toContain("robots: FLOWKEY.aktiv ? undefined : { index: false, follow: false }");
    expect(lies("src/components/sections/FlowkeyPartner.tsx")).toContain("if (!FLOWKEY.aktiv) return null");
    expect(lies("src/components/layout/Footer.tsx")).toContain("FLOWKEY.aktiv ?");
    expect(lies("src/app/sitemap.ts")).toContain("FLOWKEY.aktiv ?");
  });

  it("verwendet die offiziellen Logo-Dateien in Originalform", () => {
    for (const datei of [FLOWKEY.logo.orange, FLOWKEY.logo.weiss]) {
      expect(existsSync(join(process.cwd(), "public", datei))).toBe(true);
    }
    const logo = lies("src/components/FlowkeyLogo.tsx");
    // Freiraum ein Drittel der Höhe, Seitenverhältnis aus der Datei
    expect(logo).toContain("Math.round(hoehe / 3)");
    expect(logo).toContain("FLOWKEY.logo.verhaeltnis");
    expect(logo).not.toMatch(/opacity|rotate|filter/);
  });

  it("sagt offen, dass David eine Provision bekommt, und kennzeichnet es als Werbung", () => {
    const seite = lies("src/app/flowkey/page.tsx");
    const abschnitt = lies("src/components/sections/FlowkeyPartner.tsx");
    for (const t of [seite, abschnitt]) {
      expect(t).toContain("Provision");
      expect(t).toContain("Partnerschaft · Werbung");
    }
    expect(seite).toContain("kostenlos zur Verfügung");
    expect(seite).toContain('rel="noopener noreferrer sponsored"');
  });

  it("beschreibt die App nur mit Angaben aus dem Partnerdokument", () => {
    expect(FLOWKEY_FUNKTIONEN.map((f) => f.titel)).toEqual([
      "Tausende Songs",
      "Hört dir zu",
      "Warten, wiederholen, langsamer",
      "Video und Noten zusammen",
      "Kurse",
    ]);
  });
});
