import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BILDMARKE_PFAD, GLYPHEN, LOGO, MARKE } from "./marke";
import { renderEmail } from "./email-templates";

/** Alle Quelldateien unter src, ohne Tests. */
function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((n) => {
    const p = join(ordner, n);
    if (statSync(p).isDirectory()) return dateien(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("Marke clavis", () => {
  it("heisst klein geschrieben clavis, ausgeschrieben Clavis Klavierschule", () => {
    expect(MARKE.name).toBe("clavis");
    expect(MARKE.voll).toBe("Clavis Klavierschule");
    expect(MARKE.zusatz).toBe("KLAVIERSCHULE");
  });

  it("der alte Name steht nirgends mehr als Name, nur noch in Domain und Mail-Adressen", () => {
    const erlaubt = /privatklavierunterricht\.(ch|vercel\.app)|@privatklavierunterricht|david\.privatklavierunterricht@|alternateName/i;
    const funde: string[] = [];
    for (const d of dateien("src")) {
      readFileSync(d, "utf8").split("\n").forEach((zeile, i) => {
        if (/privatklavierunterricht/i.test(zeile) && !erlaubt.test(zeile)) funde.push(`${d}:${i + 1}`);
      });
    }
    expect(funde).toEqual([]);
  });

  it("das alte Logo ist weg und wird nirgends mehr geladen", () => {
    expect(existsSync("public/Ueberschrift-hinzufuegen-4.svg")).toBe(false);
    for (const d of dateien("src")) expect(readFileSync(d, "utf8")).not.toContain("Ueberschrift-hinzufuegen");
  });

  it("das Logo färbt nur über currentColor, ohne Gold und ohne Filter", () => {
    const logo = readFileSync("src/components/layout/Logo.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(logo).toContain('fill="currentColor"');
    expect(logo).not.toMatch(/#C9A84C|gold|invert|filter/i);
  });

  it("Bildmarke und Wortmarke sind Umrisse, alle fünf Buchstaben sind da", () => {
    expect(BILDMARKE_PFAD.startsWith("M")).toBe(true);
    expect(LOGO.wortmarke.length).toBeGreaterThan(500);
    expect(LOGO.zusatz.length).toBeGreaterThan(500);
    expect(Object.keys(GLYPHEN).sort().join("")).toBe("cilsv");
  });

  it("Manifest und Icons tragen die neue Marke", () => {
    const m = JSON.parse(readFileSync("public/manifest.json", "utf8"));
    expect(m.name).toBe("Clavis Klavierschule");
    expect(m.short_name).toBe("clavis");
    for (const i of m.icons) expect(existsSync(join("public", i.src))).toBe(true);
    expect(m.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
    expect(readFileSync("public/icons/icon-512.svg", "utf8")).toContain("#1C244B");
  });

  it("Mails: Kopf zeigt clavis, die Signatur bleibt persönlich mit der Marke darunter", () => {
    const mail = renderEmail("anfrage_received", { vorname: "Anna" });
    expect(mail?.html).toContain(">clavis<");
    expect(mail?.html).toContain("KLAVIERSCHULE");
    expect(mail?.html).toContain("David Ramchandani<br/>Clavis Klavierschule");
    expect(mail?.html).not.toContain("Klavierunterricht David Ramchandani");
    // Die Adressen bleiben
    expect(readFileSync("src/lib/email-sender.ts", "utf8")).toContain("david@privatklavierunterricht.ch");
  });
});
