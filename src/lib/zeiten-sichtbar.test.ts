import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Die angegebenen Zeiten müssen unabhängig von einer Planungsrunde sichtbar
 * sein.
 *
 * Der Anlass: Bei den Testschülern stand nirgends, wann sie können. Ihre
 * Angaben lagen als Dauerwert (`runde_id` null) vor — so speichert sie das
 * Portal beim Abo-Kauf und das Formular für externe Schüler. Sichtbar waren
 * Zeiten aber nur im Antwortstand einer Runde, und der filtert per
 * Definition auf `runde_id`. Ergebnis: vorhandene Daten, die niemand sehen
 * konnte.
 *
 * Ein Filter auf `runde_id` in der Schüleransicht würde das wiederholen,
 * darum diese Wächter.
 */
const detail = readFileSync(
  join(process.cwd(), "src", "app", "admin", "schueler", "[id]", "page.tsx"),
  "utf8"
);
const liste = readFileSync(
  join(process.cwd(), "src", "app", "admin", "schueler", "page.tsx"),
  "utf8"
);

/** Der Abfrageteil bis zum ersten `.order`, dort stehen die Filter. */
function abfrage(quelle: string): string {
  const start = quelle.indexOf('.from("student_verfuegbarkeit")');
  expect(start).toBeGreaterThan(-1);
  return quelle.slice(start, quelle.indexOf(".order", start));
}

describe("Angegebene Zeiten in der Schüleransicht", () => {
  it("holt sie ohne Rundenfilter", () => {
    // .eq("runde_id", ...) würde genau die Dauerangaben ausblenden, wegen
    // derer dieser Abschnitt gebaut wurde.
    expect(abfrage(detail)).not.toContain("runde_id\"");
    expect(abfrage(liste)).not.toContain("runde_id\"");
  });

  it("liest die Präferenz mit", () => {
    // Ohne Präferenz sähen Wunschzeit und Notlösung gleich aus, und man
    // könnte nicht beurteilen, ob eine Zuteilung dem Schüler entgegenkommt.
    expect(abfrage(detail)).toContain("praeferenz");
    expect(abfrage(liste)).toContain("praeferenz");
  });

  it("trennt Dauerangabe und Rundenangabe", () => {
    // Zusammengeworfen könnte eine überholte Angabe aus einer alten Runde
    // wie der aktuelle Stand aussehen.
    //
    // Seit die Dauerangabe im Admin auch bearbeitbar ist, stehen die beiden
    // in getrennten Karten: `ZeitenErfassen` für die dauerhaften Zeiten,
    // darunter die Runden zum Nachsehen. Die Trennung ist damit deutlicher
    // als vorher, nur die Überschrift heisst anders.
    expect(detail).toContain("dauerZeiten");
    expect(detail).toContain("<ZeitenErfassen");
    expect(detail).toContain("rundenListe");
    expect(detail).toContain("in den Runden angegeben");
    expect(liste).toContain("dauerVon");
  });

  it("lässt die Dauerangabe gewinnen", () => {
    // In der Übersicht ist nur für einen Stand Platz. Die Dauerangabe ist
    // der aktuelle; eine Rundenangabe kann ein Jahr alt sein.
    expect(liste).toContain("dauerVon[id] ?? rundeVon[id]?.fenster");
  });
});

describe("Ein Farbcode für Präferenzen", () => {
  it("kommt aus der geteilten Komponente", () => {
    // Zwei Stellen mit eigenen Farben für dieselbe Zahl wären schlimmer als
    // gar keine Farbe: Man würde ihnen glauben.
    for (const quelle of [detail, liste]) {
      expect(quelle).toContain("ZeitfensterListe");
    }
    const board = readFileSync(
      join(
        process.cwd(),
        "src",
        "app",
        "admin",
        "planung",
        "_components",
        "PlanungBoard.tsx"
      ),
      "utf8"
    );
    expect(board).toContain("ZeitfensterListe");
  });

  it("bedeutet Stern die Wunschzeit", () => {
    const komponente = readFileSync(
      join(process.cwd(), "src", "components", "ui", "zeitfenster-liste.tsx"),
      "utf8"
    );
    expect(komponente).toContain("praeferenz === 3");
    expect(komponente).toContain("Wunschzeit");
    expect(komponente).toContain("nur zur Not");
  });
});
