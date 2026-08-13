import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Alle .ts/.tsx unter einem Verzeichnis, rekursiv. */
function quelldateien(verzeichnis: string, gesammelt: string[] = []): string[] {
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) quelldateien(pfad, gesammelt);
    else if (/\.tsx?$/.test(eintrag)) gesammelt.push(pfad);
  }
  return gesammelt;
}

/**
 * Jeder Mailtyp, der versendet wird, muss im Admin abschaltbar sein.
 *
 * Diese Liste ist schon einmal verfallen: Die Einstellungsseite kannte 26
 * Typen, versendet wurden 40. Darunter „package_created" — also ausgerechnet
 * die Mail, die beim Anlegen eines Pakets sofort rausgeht. Wer den Schalter
 * gesucht hat, fand ihn nicht und musste glauben, es gäbe keinen.
 *
 * Der Fehler entsteht lautlos: Man baut eine neue Mail, ruft sie über
 * `sendEmailNow` auf, alles funktioniert. Dass sie in keiner Einstellung
 * auftaucht, merkt man erst, wenn man sie abschalten will.
 */
describe("Alle Mailtypen sind im Admin abschaltbar", () => {
  const wurzel = process.cwd();

  const versendet = new Set<string>();
  for (const datei of quelldateien(join(wurzel, "src"))) {
    const inhalt = readFileSync(datei, "utf8");
    for (const m of inhalt.matchAll(
      /(?:sendEmailNow|enqueueEmail)\(\s*admin\s*,\s*"([a-z0-9_]+)"/g,
    )) {
      versendet.add(m[1]);
    }
  }

  const einstellungen = new Set(
    [
      ...readFileSync(
        join(wurzel, "src/app/admin/einstellungen/_components/EmailSettingsClient.tsx"),
        "utf8",
      ).matchAll(/id:\s*"([a-z0-9_]+)"/g),
    ].map((m) => m[1]),
  );

  it("findet überhaupt Mailtypen (sonst prüft der Test nichts)", () => {
    expect(versendet.size).toBeGreaterThan(20);
    expect(einstellungen.size).toBeGreaterThan(20);
  });

  it("jeder versendete Typ steht in der Einstellungsliste", () => {
    const fehlend = [...versendet].filter((t) => !einstellungen.has(t)).sort();
    expect(
      fehlend,
      `Diese Mailtypen werden versendet, stehen aber nicht in ` +
        `EmailSettingsClient.tsx und lassen sich deshalb nicht abschalten:\n  ` +
        fehlend.join("\n  "),
    ).toEqual([]);
  });
});
