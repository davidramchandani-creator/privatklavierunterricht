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
 * Wer durch die Middleware läuft und wer nicht.
 *
 * Zwei Gründe, das festzuhalten. Der ältere: Alles unter public/ muss
 * vorbeikommen, sonst wird ein Video auf die Loginseite umgeleitet und im
 * Browser steht „Video nicht verfügbar". Der neuere: Jeder Durchlauf kostet
 * eine Supabase-Sitzungsabfrage, also einen Roundtrip vor dem ersten Byte.
 * Auf der Startseite ist das reine Wartezeit.
 *
 * Seit dem Performance-Audit zählt der Matcher darum auf, was geschützt ist,
 * statt auszuschliessen, was es nicht ist. Die Kehrseite: Ein neuer
 * geschützter Bereich muss dort ergänzt werden — sonst ist er offen. Genau
 * dafür ist die Gegenprobe unten da.
 */
describe("Middleware greift nur bei geschützten Bereichen", () => {
  // Den Matcher importieren statt die Datei als Text zu lesen: So prüft der
  // Test genau das Muster, das Next.js tatsächlich verwendet.
  //
  // `/admin/:path*` trifft in Next-Syntax sowohl /admin als auch alles
  // darunter; das bildet die Umschreibung unten nach.
  const trifft = (pfad: string) =>
    config.matcher.some((muster) => {
      const re = new RegExp("^" + muster.replace(/\/:path\*$/, "(?:/.*)?") + "$");
      return re.test(pfad);
    });

  const frei = [
    "/",
    "/preise",
    "/agb",
    "/probelektion",
    "/schuelervideos/phia-another-love.mp4",
    "/schuelervideos/phia-another-love.jpg",
    "/hoerproben/another-love.mp3",
    "/favicon.ico",
  ];

  for (const pfad of frei) {
    it(`${pfad} wird nicht abgefangen`, () => {
      expect(trifft(pfad), pfad).toBe(false);
    });
  }

  // Gegenprobe: Der Matcher darf nicht so eng werden, dass die Anmeldung
  // wirkungslos ist und der Test trotzdem grün bleibt.
  const geschuetzt = [
    "/admin",
    "/admin/schueler/abc",
    "/schueler/portal",
    "/auth/login",
    "/benachrichtigungen",
  ];

  for (const pfad of geschuetzt) {
    it(`${pfad} läuft weiterhin durch die Middleware`, () => {
      expect(trifft(pfad), pfad).toBe(true);
    });
  }
});
