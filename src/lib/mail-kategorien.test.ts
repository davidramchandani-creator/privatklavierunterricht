import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KATEGORIEN, empfaengerFuer, kategorieVon } from "./mail-kategorien";
import { STUDENT_LOOKUP_TYPES, STUDENT_PAYLOAD_TO_TYPES } from "./email-dispatch";

const haupt = { email: "jasmine@example.ch", kategorien: ["zahlungen", "termine", "abo", "sonstiges"] };
const roland = { email: "roland@example.ch", kategorien: ["zahlungen"] };

describe("Wer bekommt welche Mail", () => {
  it("die Rechnung geht an alle, die Zahlungen angekreuzt haben", () => {
    expect(empfaengerFuer("qr_invoice", haupt, [roland])).toEqual([
      "jasmine@example.ch",
      "roland@example.ch",
    ]);
  });

  it("die Terminerinnerung geht nur an die, die Termine angekreuzt haben", () => {
    expect(empfaengerFuer("lesson_reminder_24h", haupt, [roland])).toEqual(["jasmine@example.ch"]);
  });

  it("Maurices Fall: Zahlungen nur zum Vater, Termine nur zur Mutter", () => {
    const mutter = { email: "jasmine@example.ch", kategorien: ["termine", "abo", "sonstiges"] };
    expect(empfaengerFuer("twint_payment_request", mutter, [roland])).toEqual(["roland@example.ch"]);
    expect(empfaengerFuer("lesson_reminder_2h", mutter, [roland])).toEqual(["jasmine@example.ch"]);
  });

  it("hat eine Kategorie niemanden, springt die Hauptadresse ein", () => {
    // Ein fehlendes Häkchen darf keine Rechnung verschlucken.
    const nurTermine = { email: "jasmine@example.ch", kategorien: ["termine"] };
    expect(empfaengerFuer("qr_invoice", nurTermine, [])).toEqual(["jasmine@example.ch"]);
  });

  it("ein unbekannter Typ geht an die Hauptadresse", () => {
    expect(empfaengerFuer("irgendwas_neues", haupt, [roland])).toEqual(["jasmine@example.ch"]);
  });

  it("dieselbe Adresse zweimal ergibt eine Mail", () => {
    const doppelt = { email: "Jasmine@Example.ch", kategorien: ["zahlungen"] };
    expect(empfaengerFuer("qr_invoice", haupt, [doppelt])).toEqual(["jasmine@example.ch"]);
  });

  it("ohne Hauptadresse und ohne Treffer bleibt die Liste leer", () => {
    // Externe: Der Versand wirft dann sichtbar, statt ins Leere zu schicken.
    expect(empfaengerFuer("qr_invoice", null, [])).toEqual([]);
  });
});

describe("Jeder Mailtyp an Schüler hat eine Kategorie", () => {
  // Sonst bekäme eine neue Mail still nur die Hauptadresse, auch wenn der
  // Vater die Zahlungen abonniert hat.
  for (const type of [...STUDENT_PAYLOAD_TO_TYPES, ...STUDENT_LOOKUP_TYPES]) {
    it(type, () => {
      const k = kategorieVon(type);
      expect(k).not.toBeNull();
      expect(KATEGORIEN).toContain(k);
    });
  }
});

describe("Verdrahtung", () => {
  const dispatch = readFileSync(join(process.cwd(), "src", "lib", "email-dispatch.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("der Versand löst Schülermails über die Kategorien auf, nicht über profile.email", () => {
    expect(dispatch).toContain("ladeEmpfaenger(admin, String(payload.student_id), type)");
    expect(dispatch).not.toMatch(/to = profile\.email/);
    // Ein `to` im Payload zählt nur ohne student_id.
    expect(dispatch).toMatch(/else if \(payload\.to\)/);
  });

  it("schickt eine Mail je Adresse", () => {
    expect(dispatch).toContain("for (const to of an)");
  });
});
