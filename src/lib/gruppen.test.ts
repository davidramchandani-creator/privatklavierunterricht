import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  gruppenBehandlung,
  gruppenLektionspreis,
  gruppenMinuten,
  gruppenNameAus,
  leitTermin,
  pruefeMitglieder,
} from "./gruppen";
import { renderEmail } from "./email-templates";

const lies = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Feste Gruppen: Regeln", () => {
  it("nimmt den Gruppenpreis pro Person, Semester und Jahr", () => {
    expect(gruppenLektionspreis(2, "halbjahr")).toBe(65);
    expect(gruppenLektionspreis(2, "jahr")).toBe(60);
    expect(gruppenLektionspreis(3, "halbjahr")).toBe(55);
    expect(gruppenLektionspreis(3, "jahr")).toBe(50);
    expect(gruppenMinuten(2)).toBe(60);
    expect(gruppenMinuten(3)).toBe(60);
  });

  it("akzeptiert nur zwei oder drei verschiedene Schüler", () => {
    expect(pruefeMitglieder(["a", "b"])).toBe(2);
    expect(pruefeMitglieder(["a", "b", "c"])).toBe(3);
    expect(pruefeMitglieder(["a"])).toHaveProperty("error");
    expect(pruefeMitglieder(["a", "b", "c", "d"])).toHaveProperty("error");
    expect(pruefeMitglieder(["a", "a"])).toHaveProperty("error");
    expect(pruefeMitglieder(["a", " "])).toHaveProperty("error");
  });

  it("schlägt einen Namen aus den Vornamen vor", () => {
    expect(gruppenNameAus(["Anna", "Ben"])).toBe("Anna und Ben");
    expect(gruppenNameAus(["Anna", "Ben", "Cleo"])).toBe("Anna, Ben und Cleo");
    expect(gruppenNameAus([])).toBe("Gruppe");
  });

  it("Schüler sagt ab: kein Ersatz, keine Gutschrift, auch früh", () => {
    expect(gruppenBehandlung("schueler")).toEqual({
      lektionErhalten: false,
      ersatzSuchen: false,
      automatischNachholen: false,
    });
  });

  it("David sagt ab: offen erfasst, aber nichts automatisch gebucht", () => {
    expect(gruppenBehandlung("admin")).toEqual({
      lektionErhalten: true,
      ersatzSuchen: false,
      automatischNachholen: false,
    });
  });

  it("ein Google-Event pro Lektion, das nächste Mitglied rückt nach", () => {
    const t = [
      { id: "b", status: "booked" },
      { id: "a", status: "cancelled" },
      { id: "c", status: "booked" },
    ];
    expect(leitTermin(t)?.id).toBe("b");
    expect(leitTermin([{ id: "a", status: "cancelled" }])).toBeNull();
  });
});

describe("Feste Gruppen: eingebaut", () => {
  it("Migration legt gruppen und gruppe_id an", () => {
    const sql = lies("supabase/migrations/076_gruppen.sql");
    expect(sql).toContain("create table if not exists public.gruppen");
    expect(sql).toMatch(/packages\s+add column if not exists gruppe_id/);
    expect(sql).toMatch(/appointments\s+add column if not exists gruppe_id/);
    expect(sql).toContain("enable row level security");
  });

  it("Gruppe anlegen: 60 Minuten, kein Ausweichen, Rückbau bei Fehler", () => {
    const s = lies("src/lib/gruppen-server.ts");
    expect(s).toContain("pruefeFixplatzSerie(wunsch, ersterStart, ctx, minuten, ferien)");
    expect(s).toContain("plan.belegt.length > 0");
    expect(s).toContain("gruppe_id: gruppe.id");
    expect(s).toContain("await rueckbau()");
    // Preis anpassbar, Standard aus lib/gruppenunterricht.
    expect(s).toContain("e.preisProLektion ?? gruppenLektionspreis(groesse, e.variante)");
    expect(lies("src/app/admin/gruppen/actions.ts")).toContain("preisProLektion: preis");
    // Abwesenheiten einzelner Schüler sperren die Gruppe nicht.
    expect(s).toContain('a.scope === "admin"');
    // Arbeitszeiten sperren nicht, David wählt die Zeit selbst.
    expect(s).toContain("ctx.availabilityWindows = GANZER_TAG");
  });

  it("Absage, Vorrücken, Anhängen und Verschieben kennen Gruppen", () => {
    expect(lies("src/lib/ausfall.ts")).toContain("meldeGruppenAusfall");
    expect(lies("src/lib/fixplatz-server.ts")).toContain("if (pkg?.gruppe_id) return null;");
    expect(lies("src/lib/vorrueck-server.ts")).toContain("Gruppenlektion findet statt");
    expect(lies("src/app/schueler/portal/actions.ts")).toContain("Gruppenlektion mit festem Platz");
    expect(lies("src/app/admin/actions.ts")).toContain("Das ist eine Gruppenlektion.");
    expect(lies("src/lib/subscription-jobs.ts")).toContain("Gruppen-Abo nicht automatisch verlängert");
    expect(lies("src/lib/google-calendar.ts")).toContain("syncGruppenlektion");
  });

  it("Mails sagen bei Gruppen das Richtige", () => {
    const schueler = renderEmail("ausfall_kurzfristig", {
      student_name: "Anna Muster",
      original_datum: "2026-12-02T16:00:00.000Z",
      gruppe: true,
    });
    expect(schueler!.html).toContain("findet für die anderen");
    expect(schueler!.html).not.toContain("weniger als 24 Stunden");

    const admin = renderEmail("ausfall_admin", {
      student_name: "Anna Muster",
      original_datum: "2026-12-02T16:00:00.000Z",
      gruppe: true,
      gruppe_von_dir: true,
    });
    expect(admin!.html).toContain("Den planst du selbst");
  });
});
