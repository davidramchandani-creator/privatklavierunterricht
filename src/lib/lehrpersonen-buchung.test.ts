import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OFFENE_FENSTER } from "./lehrperson-kontext";

const lies = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/**
 * Mehrere Lehrpersonen, Schritt 1c: Belegt ist nur, was dieselbe
 * Lehrperson betrifft. Diese Wächter halten fest, dass jede Stelle, die
 * belegte Zeiten liest, nach Lehrperson filtert.
 */
describe("Buchungslogik pro Lehrperson", () => {
  it("der Kontext filtert Termine, Abwesenheiten, Sperren und Zeiten nach Lehrperson", () => {
    const code = lies("src/lib/booking-server.ts");
    expect(code).toContain("lehrpersonFuer(admin, studentId || null, opts.teacherId)");
    for (const q of ["apptQuery", "absQuery", "blockQuery", "ruleQuery", "availQuery"]) {
      expect(code).toContain(`${q} = ${q}.eq("teacher_id", lp.teacherId)`);
    }
    expect(code).toContain("lp.istInhaber ? undefined : OFFENE_FENSTER");
  });

  it("Platzsuche, Vorrücken und Überschneidungsprüfung bleiben bei der Lehrperson", () => {
    expect(lies("src/lib/fixplatz-suche.ts")).toContain('verfQuery = verfQuery.eq("teacher_id", lp.teacherId)');
    expect(lies("src/lib/vorrueck-server.ts")).toContain('kandidatenQuery.eq("teacher_id", lp.teacherId)');
    expect(lies("src/lib/series-booking.ts")).toContain('bestehendeQuery.eq("teacher_id", lp.teacherId)');
  });

  it("Davids Verfügbarkeit, Routen und Kalender betreffen nur ihn", () => {
    const actions = lies("src/app/admin/actions.ts");
    expect(actions).toContain('loeschen = loeschen.eq("teacher_id", inhaber)');
    expect(lies("src/lib/routing-server.ts")).toContain('.eq("teachers.ist_inhaber", true)');
    expect(lies("src/lib/kalender-feed-server.ts")).toContain('abfrage = abfrage.eq("teacher_id", inhaber)');
    expect(lies("src/lib/google-calendar.ts")).toContain("!appt.vonDavid");
  });

  it("eine Abwesenheit einer Lehrperson verlängert nur ihre eigenen Abos", () => {
    expect(lies("src/app/admin/actions.ts")).toContain('else query = query.eq("teacher_id", absence.teacher_id)');
  });

  it("neue Einträge übernehmen die Lehrperson vom Schüler (Datenbank-Trigger)", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/074_lehrperson_vom_schueler.sql"), "utf8");
    for (const t of ["appointments", "packages", "booking_requests", "proposals", "reschedule_requests"]) {
      expect(sql).toContain(`'${t}'`);
    }
  });

  it("andere Lehrpersonen ohne eigene Zeiten: Montag bis Samstag offen, Sonntag nicht", () => {
    expect(Object.keys(OFFENE_FENSTER).map(Number)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
