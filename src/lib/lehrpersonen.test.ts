import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OEFFENTLICHE_FELDER,
  istOeffentlich,
  lohnAufteilung,
  orteText,
  pruefeLehrperson,
} from "./lehrpersonen";

const lies = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
function fd(werte: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(werte)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}

describe("Lehrpersonen 1b", () => {
  it("öffentlich sind nur unbedenkliche Felder", () => {
    for (const geheim of ["adresse", "startpunkt", "lohn", "profile_id", "entwurf", "nachname", "ferien"]) {
      expect(OEFFENTLICHE_FELDER).not.toContain(geheim);
    }
    // Die öffentliche Abfrage verwendet genau diese Liste.
    expect(lies("src/lib/lehrpersonen-server.ts")).toContain(".select(OEFFENTLICHE_FELDER)");
  });

  it("nennt Orte ohne Adresse", () => {
    expect(orteText({ unterrichtsorte: ["zuhause", "hausbesuch"], region: "Winterthur" })).toEqual([
      "Bei sich zu Hause (Region Winterthur)",
      "Hausbesuche (Region Winterthur)",
    ]);
  });

  it("zeigt nur aktive Lehrpersonen mit freigegebenem Text", () => {
    expect(istOeffentlich({ status: "aktiv", kurztext: "Hallo" })).toBe(true);
    expect(istOeffentlich({ status: "inaktiv", kurztext: "Hallo" })).toBe(false);
    expect(istOeffentlich({ status: "aktiv", kurztext: "  " })).toBe(false);
  });

  it("teilt den Lohn in Grundlohn und Ferienentschädigung (CHF 50 inklusive)", () => {
    expect(lohnAufteilung(50, 8.33)).toEqual({ grundlohn: 46.16, ferien: 3.84 });
    expect(lohnAufteilung(50, 10.64)).toEqual({ grundlohn: 45.19, ferien: 4.81 });
  });

  it("prüft das Formular", () => {
    const ok = pruefeLehrperson(
      fd({ vorname: "Anna", nachname: "Muster", unterrichtsorte: ["hausbesuch", "x"], lohn_pro_lektion: "50", altersgruppen: ["kinder"] })
    );
    expect(ok.ok && ok.daten.unterrichtsorte).toEqual(["hausbesuch"]);
    expect(ok.ok && ok.daten.ferien_prozent).toBe(8.33);
    expect(pruefeLehrperson(fd({ vorname: "Anna" })).ok).toBe(false);
    expect(pruefeLehrperson(fd({ vorname: "A", nachname: "B", lohn_pro_lektion: "-1" })).ok).toBe(false);
  });

  it("Leitbild: Lehrperson bestätigt nur für sich, über ihre Sitzung", () => {
    const sql = lies("supabase/migrations/072_lehrpersonen_profil_leitbild.sql");
    expect(sql).toContain("with check (teacher_id = own_teacher_id() and is_lehrperson())");
    expect(lies("src/app/lehrperson/actions.ts")).not.toContain("createAdminClient");
  });

  it("Text wird ohne HTML dargestellt", () => {
    expect(lies("src/components/EinfacherText.tsx")).not.toMatch(/dangerouslySetInnerHTML\s*=/);
  });
});
