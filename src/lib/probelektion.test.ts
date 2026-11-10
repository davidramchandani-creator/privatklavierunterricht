import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { pruefeProbelektion, ueberschneidungen, PROBELEKTION_MINUTEN } from "./probelektion";
import { renderEmail } from "./email-templates";

const basis = {
  vorname: "Zeynep",
  nachname: "",
  email: "",
  telefon: "",
  datum: "2026-11-12",
  zeit: "12:30",
  minuten: 60,
  notiz: "",
  mailSenden: false,
};

describe("Probelektion eintragen", () => {
  it("rechnet Beginn und Ende in Zürcher Zeit", () => {
    const r = pruefeProbelektion(basis);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.start.toISOString()).toBe("2026-11-12T11:30:00.000Z");
    expect(r.ende.toISOString()).toBe("2026-11-12T12:30:00.000Z");
  });

  it("Vorgabe sind 45 Minuten", () => {
    expect(PROBELEKTION_MINUTEN).toBe(45);
  });

  it("Mail nur mit E-Mail-Adresse", () => {
    expect(pruefeProbelektion({ ...basis, mailSenden: true }).ok).toBe(false);
    expect(pruefeProbelektion({ ...basis, mailSenden: true, email: "a@b.ch" }).ok).toBe(true);
  });

  it("ohne Mail ist die E-Mail freiwillig", () => {
    expect(pruefeProbelektion({ ...basis, email: "" }).ok).toBe(true);
  });

  it("lehnt fehlende Angaben ab", () => {
    expect(pruefeProbelektion({ ...basis, vorname: " " }).ok).toBe(false);
    expect(pruefeProbelektion({ ...basis, datum: "" }).ok).toBe(false);
    expect(pruefeProbelektion({ ...basis, minuten: 5 }).ok).toBe(false);
  });

  it("findet Überschneidungen, aber nicht direkt anschliessende Einträge", () => {
    const s = new Date("2026-11-12T12:30:00Z");
    const e = new Date("2026-11-12T13:15:00Z");
    const belegt = [
      { start: new Date("2026-11-12T11:30:00Z"), ende: new Date("2026-11-12T12:30:00Z"), was: "davor" },
      { start: new Date("2026-11-12T13:00:00Z"), ende: new Date("2026-11-12T13:45:00Z"), was: "drin" },
    ];
    expect(ueberschneidungen(s, e, belegt).map((b) => b.was)).toEqual(["drin"]);
  });

  it("Mail nennt Zeit und Ort und maskiert Eingaben", () => {
    const m = renderEmail("probelektion_bestaetigt", {
      vorname: "<b>Iris</b>",
      start_at: "2026-11-12T11:30:00.000Z",
      minuten: 60,
      ort: "Sattleracherstrasse 59, 8413 Neftenbach",
    });
    expect(m?.html).toContain("12:30");
    expect(m?.html).toContain("60 Minuten");
    expect(m?.html).toContain("Neftenbach");
    expect(m?.html).not.toContain("<b>Iris</b>");
  });

  it("geplante Probelektionen sperren die Zeit in der Buchungs-Engine", () => {
    const src = readFileSync("src/lib/booking-server.ts", "utf8");
    expect(src).toContain('from("probelektionen")');
    expect(src).toMatch(/\.eq\("status", "geplant"\)/);
  });
});
