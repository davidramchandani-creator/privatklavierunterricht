import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const wurzel = process.cwd();
const lies = (p: string) => readFileSync(join(wurzel, p), "utf8");
const ohneKommentare = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function dateien(verzeichnis: string, gesammelt: string[] = []): string[] {
  if (!existsSync(verzeichnis)) return gesammelt;
  for (const e of readdirSync(verzeichnis)) {
    const p = join(verzeichnis, e);
    if (statSync(p).isDirectory()) dateien(p, gesammelt);
    else if (/\.tsx?$/.test(e)) gesammelt.push(p);
  }
  return gesammelt;
}

/**
 * Schritt 1a der mehreren Lehrpersonen (docs/Mehrere-Lehrpersonen-Plan.md).
 */
describe("Mehrere Lehrpersonen: Fundament", () => {
  const sql = lies("supabase/migrations/071_lehrpersonen_fundament.sql");

  it("ergänzt nur und setzt bestehende Daten auf David", () => {
    expect(sql).toContain("set default public.inhaber_teacher_id()");
    expect(sql).toContain("set teacher_id = public.inhaber_teacher_id() where teacher_id is null");
    // Kein Löschen, kein Truncate in der Migration
    expect(ohneKommentare(sql).toLowerCase()).not.toMatch(/\bdelete from\b|\btruncate\b|\bdrop table\b/);
  });

  it("Arbeitszeiten und Sperren sind nicht mehr öffentlich lesbar", () => {
    expect(sql).toContain('drop policy if exists "Verfügbarkeit öffentlich lesen"');
    expect(sql).toContain('drop policy if exists "Zeitblöcke öffentlich lesen"');
    expect(sql).toContain('drop policy if exists "Verfügbarkeitsregeln öffentlich lesen"');
  });

  it("protokolliert jede Änderung, ohne Geheimnisse", () => {
    expect(sql).toContain("create trigger audit after insert or update or delete");
    expect(sql).toContain("'kalender_token', 'access_token', 'angebot_token'");
  });

  /**
   * Der wichtigste Wächter. Das Lehrpersonen-Portal darf nie mit dem
   * Service-Schlüssel arbeiten, sonst umgeht es RLS und eine Lehrperson
   * könnte über einen Fehler im Code Preise oder fremde Schüler sehen.
   */
  it("das Lehrpersonen-Portal benutzt nie den Service-Schlüssel", () => {
    const portal = dateien(join(wurzel, "src/app/lehrperson"));
    expect(portal.length).toBeGreaterThan(0);
    for (const d of portal) {
      const code = ohneKommentare(readFileSync(d, "utf8"));
      expect(code, d).not.toContain("createAdminClient");
      expect(code, d).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });

  it("die Middleware leitet Lehrpersonen ins eigene Portal und schützt es", () => {
    const mw = lies("src/lib/supabase/middleware.ts");
    expect(mw).toContain('gehoertZu(pathname, "/lehrperson")');
    expect(mw).toContain('if (role !== "lehrperson")');
    expect(lies("src/middleware.ts")).toContain('"/lehrperson/:path*"');
  });

  it("ein RLS-Test liegt bereit", () => {
    const test = lies("supabase/tests/rls_lehrpersonen.sql");
    expect(test).toContain("rollback;");
    expect(test).toContain("lehrperson:packages");
  });
});
