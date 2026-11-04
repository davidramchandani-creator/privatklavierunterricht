import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
