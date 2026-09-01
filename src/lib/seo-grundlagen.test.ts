import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FAQ, faqJsonLd } from "./faq";
import { unternehmenJsonLd } from "./schema-org";

/**
 * Die Dinge, die eine öffentliche Seite braucht und die man nie wieder
 * anschaut, sobald sie einmal da sind.
 *
 * Genau darum stehen sie hier: Eine fehlende 404-Seite oder ein Titel, den
 * eine neue Unterseite von der Startseite erbt, verursachen keinen Fehler.
 * Sie fallen erst auf, wenn jemand von aussen darauf stösst — und dann ist
 * er weg.
 */

const WURZEL = process.cwd();
const APP = join(WURZEL, "src", "app");

/** Öffentliche Seiten: alles ausser Admin, Portal, API und Hilfsordnern. */
function oeffentlicheSeiten(): string[] {
  const raus: string[] = [];
  for (const eintrag of readdirSync(APP, { withFileTypes: true })) {
    if (!eintrag.isDirectory()) continue;
    // Alles hinter der Anmeldung zählt nicht als öffentliche Seite. Die
    // Liste muss deckungsgleich mit `robots.ts` sein — sonst prüft dieser
    // Test eine andere Menge, als Google zu sehen bekommt.
    if (
      [
        "admin",
        "api",
        "auth",
        "schueler",
        "bewerten",
        "offline",
        "benachrichtigungen",
      ].includes(eintrag.name) ||
      eintrag.name.startsWith("_") ||
      eintrag.name.startsWith("[")
    ) {
      continue;
    }
    if (existsSync(join(APP, eintrag.name, "page.tsx"))) raus.push(eintrag.name);
  }
  return raus;
}

describe("Fehlerseiten", () => {
  it("es gibt eine eigene 404-Seite", () => {
    // Ohne sie liefert Next.js seine englische Standardseite ohne Weg
    // zurück — bei einer Seite mit Umzugsgeschichte trifft das echte
    // Besucher, die einem alten Link folgen.
    expect(existsSync(join(APP, "not-found.tsx"))).toBe(true);
  });

  it("die 404-Seite führt weiter statt in die Sackgasse", () => {
    const s = readFileSync(join(APP, "not-found.tsx"), "utf8");
    expect(s).toContain('href="/"');
    expect(s).toContain('href="/probelektion"');
  });

  it("sie wird nicht indexiert", () => {
    const s = readFileSync(join(APP, "not-found.tsx"), "utf8");
    expect(s).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("es gibt eine Seite für Renderfehler", () => {
    expect(existsSync(join(APP, "error.tsx"))).toBe(true);
  });
});

describe("Jede öffentliche Seite hat Titel, Beschreibung und Canonical", () => {
  const seiten = oeffentlicheSeiten();

  it("findet überhaupt Seiten", () => {
    expect(seiten.length).toBeGreaterThan(5);
  });

  for (const name of seiten) {
    it(`/${name}`, () => {
      // Seiten mit Zustand tragen "use client" und können `metadata` nicht
      // exportieren — bei ihnen steht es im Layout daneben.
      const kandidaten = [
        join(APP, name, "page.tsx"),
        join(APP, name, "layout.tsx"),
      ].filter(existsSync);
      const text = kandidaten.map((p) => readFileSync(p, "utf8")).join("\n");

      expect(text).toMatch(/title:/);
      expect(text).toMatch(/description:/);
      expect(text).toMatch(/alternates:\s*\{\s*canonical:/);
    });
  }
});

describe("Vorschaubild für geteilte Links", () => {
  it("wird erzeugt, nicht als Datei gepflegt", () => {
    // Ein PNG im Repo veraltet still, sobald sich Satz oder Farbe ändern.
    expect(existsSync(join(APP, "opengraph-image.tsx"))).toBe(true);
  });

  it("hat die Grösse, die alle Dienste erwarten", () => {
    const s = readFileSync(join(APP, "opengraph-image.tsx"), "utf8");
    expect(s).toMatch(/width:\s*1200/);
    expect(s).toMatch(/height:\s*630/);
  });
});

describe("Strukturierte Daten", () => {
  it("das Unternehmen ist als lokales Angebot beschrieben", () => {
    const d = unternehmenJsonLd();
    expect(d["@type"]).toBe("LocalBusiness");
    expect(d.address.addressLocality).toBe("Neftenbach");
    expect(d.makesOffer.length).toBeGreaterThanOrEqual(3);
  });

  it("die Preise stimmen mit der Preisseite überein", () => {
    // Ein falscher Preis in strukturierten Daten erscheint im
    // Suchergebnis, wo ihn niemand gegenliest — und wird zur Zusage.
    const preise = unternehmenJsonLd().makesOffer.map((o) => o.price);
    expect(preise).toEqual(["85", "70", "65"]);

    const seite = readFileSync(join(APP, "preise", "page.tsx"), "utf8");
    for (const p of ["85", "70", "65"]) expect(seite).toContain(p);
  });

  it("die FAQ liefert gültige strukturierte Daten", () => {
    const d = faqJsonLd();
    expect(d["@type"]).toBe("FAQPage");
    expect(d.mainEntity).toHaveLength(FAQ.length);
    for (const e of d.mainEntity) {
      expect(e.name.length).toBeGreaterThan(5);
      expect(e.acceptedAnswer.text.length).toBeGreaterThan(20);
    }
  });

  it("beide Listen speisen sich aus derselben Quelle", () => {
    // Zwei getrennte Listen laufen auseinander, und dann steht im
    // Suchergebnis etwas anderes als auf der Seite.
    const seite = readFileSync(join(APP, "faq", "page.tsx"), "utf8");
    expect(seite).toContain('from "@/lib/faq"');
    expect(seite).toContain("faqJsonLd");
  });
});

describe("Sitemap", () => {
  const sitemap = readFileSync(join(APP, "sitemap.ts"), "utf8");

  it("führt jede öffentliche Seite auf", () => {
    // Eine Seite, die nicht in der Sitemap steht, findet Google
    // irgendwann von allein — oder eben nicht.
    for (const name of oeffentlicheSeiten()) {
      expect(sitemap).toContain(`"/${name}"`);
    }
  });
});
