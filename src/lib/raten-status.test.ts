import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Die Statuswerte von `package_instalments` sind **englisch**, der Rest des
 * Codes ist deutsch. Genau daran ist etwas kaputtgegangen:
 *
 *   .neq("status", "offen")
 *
 * sollte „alle Raten ausser den bloss vorgemerkten" heissen. Da die Tabelle
 * aber `open` führt und kein `offen`, war die Bedingung für **jede** Zeile
 * wahr. Folge: Jedes Paket mit Ratenplan liess sich für immer nicht mehr
 * löschen — auch ein vollständig storniertes, zu dem nie eine Rechnung
 * bestand. Die Meldung behauptete dazu, es seien Raten gestellt worden,
 * während die Ratenliste völlig leer war.
 *
 * Ein Tippfehler wäre aufgefallen. Ein Wort in der falschen Sprache nicht:
 * Es liest sich richtig, TypeScript prüft es nicht, und der Fehler wirkt
 * still in die falsche Richtung — er verbietet mehr, statt zu krachen.
 *
 * Darum wird hier gegen die Datenbank selbst geprüft: Jeder Statuswert, den
 * der Code gegen diese Tabelle verwendet, muss in der CHECK-Bedingung der
 * Migration vorkommen.
 */

const WURZEL = process.cwd();

/** Die erlaubten Werte aus `check (status in (...))` der Migration. */
function erlaubteStatus(): string[] {
  const sql = readFileSync(
    join(WURZEL, "supabase", "migrations", "032_subscriptions_and_instalments.sql"),
    "utf8"
  );
  // Der Block direkt nach der Tabellendefinition von package_instalments.
  const ab = sql.indexOf("package_instalments");
  const treffer = sql.slice(ab).match(/check \(status in \(([^)]+)\)\)/);
  if (!treffer) throw new Error("CHECK-Bedingung nicht gefunden");
  return [...treffer[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Alle .ts/.tsx unter src, ohne Tests. */
function quelldateien(ordner: string, raus: string[] = []): string[] {
  for (const eintrag of readdirSync(ordner)) {
    const pfad = join(ordner, eintrag);
    if (statSync(pfad).isDirectory()) quelldateien(pfad, raus);
    else if (/\.tsx?$/.test(eintrag) && !/\.test\.tsx?$/.test(eintrag))
      raus.push(pfad);
  }
  return raus;
}

/**
 * Statuswerte, die im Umfeld einer package_instalments-Abfrage stehen.
 *
 * Von `from("package_instalments")` bis zum nächsten `from("` — Abfragen
 * stehen hier oft zu dritt in einem `Promise.all`, und ein festes Fenster
 * von ein paar hundert Zeichen liest sonst die Statuswerte der Nachbarn
 * (`invoices`, `appointments`) mit und meldet sie als unbekannt.
 */
function verwendeteStatus(): { datei: string; wert: string }[] {
  const raus: { datei: string; wert: string }[] = [];
  for (const datei of quelldateien(join(WURZEL, "src"))) {
    const text = readFileSync(datei, "utf8");
    let ab = text.indexOf('from("package_instalments")');
    while (ab !== -1) {
      const naechsteTabelle = text.indexOf('from("', ab + 10);
      const block = text.slice(
        ab,
        naechsteTabelle === -1 ? ab + 600 : Math.min(naechsteTabelle, ab + 600)
      );
      for (const m of block.matchAll(/"status",\s*"([^"]+)"/g))
        raus.push({ datei, wert: m[1] });
      for (const m of block.matchAll(/"status",\s*\[([^\]]+)\]/g))
        for (const w of m[1].matchAll(/"([^"]+)"/g))
          raus.push({ datei, wert: w[1] });
      for (const m of block.matchAll(/status:\s*"([^"]+)"/g))
        raus.push({ datei, wert: m[1] });
      ab = text.indexOf('from("package_instalments")', ab + 1);
    }
  }
  return raus;
}

describe("Ratenstatus stimmt mit der Datenbank überein", () => {
  const erlaubt = erlaubteStatus();

  it("die Migration nennt die erwarteten Werte", () => {
    // Ohne diese Zusicherung könnte der Vergleich unten gegen eine leere
    // Liste laufen und alles durchwinken.
    expect(erlaubt).toContain("open");
    expect(erlaubt).toContain("cancelled");
    expect(erlaubt.length).toBeGreaterThanOrEqual(5);
  });

  it("der Code findet überhaupt Abfragen auf die Tabelle", () => {
    expect(verwendeteStatus().length).toBeGreaterThan(3);
  });

  it("jeder verwendete Status existiert auch in der Tabelle", () => {
    const unbekannt = verwendeteStatus()
      .filter((v) => !erlaubt.includes(v.wert))
      .map((v) => `${v.wert} in ${v.datei.replace(WURZEL + "/", "")}`);
    expect(unbekannt).toEqual([]);
  });
});

describe("Ein Paket löschen", () => {
  const actions = readFileSync(
    join(WURZEL, "src", "app", "admin", "actions.ts"),
    "utf8"
  );
  // Genau diese Funktion, nicht die nächste dazu: Ein zu grosses Fenster
  // hat den Test schon einmal grün gefärbt, weil der gesuchte Ausdruck
  // weiter unten in einer anderen Funktion stand.
  const start = actions.indexOf("export async function paketLoeschen");
  const naechste = actions.indexOf("\nexport ", start + 10);
  // Ohne Kommentare: Der Kommentar in dieser Funktion beschreibt den alten
  // Fehler und enthält den kaputten Ausdruck wörtlich. Sonst schlägt der
  // Test auf seiner eigenen Dokumentation an.
  const block = actions
    .slice(start, naechste === -1 ? undefined : naechste)
    .split("\n")
    .filter((z) => !z.trim().startsWith("//") && !z.trim().startsWith("*"))
    .join("\n");

  it("stornierte und bloss vorgemerkte Raten blockieren nicht", () => {
    // Der eigentliche Fehler. Wer storniert hat, schuldet nichts, und eine
    // vorgemerkte Rate ist noch keine Forderung.
    expect(block).not.toContain('neq("status"');
    expect(block).toMatch(
      /in\("status", \["invoiced", "pending_confirmation", "paid", "overdue"\]\)/
    );
  });

  it("eine gestellte Rechnung blockiert weiterhin", () => {
    // Buchhaltung: Was einmal fakturiert wurde, verschwindet nicht.
    expect(block).toContain('from("invoices")');
  });
});
