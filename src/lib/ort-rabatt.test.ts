import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { kommtZuDavid, mitOrtRabatt, umrechnenBeiWechsel, ORT_RABATT_PROZENT } from "./ort-rabatt";
import { aboLektionspreis } from "./abo-server";
import { pricePerLessonFor } from "./packages";

/**
 * Unterricht bei David: 5 % auf alle Preise (Angabe David, 28.10.2026).
 * Angeknüpft an den Schalter „Ich fahre hin" (profiles.hausbesuch = false).
 */
describe("Rabatt", () => {
  it("ist 5 %", () => {
    expect(ORT_RABATT_PROZENT).toBe(5);
  });

  it("nur ein ausdrückliches false zählt, Standard ist Hausbesuch", () => {
    expect(kommtZuDavid(false)).toBe(true);
    expect(kommtZuDavid(true)).toBe(false);
    expect(kommtZuDavid(null)).toBe(false);
    expect(kommtZuDavid(undefined)).toBe(false);
  });

  it("zieht 5 % ab und rundet auf 5 Rappen", () => {
    expect(mitOrtRabatt(85, false)).toBe(80.75);
    expect(mitOrtRabatt(70, false)).toBe(66.5);
    expect(mitOrtRabatt(65, false)).toBe(61.75);
    expect(mitOrtRabatt(85, true)).toBe(85);
    expect(mitOrtRabatt(85, null)).toBe(85);
  });

  it("gilt beim Abo auf den ganzen Lektionspreis", () => {
    const preise = { halbjahr: 70, jahr: 65, wegaufschlag: 0 };
    expect(aboLektionspreis({ ...preise, hausbesuch: false }, "halbjahr", "fix")).toBe(66.5);
    expect(aboLektionspreis({ ...preise, hausbesuch: true }, "halbjahr", "fix")).toBe(70);
  });

  it("gilt bei Paketen und Einzellektionen", () => {
    const p = { price_single: 85, price_10er: 75, price_20er: 70, travel_surcharge: 0 };
    expect(pricePerLessonFor("single", { ...p, hausbesuch: false })).toBe(80.75);
    expect(pricePerLessonFor("single", p)).toBe(85);
  });

  it("beim Wechsel hin und zurück landet ein Monatsbetrag wieder dort", () => {
    for (const b of [116.65, 116.75, 233.3, 70]) {
      const runter = umrechnenBeiWechsel(b, true);
      expect(runter).toBeLessThan(b);
      expect(Math.abs(umrechnenBeiWechsel(runter, false) - b)).toBeLessThanOrEqual(0.05);
    }
  });
});

describe("Verdrahtung", () => {
  const ohne = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const lies = (...p: string[]) => ohne(readFileSync(join(process.cwd(), ...p), "utf8"));
  const actions = lies("src", "app", "admin", "actions.ts");
  const server = lies("src", "lib", "ort-rabatt-server.ts");
  const aboServer = lies("src", "lib", "abo-server.ts");
  const feed = lies("src", "lib", "kalender-feed-server.ts");
  const preise = readFileSync(join(process.cwd(), "src", "app", "preise", "page.tsx"), "utf8");

  it("die Abo-Preise lesen den Ort mit", () => {
    expect(aboServer).toContain('.select("price_halbjahr, price_jahr, travel_surcharge, hausbesuch")');
    expect(aboServer).toContain("mitOrtRabatt(basis, preise.hausbesuch)");
  });

  it("beim Umschalten gelten die neuen Preise sofort für offene Raten, nur bei echtem Wechsel", () => {
    const fn = actions.slice(actions.indexOf("export async function planungSchalterSetzen"));
    expect(fn.slice(0, 2000)).toContain('feld === "hausbesuch" && (vorher?.hausbesuch !== false) !== wert');
    expect(fn.slice(0, 2000)).toContain("wendeOrtWechselAn(admin, studentId, wert === false)");
    // Nur geplante, nicht gestellte Raten.
    expect(server).toContain('if (z.status === "open")');
  });

  it("der Kalender des Schülers zeigt Davids Adresse, wenn er zu ihm kommt", () => {
    expect(feed).toContain('wer.sicht === "schueler" && z.profiles?.hausbesuch === false');
  });

  it("öffentlich steht nur der Ort, keine Strasse", () => {
    expect(preise).toContain("DAVIDS_ORT");
    expect(preise).not.toContain("DAVIDS_ADRESSE");
    expect(preise).not.toContain("Sattleracherstrasse");
  });
});
