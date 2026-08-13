import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gehoertZu } from "./pfad";
import { config } from "@/middleware";

describe("gehoertZu", () => {
  it("erkennt den Bereich selbst und alles darunter", () => {
    expect(gehoertZu("/schueler", "/schueler")).toBe(true);
    expect(gehoertZu("/schueler/portal", "/schueler")).toBe(true);
    expect(gehoertZu("/schueler/portal/termine", "/schueler")).toBe(true);
  });

  it("lässt Pfade in Ruhe, die nur zufällig gleich anfangen", () => {
    // Der Fehler, der die Schülervideos unsichtbar gemacht hat.
    expect(gehoertZu("/schuelervideos/phia-another-love.mp4", "/schueler")).toBe(false);
    expect(gehoertZu("/schuelerinnen", "/schueler")).toBe(false);
    expect(gehoertZu("/administration", "/admin")).toBe(false);
    expect(gehoertZu("/admin-agb", "/admin")).toBe(false);
  });

  it("verwechselt Geschwister-Bereiche nicht", () => {
    expect(gehoertZu("/auth/login", "/auth/register")).toBe(false);
    expect(gehoertZu("/auth/login/reset", "/auth/login")).toBe(true);
  });
});

/**
 * Der Wächter. `startsWith` auf einem Pfad ist fast immer ein Fehler, aber
 * ein unauffälliger: Er zeigt sich erst, wenn jemand eine Route oder einen
 * Ordner anlegt, dessen Name mit einem geschützten Bereich beginnt. Bis
 * dahin sieht der Code richtig aus.
 */
describe("Wächter: keine Pfadprüfung per startsWith", () => {
  const dateien = [
    "src/lib/supabase/middleware.ts",
    "src/middleware.ts",
    "src/components/layout/SiteChrome.tsx",
  ];

  for (const datei of dateien) {
    it(`${datei} prüft Pfade über gehoertZu()`, () => {
      const inhalt = readFileSync(join(process.cwd(), datei), "utf8");
      const treffer = inhalt.match(/pathname\s*\.startsWith\(/g);
      expect(
        treffer,
        `${datei}: pathname.startsWith() gefunden, bitte gehoertZu() benutzen, ` +
          `sonst greift die Prüfung auch bei Pfaden, die nur zufällig gleich anfangen.`,
      ).toBeNull();
    });
  }
});

/**
 * Alles, was unter public/ liegt, muss an der Middleware vorbeikommen.
 * Sonst passiert wieder genau das: ein Video, das auf die Loginseite
 * umgeleitet wird, und im Browser steht „Video nicht verfügbar".
 */
describe("Middleware lässt statische Dateien durch", () => {
  // Den Matcher importieren, nicht aus der Datei lesen: Als Text kommen die
  // Escape-Zeichen doppelt an (`\\.` statt `\.`), und der Test prüft dann ein
  // anderes Muster als das, was Next.js tatsächlich verwendet.
  const matcher = config.matcher[0];

  const beispiele = [
    "/schuelervideos/phia-another-love.mp4",
    "/schuelervideos/phia-another-love.jpg",
    "/hoerproben/another-love.mp3",
    "/favicon.ico",
  ];

  for (const pfad of beispiele) {
    it(`${pfad} wird nicht abgefangen`, () => {
      expect(new RegExp(`^${matcher}$`).test(pfad), pfad).toBe(false);
    });
  }

  // Gegenprobe: Der Matcher darf nicht so weit gefasst sein, dass er nichts
  // mehr trifft, sonst wäre die Anmeldung wirkungslos und der Test grün.
  for (const pfad of ["/admin", "/schueler/portal", "/auth/login"]) {
    it(`${pfad} läuft weiterhin durch die Middleware`, () => {
      expect(new RegExp(`^${matcher}$`).test(pfad), pfad).toBe(true);
    });
  }
});
