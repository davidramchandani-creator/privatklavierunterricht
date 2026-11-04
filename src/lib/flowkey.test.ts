import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FLOWKEY } from "./flowkey";

const lies = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Partnerschaft mit flowkey", () => {
  /**
   * Vertrag 4.2: Werbematerial, das flowkey prominent zeigt, braucht die
   * schriftliche Freigabe von flowkey. Bis dahin bleibt alles aus. Wer den
   * Schalter umlegt, muss diesen Test bewusst anpassen.
   */
  it("bleibt ausgeschaltet, bis flowkey freigegeben hat", () => {
    expect(FLOWKEY.aktiv).toBe(false);
  });

  it("jede Stelle richtet sich nach dem Schalter", () => {
    expect(lies("src/app/flowkey/page.tsx")).toContain("if (!FLOWKEY.aktiv) notFound()");
    expect(lies("src/components/sections/FlowkeyPartner.tsx")).toContain("if (!FLOWKEY.aktiv) return null");
    expect(lies("src/components/layout/Footer.tsx")).toContain("FLOWKEY.aktiv ?");
    expect(lies("src/app/sitemap.ts")).toContain("FLOWKEY.aktiv ?");
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
});
