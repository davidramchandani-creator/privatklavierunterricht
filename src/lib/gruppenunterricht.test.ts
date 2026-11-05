import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GRUPPENUNTERRICHT, GRUPPE_ABWESENHEIT, gruppenTotal } from "./gruppenunterricht";
import { FAQ } from "./faq";

const lies = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Gruppenunterricht (David, 5. November 2026)", () => {
  it("hat die abgemachten Preise und 60 Minuten", () => {
    expect(GRUPPENUNTERRICHT[2]).toMatchObject({ minuten: 60, semester: 65, jahr: 60 });
    expect(GRUPPENUNTERRICHT[3]).toMatchObject({ minuten: 60, semester: 55, jahr: 50 });
    expect(gruppenTotal(2, "semester")).toBe(130);
    expect(gruppenTotal(3, "semester")).toBe(165);
  });

  it("steht auf Startseite, Preisseite, FAQ und in den AGB", () => {
    expect(lies("src/components/sections/Pakete.tsx")).toContain("GRUPPENUNTERRICHT");
    expect(lies("src/app/preise/page.tsx")).toContain("GRUPPENUNTERRICHT");
    expect(lies("src/app/agb/page.tsx")).toContain("GRUPPE_ABWESENHEIT");
    expect(FAQ.some((f) => f.antwort.includes(GRUPPE_ABWESENHEIT))).toBe(true);
  });

  it("sagt klar, dass die Lektion stattfindet, wenn jemand fehlt", () => {
    expect(GRUPPE_ABWESENHEIT).toContain("trotzdem statt");
    expect(GRUPPE_ABWESENHEIT).toContain("alle zahlen");
  });
});
