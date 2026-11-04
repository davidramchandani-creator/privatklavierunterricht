import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { jahresaboZusatz, paketBezeichnungLang } from "./packages";
import { instalmentLabel } from "./package-invoice";

const ohneKommentare = (datei: string) =>
  readFileSync(join(process.cwd(), datei), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

/**
 * Hugo, 4. November 2026: Auf der Rechnung stand „Rate 1/6“, im Portal
 * waren es 4 Raten. Die Rechnung las die Gesamtzahl aus
 * `packages.instalment_count`, und die Semester-Umstellung führte dieses
 * Feld nicht nach.
 */
describe("Anzahl Raten auf der Rechnung", () => {
  it("zählt die Gesamtzahl aus den Raten selbst", () => {
    const code = ohneKommentare("src/lib/package-invoice.ts");
    const fn = code.slice(code.indexOf("export async function issueInstalmentInvoice"));
    expect(fn.slice(0, 1500)).toContain('.from("package_instalments")');
    expect(fn.slice(0, 1500)).toContain("ratenGesamt ?? pkg.instalment_count");
  });

  it("die Semester-Umstellung führt Anzahl und Betrag mit", () => {
    const code = ohneKommentare("src/lib/semester-umstellung-server.ts");
    expect(code).toContain("instalment_count: zeile.ratenAnzahl");
    expect(code).toContain("instalment_amount: zeile.rateNeu");
  });
});


/**
 * David, 4. November 2026: Das Jahresabo sah aus wie ein günstiges
 * Semesterabo. Jetzt steht überall, bis wann es läuft und in welchem
 * Semester man ist.
 */
describe("Jahresabo als Jahr erkennbar", () => {
  const erstes = { type: "20er", abo_variante: "jahr", periode_ende: "2027-02-21", bindung_bis: "2027-09-12" };
  const zweites = { type: "20er", abo_variante: "jahr", periode_ende: "2027-09-12", bindung_bis: "2027-09-12" };

  it("nennt Laufzeit und Semester", () => {
    expect(jahresaboZusatz(erstes)).toBe("bis 12.09.2027, 1. von 2 Semestern");
    expect(jahresaboZusatz(zweites)).toBe("bis 12.09.2027, 2. von 2 Semestern");
    expect(paketBezeichnungLang(erstes)).toBe("Jahresabo bis 12.09.2027, 1. von 2 Semestern");
  });

  it("lässt Semesterabos und alte Abos ohne Bindung unverändert", () => {
    expect(jahresaboZusatz({ abo_variante: "halbjahr", bindung_bis: "2027-02-21" })).toBeNull();
    expect(jahresaboZusatz({ abo_variante: "jahr", bindung_bis: null })).toBeNull();
    expect(paketBezeichnungLang({ type: "10er", abo_variante: "halbjahr" })).toBe("Semesterabo");
  });

  it("steht so auch auf der Rechnung", () => {
    expect(instalmentLabel("20er", "rate", 3, 6, "jahr", erstes)).toBe(
      "Jahresabo bis 12.09.2027, 1. von 2 Semestern, Rate 3/6"
    );
    expect(instalmentLabel("10er", "rate", 2, 4, "halbjahr")).toBe("Semesterabo, Rate 2/4");
  });
});
