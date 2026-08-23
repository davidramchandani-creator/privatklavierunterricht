import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BESTAETIGUNG_WARTET_TAGE,
  entscheide,
  ERSTE_MAHNUNG_TAGE,
  ZWEITE_MAHNUNG_TAGE,
  type OffeneRechnung,
} from "./mahnung";

/**
 * Fristen sind der ganze Inhalt dieses Moduls, also werden sie
 * durchgerechnet und nicht bloss im Quelltext nachgeschlagen.
 *
 * Die teuerste Fehlerklasse hier ist nicht „erinnert zu spät", sondern
 * „erinnert zweimal am selben Tag" oder „erinnert jemanden, der längst
 * bezahlt hat". Beides beschädigt das Verhältnis zu Leuten, die David
 * jede Woche trifft — dagegen ist eine Rechnung, die drei Tage später
 * angemahnt wird, harmlos.
 */

const JETZT = new Date("2026-08-20T09:00:00.000Z");
const vorTagen = (n: number) =>
  new Date(JETZT.getTime() - n * 86400000).toISOString();

const rechnung = (over: Partial<OffeneRechnung> = {}): OffeneRechnung => ({
  id: "r1",
  status: "unpaid",
  faellig: vorTagen(30),
  erstellt: vorTagen(45),
  mahnstufe: 0,
  erinnertAm: null,
  bestaetigungErinnertAm: null,
  ...over,
});

describe("Erinnerung an den Schüler", () => {
  it("schweigt, solange die Rechnung nicht überfällig ist", () => {
    const r = rechnung({ faellig: vorTagen(ERSTE_MAHNUNG_TAGE - 1) });
    expect(entscheide(r, JETZT).art).toBe("keine");
  });

  it("erinnert eine Woche nach Fälligkeit", () => {
    const r = rechnung({ faellig: vorTagen(ERSTE_MAHNUNG_TAGE) });
    expect(entscheide(r, JETZT)).toEqual({
      art: "schueler_erinnern",
      stufe: 1,
    });
  });

  it("schickt die zweite Erinnerung nicht am selben Tag hinterher", () => {
    // Eine alte Rechnung erfüllt beide Fristen gleichzeitig. Ohne Sperre
    // bekäme der Schüler erste und zweite Mahnung am selben Morgen.
    const r = rechnung({
      faellig: vorTagen(60),
      mahnstufe: 1,
      erinnertAm: vorTagen(1),
    });
    expect(entscheide(r, JETZT).art).toBe("keine");
  });

  it("erinnert ein zweites Mal, wenn zwei Wochen vergangen sind", () => {
    const r = rechnung({
      faellig: vorTagen(ZWEITE_MAHNUNG_TAGE),
      mahnstufe: 1,
      erinnertAm: vorTagen(ZWEITE_MAHNUNG_TAGE - ERSTE_MAHNUNG_TAGE),
    });
    expect(entscheide(r, JETZT)).toEqual({
      art: "schueler_erinnern",
      stufe: 2,
    });
  });

  it("hört nach zwei Erinnerungen auf", () => {
    // Ab hier übernimmt David persönlich. Eine dritte, vierte, fünfte Mail
    // löst nichts und macht die nächste Klavierstunde unangenehm.
    const r = rechnung({
      faellig: vorTagen(90),
      mahnstufe: 2,
      erinnertAm: vorTagen(30),
    });
    expect(entscheide(r, JETZT).art).toBe("keine");
  });

  it("rührt bezahlte und archivierte Rechnungen nicht an", () => {
    for (const status of ["paid", "archived", "rejected"]) {
      expect(entscheide(rechnung({ status }), JETZT).art).toBe("keine");
    }
  });

  it("nimmt das Erstelldatum, wenn keine Fälligkeit gesetzt ist", () => {
    const r = rechnung({ faellig: null, erstellt: vorTagen(ERSTE_MAHNUNG_TAGE) });
    expect(entscheide(r, JETZT).art).toBe("schueler_erinnern");
  });
});

describe("Gemeldete Zahlung wartet auf Bestätigung", () => {
  it("mahnt den Schüler nicht — er hat seinen Teil getan", () => {
    // Der peinlichste denkbare Fehler dieses Moduls: jemanden mahnen, der
    // gerade bestätigt hat, dass er bezahlt hat.
    const r = rechnung({
      status: "pending_confirmation",
      faellig: vorTagen(60),
    });
    expect(entscheide(r, JETZT).art).not.toBe("schueler_erinnern");
  });

  it("weist stattdessen David darauf hin", () => {
    const r = rechnung({
      status: "pending_confirmation",
      erstellt: vorTagen(BESTAETIGUNG_WARTET_TAGE),
    });
    expect(entscheide(r, JETZT).art).toBe("admin_bestaetigen");
  });

  it("lässt ihm ein paar Tage Zeit, bevor es nachhakt", () => {
    const r = rechnung({
      status: "pending_confirmation",
      erstellt: vorTagen(BESTAETIGUNG_WARTET_TAGE - 1),
      erinnertAm: null,
    });
    expect(entscheide(r, JETZT).art).toBe("keine");
  });

  it("wiederholt den Hinweis nicht täglich", () => {
    const r = rechnung({
      status: "pending_confirmation",
      erstellt: vorTagen(30),
      bestaetigungErinnertAm: vorTagen(2),
    });
    expect(entscheide(r, JETZT).art).toBe("keine");
  });

  it("hakt aber nach einer Woche nochmals nach", () => {
    const r = rechnung({
      status: "pending_confirmation",
      erstellt: vorTagen(30),
      bestaetigungErinnertAm: vorTagen(8),
    });
    expect(entscheide(r, JETZT).art).toBe("admin_bestaetigen");
  });
});

describe("Verdrahtung", () => {
  const server = readFileSync(
    join(process.cwd(), "src", "lib", "mahnung-server.ts"),
    "utf8"
  );
  const jobs = readFileSync(
    join(process.cwd(), "src", "lib", "subscription-jobs.ts"),
    "utf8"
  );

  it("läuft im täglichen Cron", () => {
    expect(jobs).toContain("mahneOffeneRechnungen");
  });

  it("schreibt weder Testschülern noch Externen", () => {
    // Testdaten dürfen niemanden anschreiben, und Externe bekommen aus
    // diesem System grundsätzlich keine Post.
    expect(server).toContain('eq("profiles.ist_test", false)');
    expect(server).toContain('eq("profiles.extern", false)');
  });

  it("vermerkt jede Erinnerung, sonst kommt sie morgen wieder", () => {
    expect(server).toContain("mahnstufe: was.stufe");
    expect(server).toContain("erinnert_am:");
    expect(server).toContain("bestaetigung_erinnert_am:");
  });

  it("sucht nur unbezahlte Rechnungen", () => {
    expect(server).toContain('is("paid_at", null)');
  });
});
