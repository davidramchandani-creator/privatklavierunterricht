import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Am Desktop steht die Navigation in der Seitenleiste, am Handy in der
 * unteren Leiste plus dem „Mehr"-Blatt. Das sind zwei getrennte Listen im
 * Code — und sie sind auseinandergelaufen: Abrechnung, Abwesenheiten,
 * Verfügbarkeit, Schulferien und Testmodus gab es nur am Desktop. Am Handy
 * waren diese Seiten ausschliesslich über die Adresszeile erreichbar, ohne
 * dass irgendwo ein Fehler aufgetreten wäre.
 *
 * Solche Lücken fallen nicht auf, weil nichts kaputtgeht — es fehlt nur.
 * Darum vergleicht dieser Test beide Listen bei jedem Lauf.
 */

const ORDNER = join(process.cwd(), "src", "app", "admin", "_components");
const seitenleiste = readFileSync(join(ORDNER, "AdminNav.tsx"), "utf8");
const unten = readFileSync(join(ORDNER, "AdminBottomNav.tsx"), "utf8");

/** Alle `href: "/..."` aus einer Datei, in Reihenfolge des Auftretens. */
function hrefs(quelle: string): string[] {
  const treffer = quelle.matchAll(/href:\s*"(\/[^"]*)"/g);
  return [...treffer].map((m) => m[1]);
}

describe("Handy-Navigation deckt die Seitenleiste ab", () => {
  const amDesktop = hrefs(seitenleiste);
  const amHandy = hrefs(unten);

  it("findet überhaupt Einträge in beiden Dateien", () => {
    // Ohne diese Zusicherung wäre der Test nach einem Umbau der Schreibweise
    // still grün und würde nichts mehr prüfen.
    expect(amDesktop.length).toBeGreaterThan(10);
    expect(amHandy.length).toBeGreaterThan(10);
  });

  it("jeder Eintrag der Seitenleiste ist am Handy erreichbar", () => {
    const fehlend = amDesktop.filter((h) => !amHandy.includes(h));
    expect(fehlend).toEqual([]);
  });

  it("die fünf einmal vergessenen Seiten sind namentlich dabei", () => {
    // Namentlich, damit ein Umbau der Liste diese Seiten nicht unbemerkt
    // wieder verliert — sie waren schon einmal weg.
    for (const pfad of [
      "/admin/abrechnung",
      "/admin/abwesenheiten",
      "/admin/verfuegbarkeit",
      "/admin/schulferien",
      "/admin/testmodus",
    ]) {
      expect(amHandy).toContain(pfad);
    }
  });

  it("das Mehr-Blatt kann scrollen", () => {
    // Vierzehn Einträge plus Kopf und Abmelden sind höher als ein
    // Handybildschirm. Ohne Begrenzung rutscht „Abmelden" hinaus.
    expect(unten).toMatch(/max-h-\[calc\(100vh-\d+px\)\][\s\S]{0,40}overflow-y-auto/);
  });

  it("die untere Leiste hat genau vier Zellen", () => {
    // Drei Haupt-Tabs plus „Mehr". Mehr Zellen werden auf 390px zu schmal
    // für Symbol und Beschriftung.
    const haupt = unten.slice(
      unten.indexOf("const MAIN_TABS"),
      unten.indexOf("const MORE_ITEMS")
    );
    expect(hrefs(haupt)).toHaveLength(3);
  });
});
