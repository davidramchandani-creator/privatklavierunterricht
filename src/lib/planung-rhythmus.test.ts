import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Welcher Rhythmus gilt beim Planen — und ab wann.
 *
 * Eine Umstellungsrunde plant die **kommende** Periode. Das aktive Paket
 * beschreibt die alte und läuft bis zum Stichtag weiter. Wer beim Planen
 * das Paket liest, rechnet den neuen Plan mit den alten Rhythmen.
 *
 * Genau das ist passiert: Marina hatte für ab September zweiwöchentlich
 * gewählt, ihr laufendes Paket sagt wöchentlich. Die Zuteilung las die
 * Wahl und rechnete richtig, der Routenplaner las das Paket und
 * reservierte ihr jede Woche einen Platz — doppelt so viel wie nötig, mit
 * doppelter Fahrzeit in der Wochenbilanz.
 *
 * Zwei Stellen, dieselbe Frage, verschiedene Antworten. Diese Tests halten
 * beide auf derselben Reihenfolge fest:
 *
 *   1. Wahl in der offenen Runde   (gilt für die neue Periode)
 *   2. laufendes Paket             (gilt für die alte)
 *   3. externe Vereinbarung        (Externe haben kein Paket)
 *   4. sonst wöchentlich           (reserviert mehr Platz, ist sicherer)
 */

const routing = readFileSync(
  join(process.cwd(), "src", "lib", "routing-server.ts"),
  "utf8"
);
const planung = readFileSync(
  join(process.cwd(), "src", "lib", "planung-server.ts"),
  "utf8"
);

function funktion(quelle: string, name: string): string {
  const von = quelle.indexOf(`export async function ${name}`);
  if (von < 0) throw new Error(`Funktion ${name} nicht gefunden`);
  const rest = quelle.slice(von + 10);
  const ende = rest.indexOf("\nexport async function ");
  return ende < 0 ? quelle.slice(von) : quelle.slice(von, von + 10 + ende);
}

describe("Der Routenplaner nimmt den Rhythmus der neuen Periode", () => {
  const fn = funktion(routing, "ladeSchueler");

  it("liest die Wahl aus der offenen Runde", () => {
    expect(fn).toContain("planungs_antworten");
    expect(fn).toContain("abo_rhythmus");
    // Nur die offene Runde. Eine abgeschlossene beschreibt Vergangenes.
    expect(fn).toContain('eq("planungsrunden.status", "offen")');
  });

  it("lässt die Wahl das laufende Paket stechen", () => {
    // Die Reihenfolge ist der ganze Punkt.
    const stelle = fn.indexOf("gewaehlterRhythmus.get(p.id) ??");
    expect(stelle).toBeGreaterThan(-1);
    const danach = fn.slice(stelle, stelle + 160);
    expect(danach).toContain("paket?.rhythmus");
    expect(danach).toContain("externerRhythmus");
  });

  it("kennt auch Externe, die kein Paket haben", () => {
    expect(fn).toContain("externe_vereinbarungen");
  });
});

describe("Die Zuteilung macht es genauso", () => {
  // Sie war von Anfang an richtig. Der Test hält sie fest, damit die
  // beiden Stellen nicht wieder auseinanderlaufen.
  const fn = funktion(planung, "rechneZuteilung");

  it("liest die Wahl der Runde", () => {
    expect(fn).toContain("planungs_antworten");
    expect(fn).toContain("abo_rhythmus");
  });

  it("und lässt sie das Paket stechen", () => {
    expect(fn).toContain("gewaehlt ?? paket?.rhythmus");
  });
});

describe("Externe lassen sich bearbeiten", () => {
  const ui = readFileSync(
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
  const actions = readFileSync(
    join(process.cwd(), "src", "app", "admin", "actions.ts"),
    "utf8"
  );

  it("verlangt bei ihnen keine Mailadresse", () => {
    // Das `required` machte ihr Profil unspeicherbar: Man konnte nicht
    // einmal eine falsche Adresse korrigieren, weil das Formular auf einer
    // Mail bestand, die es bei Externen nie geben darf.
    expect(ui).toContain("required={!profile.extern}");
  });

  it("speichert eine leere Mail als null, nicht als leeren String", () => {
    const fn = funktion(actions, "updateSchueler");
    expect(fn).toContain('|| "").trim() || null');
  });
});

describe("Eine geänderte Adresse wird neu aufgelöst", () => {
  const fn = funktion(
    readFileSync(join(process.cwd(), "src", "app", "admin", "actions.ts"), "utf8"),
    "updateSchueler"
  );

  it("geokodiert beim Ändern", () => {
    // Vorher blieben die Koordinaten stehen. Eine korrigierte Adresse
    // änderte nur den angezeigten Text — Routenplaner und Zuteilung
    // rechneten weiter mit dem alten Ort. Besonders tückisch, wenn die
    // erste Auflösung danebenlag: Auf dem Bildschirm stimmt es, der Planer
    // fährt trotzdem ans falsche Ende des Kantons.
    expect(fn).toContain("geocode(");
    expect(fn).toContain("felder.lat");
    expect(fn).toContain("felder.lng");
    expect(fn).toContain("geocode_adresse");
  });

  it("nur wenn sie sich wirklich geändert hat", () => {
    // Sonst kostet jedes Speichern einen Geocoding-Aufruf.
    expect(fn).toContain('adresseNeu !== (bisher?.adresse ?? "").trim()');
  });

  it("bricht ab, statt eine unauflösbare Adresse zu speichern", () => {
    // Halb gespeichert wäre schlimmer: Text neu, Koordinaten alt.
    expect(fn).toContain("liess sich nicht auflösen");
  });

  it("frischt Route und Planung auf", () => {
    expect(fn).toContain('revalidatePath("/admin/routenplanung")');
  });
});
