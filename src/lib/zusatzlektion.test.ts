import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Zusatzlektion neben dem Abo.
 *
 * Emilie, 18. September 2026: Abo läuft, eine Lektion zusätzlich. Ein
 * Einzellektion-Paket ging nicht (ein Paket je Schüler), die Direktbuchung
 * hängte sie ans Abo, das „keine Lektionen mehr übrig" hatte.
 *
 * Regel: Sie hängt am Abo, zählt nicht zu dessen Lektionen und wird nach
 * der Lektion einzeln zum Einzelpreis des Schülers abgerechnet.
 */
describe("Zusatzlektion", () => {
  const wurzel = process.cwd();
  const ohne = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const lies = (...p: string[]) => ohne(readFileSync(join(wurzel, ...p), "utf8"));

  const migration = readFileSync(
    join(wurzel, "supabase", "migrations", "063_zusatzlektion.sql"),
    "utf8"
  );
  const serie = lies("src", "lib", "series-booking.ts");
  const actions = lies("src", "app", "admin", "actions.ts");
  const zahlungen = lies("src", "app", "admin", "zahlungen", "page.tsx");
  const stand = lies("src", "lib", "lektionsstand-server.ts");
  const umstellung = lies("src", "lib", "umstellung-server.ts");
  const freigabe = lies("src", "lib", "freigabe-server.ts");
  const prognose = lies("src", "lib", "prognose-server.ts");
  const formular = lies(
    "src", "app", "admin", "schueler", "[id]", "_components", "SchuelerDetailActions.tsx"
  );

  it("der Paketzähler in der Datenbank lässt sie aus", () => {
    expect((migration.match(/and a\.zusatzlektion = false/g) ?? []).length).toBe(2);
  });

  it("die Direktbuchung umgeht mit Häkchen die Restprüfung und setzt das Feld", () => {
    expect(serie).toContain("!opts?.zusatzlektion && state.lessonsRemaining < lessonsCount");
    expect(serie).toContain("zusatzlektion: opts?.zusatzlektion === true");
    expect(actions).toContain('formData.get("zusatzlektion") === "on"');
    expect(formular).toContain('formData.set("zusatzlektion", "on")');
  });

  it("zählt nirgends zum Abo", () => {
    expect(stand).toContain('.eq("zusatzlektion", false)');
    // Terminliste in Vertrag und PDF
    expect(umstellung).toContain('.eq("zusatzlektion", false)');
    // Serie angleichen darf sie nicht als Serientermin zählen
    const fn = freigabe.slice(freigabe.indexOf("async function fuelleSerieAuf"));
    expect(fn.slice(0, fn.indexOf("planeFixplatzSerie"))).toContain('.eq("zusatzlektion", false)');
  });

  it("wird einzeln zum Einzelpreis abgerechnet", () => {
    expect(zahlungen).toContain('pkg?.billing_mode !== "pro_lektion" && !zusatz');
    expect(zahlungen).toContain("Number(p?.price_single ?? 85)");
    const rechnung = actions.slice(actions.indexOf("export async function createInvoiceForAppointment"));
    expect(rechnung.slice(0, 2500)).toContain("appt.zusatzlektion\n    ? Number(profile?.price_single ?? 85)");
    expect(prognose).toContain("roh.zusatzlektion\n      ? Number(profil.price_single ?? 85)");
  });
});
