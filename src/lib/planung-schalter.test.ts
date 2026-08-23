import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Zwei Schalter, zwei verschiedene Fragen — und ein gemeinsamer Fallstrick.
 *
 *   planung_aktiv  Sucht der Planer diesem Schüler einen Platz?
 *   hausbesuch     Fahre ich hin, oder kommt er zu mir?
 *
 * Der Fallstrick: Beide dürfen einen Schüler **nicht unsichtbar machen**.
 * Wer aus der Planung fällt, hört nicht auf zu existieren — sein
 * bestehender Termin blockiert weiter. Wer zu David kommt, belegt seine
 * Stunde genauso wie jeder andere, nur ohne Fahrweg.
 *
 * Beide Male wäre der naheliegende Weg (einfach rausfiltern) der falsche:
 * Die Stunde sähe frei aus, und der Planer legte jemanden darauf. Ein
 * Doppeltermin, den niemand bemerkt, bis David vor zwei Türen steht.
 */

const planung = readFileSync(
  join(process.cwd(), "src", "lib", "planung-server.ts"),
  "utf8"
);
const routing = readFileSync(
  join(process.cwd(), "src", "lib", "routing-server.ts"),
  "utf8"
);
const actions = readFileSync(
  join(process.cwd(), "src", "app", "admin", "actions.ts"),
  "utf8"
);

/**
 * Eine Funktion aus dem Quelltext schneiden — und lieber scheitern als
 * still das Falsche prüfen.
 *
 * Der erste Anlauf hatte einen Tippfehler im Funktionsnamen und fiel auf
 * „dann eben die ganze Datei" zurück. Die Tests waren grün, prüften aber
 * nichts: Der gesuchte String stand irgendwo anders in der Datei. Wenn der
 * Name nicht stimmt, muss es krachen.
 */
function funktion(quelle: string, name: string): string {
  const von = quelle.indexOf(`export async function ${name}`);
  if (von < 0) throw new Error(`Funktion ${name} nicht gefunden`);
  const rest = quelle.slice(von + 10);
  const ende = rest.indexOf("\nexport async function ");
  const abschnitt =
    ende < 0 ? quelle.slice(von) : quelle.slice(von, von + 10 + ende);
  if (abschnitt.length < 50) {
    throw new Error(`Abschnitt für ${name} ist verdächtig kurz`);
  }
  return abschnitt;
}

describe("Aus der Zuteilung genommen", () => {
  it("ist kein Kandidat mehr", () => {
    const fn = funktion(planung, "rechneZuteilung");
    expect(fn).toContain('eq("planung_aktiv", true)');
  });

  it("wird nicht mehr nach Zeiten gemahnt", () => {
    // Sonst stünde er bis zum Ende der Runde unter „hat nicht geantwortet",
    // obwohl von ihm keine Antwort erwartet wird.
    const fn = funktion(planung, "ladeAntwortStand");
    expect(fn).toContain('eq("planung_aktiv", true)');
  });

  it("bekommt auch vom Routenplaner keinen Platz gesucht", () => {
    const fn = funktion(routing, "ladeSchueler");
    expect(fn).toContain('eq("planung_aktiv", true)');
  });

  it("blockiert seinen bestehenden Termin trotzdem", () => {
    // Das ist der Kern. `ladeBestehendenPlan` liefert die belegten Zeiten
    // und darf den Schalter NICHT kennen — sonst sähe der Platz frei aus.
    const fn = funktion(planung, "ladeBestehendenPlan");
    expect(fn.length).toBeGreaterThan(100);
    expect(fn).not.toContain("planung_aktiv");
  });

  it("und die externen Termine ebenso", () => {
    const fn = funktion(planung, "ladeExterneTermine");
    expect(fn).not.toContain("planung_aktiv");
  });
});

describe("Kommt zu David statt umgekehrt", () => {
  const fn = funktion(routing, "ladeSchueler");

  it("kostet keine Fahrzeit", () => {
    // Rechnerisch sitzt er an Davids Adresse: Hin- und Rückweg null.
    expect(fn).toContain("hausbesuch");
    expect(fn).toContain("kommtZuDavid");
    expect(fn).toContain("zuhause.lat");
    expect(fn).toContain("zuhause.lng");
  });

  it("wird aber nicht aus der Planung geworfen", () => {
    // Der falsche Weg wäre ein Filter. Dann wäre seine Stunde scheinbar
    // frei und jemand anders würde daraufgelegt.
    expect(fn).not.toContain('eq("hausbesuch", true)');
  });
});

describe("Zeiten von Hand eintragen", () => {
  const fn = funktion(actions, "zeitenFuerSchuelerSetzen");

  it("speichert als Dauerangabe, nicht als Rundenangabe", () => {
    // Rundenangaben gehören dem Schüler. David trägt eine Dauerangabe ein,
    // die von einer späteren Antwort des Schülers gestochen wird.
    expect(fn).toContain("runde_id: null");
  });

  it("lässt die Angaben des Schülers unangetastet", () => {
    // Beim Ersetzen darf nur die eigene Dauerangabe weg, nicht das, was
    // der Schüler in einer Runde gesagt hat.
    expect(fn).toContain('is("runde_id", null)');
  });

  it("weist ein Fenster ab, das vor seinem Beginn endet", () => {
    // Sonst verschwindet der Schüler lautlos aus dem Plan mit der Meldung,
    // er könne an keinem Tag.
    expect(fn).toContain("f.fruehestens < f.spaetestens");
    expect(fn).toContain("endet vor seinem Beginn");
  });

  it("prüft Wochentag und Präferenz", () => {
    expect(fn).toContain("f.wochentag <= 6");
    expect(fn).toContain("[1, 2, 3].includes");
  });
});

describe("Die Schalter sind bedienbar und sichtbar", () => {
  const seite = readFileSync(
    join(process.cwd(), "src", "app", "admin", "schueler", "[id]", "page.tsx"),
    "utf8"
  );
  const liste = readFileSync(
    join(process.cwd(), "src", "app", "admin", "schueler", "page.tsx"),
    "utf8"
  );

  it("stehen auf der Schülerseite", () => {
    expect(seite).toContain("<PlanungSchalter");
    expect(seite).toContain("planung_aktiv, hausbesuch");
  });

  it("die Zeiterfassung ebenso", () => {
    expect(seite).toContain("<ZeitenErfassen");
  });

  it("und man sieht in der Liste, wer draussen ist", () => {
    // Ohne Kennzeichnung sucht man in der Zuteilung nach jemandem, der
    // absichtlich fehlt.
    expect(liste).toContain("nicht in der Planung");
    expect(liste).toContain("kommt zu mir");
  });
});
