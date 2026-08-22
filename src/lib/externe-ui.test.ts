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

describe("Einen einzelnen Termin für einen Externen buchen", () => {
  const serie = readFileSync(
    join(process.cwd(), "src", "lib", "series-booking.ts"),
    "utf8"
  );

  it("verlangt für Externe kein Paket", () => {
    // Die Sackgasse: Buchen scheiterte an „kein aktives Paket", und das
    // einzige Mittel dagegen — ein Paket anlegen — ist für Externe zu
    // Recht gesperrt. Damit liess sich einem externen Schüler überhaupt
    // kein Termin eintragen.
    const pruefung = serie.indexOf('"Der Schüler hat kein aktives Paket."');
    const zweig = serie.indexOf("if (!istExtern) {");
    expect(pruefung).toBeGreaterThan(-1);
    expect(zweig).toBeGreaterThan(-1);
    // Die Paketprüfung steht innerhalb des Nicht-extern-Zweigs.
    expect(zweig).toBeLessThan(pruefung);
  });

  it("hängt den Termin an die Vereinbarung statt an ein Paket", () => {
    expect(serie).toContain("externe_vereinbarung_id: externeVereinbarungId");
    expect(serie).toContain("package_id: pkg?.id ?? null");
  });

  it("verlangt eine aktive Vereinbarung", () => {
    // Ohne sie hinge der Termin an gar nichts und wäre in keiner
    // Abrechnung auffindbar.
    expect(serie).toContain("keine aktive Vereinbarung");
  });

  it("plant für Externe keine Erinnerungen ein", () => {
    // Sie haben keine Mailadresse; die Nachrichten blieben in der
    // Warteschlange liegen und gingen nie raus.
    // Der Aufruf, nicht der Import ganz oben.
    const erinnerung = serie.indexOf("await scheduleLessonReminders(");
    expect(erinnerung).toBeGreaterThan(-1);
    const wache = serie.lastIndexOf("if (!istExtern) {", erinnerung);
    expect(wache).toBeGreaterThan(-1);
    // Und dazwischen darf die Funktion nicht schon wieder zu Ende sein.
    expect(serie.slice(wache, erinnerung)).not.toContain("return {");
  });

  it("kein Terminvorschlag für Externe", () => {
    // Ein Vorschlag wartet auf Bestätigung im Portal. Externe haben
    // keines, der Vorschlag läge für immer offen da.
    const fn = funktion("createProposal", "withdrawProposal");
    expect(fn).toContain("Externe Schüler können nichts bestätigen");
    expect(seite).toContain("{!istExtern && <ProposalForm");
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
