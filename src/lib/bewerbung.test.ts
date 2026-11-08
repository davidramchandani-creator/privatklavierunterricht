import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANGEBOT, hinweise, pruefeBewerbung, vorlageFuer } from "./bewerbung";
import { renderEmail } from "./email-templates";
import { config } from "@/middleware";

const lies = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const gueltig = {
  vorname: "Lea",
  nachname: "Muster",
  email: "Lea@Example.ch",
  datenschutz: true,
  spielt_seit: "2012",
  stile: ["Pop", "Unsinn"],
  verfuegbarkeit: { mo: ["spaet", "x"], fr: ["nachmittag"] },
  unterrichtsorte: ["hausbesuch"],
  mobilitaet: ["velo"],
  unterrichtserfahrung: "etwas",
  mindestens_20: false,
};

describe("Bewerbung als Lehrperson", () => {
  it("nennt den Lohn offen", () => {
    expect(ANGEBOT.lohn).toBe(50);
    expect(lies("src/app/lehrperson-werden/page.tsx")).toContain("ANGEBOT.lohn");
  });

  it("prüft und bereinigt die Eingaben", () => {
    const r = pruefeBewerbung(gueltig, new Date("2026-11-08"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.daten.email).toBe("lea@example.ch");
    expect(r.daten.stile).toEqual(["Pop"]);
    expect(r.daten.verfuegbarkeit).toEqual({ mo: ["spaet"], fr: ["nachmittag"] });
    expect(r.daten.spielt_seit).toBe(2012);
  });

  it("verlangt Zeitfenster und Einwilligung", () => {
    expect(pruefeBewerbung({ ...gueltig, verfuegbarkeit: {} }).ok).toBe(false);
    expect(pruefeBewerbung({ ...gueltig, datenschutz: false }).ok).toBe(false);
  });

  it("gibt David Hinweise, auch zur Ferienentschädigung unter 20", () => {
    const r = pruefeBewerbung(gueltig);
    if (!r.ok) throw new Error();
    const h = hinweise(r.daten);
    expect(h.gut).toContain("macht Hausbesuche");
    expect(h.offen).toContain("nur 2 Zeitfenster pro Woche");
    expect(h.offen).toContain("unter 20: Ferienentschädigung 10.64 %");
  });

  it("hat vorbereitete Mails pro Stufe mit dem Vornamen", () => {
    expect(vorlageFuer("gespraech", "Lea")?.text).toContain("Hallo Lea");
    expect(vorlageFuer("absage", "Lea")?.text).toContain("Hallo Lea");
    expect(vorlageFuer("neu", "Lea")).toBeNull();
  });

  it("maskiert den Freitext der Mail", () => {
    const m = renderEmail("bewerbung_freitext", { betreff: "Hi", text: "Hallo <b>Lea</b>\n\nZweiter Absatz" });
    expect(m?.html).not.toContain("<b>Lea</b>");
    expect(m?.html).toContain("Zweiter Absatz");
  });

  it("die Seite ist öffentlich, das Portal nicht", () => {
    const trifft = (pfad: string) =>
      config.matcher.some((muster) => new RegExp("^" + muster.replace(/\/:path\*$/, "(?:/.*)?") + "$").test(pfad));
    expect(trifft("/lehrperson-werden")).toBe(false);
    expect(trifft("/lehrperson")).toBe(true);
  });

  it("steht in Navbar, Footer und Sitemap", () => {
    expect(lies("src/components/layout/Navbar.tsx")).toContain("/lehrperson-werden");
    expect(lies("src/components/layout/Footer.tsx")).toContain("/lehrperson-werden");
    expect(lies("src/app/sitemap.ts")).toContain("/lehrperson-werden");
  });
});
