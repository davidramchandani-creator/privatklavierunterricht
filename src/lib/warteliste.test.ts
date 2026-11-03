import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { platzstufe, platzText, wartendeText, zaehlePlaetze } from "./platzstatus";
import { angebotFrist, angebotZustand, neuesToken, pruefeAnmeldung } from "./warteliste";
import { NEUPREISE, beispielMonatsrate, rabattGegenueberEinzel } from "./neupreise";
import { renderEmail } from "./email-templates";

function fd(werte: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(werte)) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  }
  return f;
}

describe("zaehlePlaetze", () => {
  it("zählt überlappende Startzeiten als einen Platz", () => {
    // 16:30, 16:45, 17:00 schliessen sich gegenseitig aus (45 Min + 10 Pause).
    const k = ["16:30", "16:45", "17:00", "17:15"].map((time) => ({ weekday: 1, time, parity: 0 as const }));
    expect(zaehlePlaetze(k, 55)).toBe(1);
  });

  it("zählt aufeinanderfolgende Lektionen mit Pause", () => {
    const k = ["16:30", "16:45", "17:00", "17:15", "17:30", "17:45", "18:00", "18:15", "18:30"].map(
      (time) => ({ weekday: 1, time, parity: 0 as const })
    );
    // 16:30, 17:30 (>= 17:25), 18:30 (>= 18:25)
    expect(zaehlePlaetze(k, 55)).toBe(3);
  });

  it("zählt gerade und ungerade Wochen getrennt", () => {
    const k = [
      { weekday: 4, time: "17:00", parity: 0 as const },
      { weekday: 4, time: "17:00", parity: 1 as const },
    ];
    expect(zaehlePlaetze(k, 55)).toBe(2);
  });

  it("zählt nichts, wenn nichts frei ist", () => {
    expect(zaehlePlaetze([], 55)).toBe(0);
  });
});

describe("Hinweis auf der Webseite", () => {
  it("zeigt bei vielen freien Plätzen nichts", () => {
    expect(platzText({ freiePlaetze: 9, wartende: 0, stufe: platzstufe(9) })).toBeNull();
  });
  it("zeigt die Zahl, wenn es knapp wird", () => {
    expect(platzText({ freiePlaetze: 2, wartende: 0, stufe: platzstufe(2) })).toBe("Nur noch 2 freie Plätze");
    expect(platzText({ freiePlaetze: 1, wartende: 0, stufe: platzstufe(1) })).toBe("Nur noch 1 freier Platz");
  });
  it("sagt ausgebucht und verweist auf die Warteliste", () => {
    expect(platzstufe(0)).toBe("ausgebucht");
    expect(platzText({ freiePlaetze: 0, wartende: 3, stufe: "ausgebucht" })).toContain("Warteliste");
  });
  it("nennt Wartende nur, wenn es welche gibt", () => {
    expect(wartendeText(0)).toBeNull();
    expect(wartendeText(1)).toBe("1 Person auf der Warteliste");
    expect(wartendeText(4)).toBe("4 Personen auf der Warteliste");
  });
});

describe("pruefeAnmeldung", () => {
  it("nimmt eine vollständige Anmeldung an", () => {
    const r = pruefeAnmeldung(
      fd({
        vorname: " Anna ",
        nachname: "Muster",
        email: "Anna@Example.CH",
        wunsch_rhythmus: "zweiwoechentlich",
        wunsch_tage: ["4", "1", "1", "7"],
      })
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.daten.vorname).toBe("Anna");
    expect(r.daten.email).toBe("anna@example.ch");
    expect(r.daten.wunsch_tage).toEqual([1, 4]);
    expect(r.daten.wunsch_rhythmus).toBe("zweiwoechentlich");
    expect(r.daten.nachricht).toBeNull();
  });

  it("lehnt fehlende Pflichtfelder und falsche Mail ab", () => {
    expect(pruefeAnmeldung(fd({ vorname: "A", email: "a@b.ch" })).ok).toBe(false);
    expect(pruefeAnmeldung(fd({ vorname: "A", nachname: "B", email: "kein-mail" })).ok).toBe(false);
  });

  it("macht aus einem unbekannten Rhythmus „egal“", () => {
    const r = pruefeAnmeldung(fd({ vorname: "A", nachname: "B", email: "a@b.ch", wunsch_rhythmus: "monatlich" }));
    expect(r.ok && r.daten.wunsch_rhythmus).toBe("egal");
  });
});

describe("Angebot", () => {
  const jetzt = new Date("2026-11-03T12:00:00Z");

  it("setzt die Frist und begrenzt sie auf 1 bis 14 Tage", () => {
    expect(angebotFrist(jetzt, 3).toISOString()).toBe("2026-11-06T12:00:00.000Z");
    expect(angebotFrist(jetzt, 0).toISOString()).toBe("2026-11-04T12:00:00.000Z");
    expect(angebotFrist(jetzt, 99).toISOString()).toBe("2026-11-17T12:00:00.000Z");
  });

  it("erkennt offene, abgelaufene und beantwortete Angebote", () => {
    expect(angebotZustand({ status: "angeboten", angebot_frist: "2026-11-05T00:00:00Z" }, jetzt)).toBe("offen");
    expect(angebotZustand({ status: "angeboten", angebot_frist: "2026-11-01T00:00:00Z" }, jetzt)).toBe("abgelaufen");
    expect(angebotZustand({ status: "zugesagt", angebot_frist: null }, jetzt)).toBe("beantwortet");
    expect(angebotZustand({ status: "wartend", angebot_frist: null }, jetzt)).toBe("ungueltig");
    expect(angebotZustand(null, jetzt)).toBe("ungueltig");
  });

  it("erzeugt lange, zufällige Kennungen", () => {
    const a = neuesToken();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(neuesToken()).not.toBe(a);
  });
});

describe("Mails der Warteliste", () => {
  it("maskiert Angaben aus dem öffentlichen Formular", () => {
    const m = renderEmail("warteliste_admin", {
      vorname: "<script>x</script>",
      nachname: "B",
      email: "a@b.ch",
      wunsch_tage: [1, 4],
      wunsch_rhythmus: "woechentlich",
    });
    expect(m?.html).not.toContain("<script>");
    expect(m?.html).toContain("&lt;script&gt;");
    expect(m?.html).toContain("Montag, Donnerstag");
  });

  it("enthält im Angebot den Link mit der Kennung und die Frist", () => {
    const m = renderEmail("warteliste_angebot", {
      vorname: "Anna",
      angebot_text: "Montag 17:00, alle zwei Wochen",
      angebot_frist: "2026-11-06T12:00:00Z",
      token: "abc123",
    });
    expect(m?.html).toContain("/warteliste/abc123");
    expect(m?.html).toContain("Montag 17:00, alle zwei Wochen");
  });
});

describe("Neue Preise", () => {
  it("sind 100 / 85 / 80", () => {
    expect(NEUPREISE).toEqual({ einzel: 100, semester: 85, jahr: 80 });
    expect(rabattGegenueberEinzel(85)).toBe(15);
    expect(rabattGegenueberEinzel(80)).toBe(20);
  });

  it("rechnen die Beispielraten auf 5 Rappen", () => {
    // 25 × 85 = 2125 / 7 = 303.57 → 303.55
    expect(beispielMonatsrate(25, 85, 7)).toBe(303.55);
    expect(beispielMonatsrate(13, 80, 7)).toBe(148.55);
  });

  /**
   * Gegenprobe: Die Vorgabewerte für neue Profile in der Datenbank müssen
   * dieselben sein wie auf der Webseite, sonst zahlt ein neuer Schüler
   * etwas anderes, als er gelesen hat.
   */
  it("stimmen mit den Vorgabewerten der Datenbank überein", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/068_neupreise_warteliste.sql"),
      "utf8"
    );
    expect(sql).toContain(`price_single set default ${NEUPREISE.einzel}.00`);
    expect(sql).toContain(`price_halbjahr set default ${NEUPREISE.semester}.00`);
    expect(sql).toContain(`price_jahr set default ${NEUPREISE.jahr}.00`);
  });

  it("stehen auf der Webseite nirgends mehr fest im Code", () => {
    for (const datei of [
      "src/components/sections/Pakete.tsx",
      "src/app/preise/page.tsx",
      "src/lib/faq.ts",
      "src/lib/schema-org.ts",
      "src/lib/tarifvergleich.ts",
    ]) {
      const ohneKommentare = readFileSync(join(process.cwd(), datei), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(ohneKommentare, datei).not.toMatch(/preis(45)?:\s*(85|70|65)\b/);
      expect(ohneKommentare, datei).not.toMatch(/CHF (85|70|65)\b(?! im Monat)/);
    }
  });
});
