import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FOOTER_NAVIGATION, HAUPTNAVIGATION, istAktiv } from "./navigation";
import { FLOWKEY, zeigeHeroLogo } from "./flowkey";

const lies = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const seiteExistiert = (href: string) => {
  const pfad = href.split("#")[0];
  return pfad === "/" || existsSync(join(process.cwd(), "src/app", pfad, "page.tsx"));
};

describe("Navigation (David, 16. November 2026)", () => {
  it("hat die vier Bereiche plus FAQ und Kontakt, in dieser Reihenfolge", () => {
    expect(HAUPTNAVIGATION.map((b) => b.label)).toEqual([
      "Unterricht",
      "Einblicke",
      "Preise",
      "Über mich",
      "FAQ",
      "Kontakt",
    ]);
  });

  it("jeder Link im Header und im Footer führt auf eine Seite, die es gibt", () => {
    const alle = [
      ...HAUPTNAVIGATION.flatMap((b) => [b.href, ...(b.kinder ?? []).map((k) => k.href)]),
      ...FOOTER_NAVIGATION.map((l) => l.href),
    ];
    for (const href of alle) expect(seiteExistiert(href), href).toBe(true);
  });

  it("Lehrperson werden steht nur noch im Footer", () => {
    const header = HAUPTNAVIGATION.flatMap((b) => [b.href, ...(b.kinder ?? []).map((k) => k.href)]);
    expect(header).not.toContain("/lehrperson-werden");
    expect(FOOTER_NAVIGATION.map((l) => l.href)).toContain("/lehrperson-werden");
  });

  it("markiert den richtigen Bereich, Anker zählen nicht", () => {
    const unterricht = HAUPTNAVIGATION[0];
    const ueberMich = HAUPTNAVIGATION[3];
    expect(istAktiv("/unterricht", unterricht)).toBe(true);
    expect(istAktiv("/lehrpersonen", ueberMich)).toBe(true);
    expect(istAktiv("/preise", unterricht)).toBe(false);
    expect(istAktiv("/", unterricht)).toBe(false);
  });

  it("Sprungziele auf den Seiten existieren", () => {
    expect(lies("src/components/sections/Pakete.tsx")).toContain('id="gruppen"');
    expect(lies("src/app/unterricht/page.tsx")).toContain('id="einzel"');
    expect(lies("src/app/unterricht/page.tsx")).toContain('id="ablauf"');
    expect(lies("src/components/sections/Schuelervideos.tsx")).toContain('id="videos"');
    expect(lies("src/components/sections/Bewertungen.tsx")).toContain('id="stimmen"');
    expect(lies("src/app/sitemap.ts")).toContain('"/unterricht"');
    expect(lies("src/app/sitemap.ts")).toContain('"/einblicke"');
  });

  it("Navbar und Footer lesen aus lib/navigation", () => {
    expect(lies("src/components/layout/Navbar.tsx")).toContain("HAUPTNAVIGATION");
    expect(lies("src/components/layout/Footer.tsx")).toContain("FOOTER_NAVIGATION");
  });
});

describe("Lange Abschnitte blenden sich auch am Handy ein", () => {
  it("Reveal hängt nicht an einem Flächenanteil", () => {
    const reveal = lies("src/components/Reveal.tsx");
    expect(reveal).toContain("threshold: 0,");
    expect(reveal).not.toMatch(/\{ threshold: 0\.15/);
  });
});

describe("flowkey-Logo im Startbereich", () => {
  it("von flowkey freigegeben (19. November 2026), überall sichtbar", () => {
    expect(FLOWKEY.heroFreigegeben).toBe(true);
    expect(zeigeHeroLogo("production")).toBe(true);
    expect(zeigeHeroLogo("preview")).toBe(true);
    expect(zeigeHeroLogo("development")).toBe(true);
  });

  it("verlinkt auf die Partnerseite und nutzt das offizielle Logo", () => {
    const hero = lies("src/components/sections/Hero.tsx");
    expect(hero).toContain("zeigeHeroLogo()");
    expect(hero).toContain('href="/flowkey"');
    expect(hero).toContain("<FlowkeyLogo");
  });
});
