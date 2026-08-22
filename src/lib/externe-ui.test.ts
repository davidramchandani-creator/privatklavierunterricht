import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Externe Schüler sind keine halben eigenen Schüler.
 *
 * Sie haben kein Paket, kein Abo, keinen Preis und keine Zahlungsart in
 * diesem System — ihr Geld läuft über die Plattform. Trotzdem stand auf
 * ihrer Schülerseite lange dieselbe Oberfläche wie bei allen anderen:
 * „Paket anlegen", Preisfelder, Zahlungsart. Wer das benutzte, erzeugte
 * eine echte Rechnung samt QR-PDF für jemanden ohne Rechnungsadresse, und
 * die Lektion stand danach in zwei Abrechnungen gleichzeitig.
 *
 * Zwei Ebenen halten das jetzt auseinander: Die Oberfläche zeigt es gar
 * nicht mehr an, und der Server nimmt es auch dann nicht an, wenn das
 * Formular doch abgeschickt wird. Die zweite Ebene ist die wichtigere —
 * eine versteckte Schaltfläche ist keine Sperre.
 */

const actions = readFileSync(
  join(process.cwd(), "src", "app", "admin", "actions.ts"),
  "utf8"
);
const seite = readFileSync(
  join(process.cwd(), "src", "app", "admin", "schueler", "[id]", "page.tsx"),
  "utf8"
);

function funktion(name: string, bis: string): string {
  const von = actions.indexOf(`export async function ${name}`);
  const ende = actions.indexOf(`export async function ${bis}`, von + 1);
  return actions.slice(von, ende > von ? ende : undefined);
}

describe("Der Server nimmt für Externe kein Paket an", () => {
  it("createPackageAdmin weist Externe ab", () => {
    const fn = funktion("createPackageAdmin", "aboAnlegenAdmin");
    expect(fn).toContain("extern");
    expect(fn).toContain("Externe Schüler bekommen kein Paket");
  });

  it("aboAnlegenAdmin weist Externe ab", () => {
    const fn = funktion("aboAnlegenAdmin", "externeVereinbarungSpeichern");
    expect(fn).toContain("Externe Schüler bekommen kein Abo");
  });

  it("die Prüfung steht vor dem Anlegen, nicht danach", () => {
    // Nach dem Insert wäre der Schaden schon da: Paketzeile, Rechnung,
    // Ratenplan.
    const fn = funktion("createPackageAdmin", "aboAnlegenAdmin");
    const pruefung = fn.indexOf("Externe Schüler bekommen kein Paket");
    const insert = fn.indexOf('.from("packages")');
    expect(pruefung).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(-1);
    expect(pruefung).toBeLessThan(insert);
  });
});

describe("Die Schülerseite zeigt Externen das Richtige", () => {
  it("kennt den Unterschied überhaupt", () => {
    // Vorher kam das Wort „extern" auf dieser Seite kein einziges Mal vor.
    expect(seite).toContain("istExtern");
    expect(seite).toContain("extern, plattform, externer_ertrag");
  });

  it("blendet Preise und Pakete aus", () => {
    expect(seite).toContain("{!istExtern && (");
  });

  it("zeigt stattdessen die Vereinbarung", () => {
    expect(seite).toContain("<ExterneVereinbarung");
  });

  it("zeigt bei den Zahlungen die externen Lektionen statt Rechnungen", () => {
    expect(seite).toContain("istExtern ? (");
    expect(seite).toContain("<ExternBoard");
  });
});

describe("Vereinbarung ändern", () => {
  const fn = funktion("externeVereinbarungSpeichern", "externenBeenden");

  it("lässt nur Externe durch", () => {
    // Umgekehrte Richtung derselben Trennung: Ein eigener Schüler hat
    // keine Vereinbarung und darf hier nicht landen.
    expect(fn).toContain('profil?.extern !== true');
  });

  it("darf den Termin offen lassen", () => {
    // Ohne Wochentag sucht die Zuteilung den Platz — das ist der
    // Regelfall, wenn mehrere Schüler zusammen verplant werden, und kein
    // Fehler.
    expect(fn).toContain("setzeExternenTermin");
    expect(fn).toContain('wochentagRoh !== ""');
  });

  it("erzeugt keine Rechnung und verschickt nichts", () => {
    expect(fn).not.toContain("Invoice");
    expect(fn).not.toContain("sendEmail");
  });

  it("frischt Kalender, Route und Zahlungen auf", () => {
    // Die Termine ändern sich, also müssen alle Seiten mit, die sie zeigen.
    expect(fn).toContain('revalidatePath("/admin/kalender")');
    expect(fn).toContain('revalidatePath("/admin/routenplanung")');
    expect(fn).toContain('revalidatePath("/admin/zahlungen")');
  });
});
