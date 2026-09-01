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

  it("jede Antwort nennt ihre Quelle", () => {
    // Der Test, den es beim ersten Anlauf gebraucht hätte. Die Antwort zum
    // Instrument war frei erfunden, während die richtige auf der Preisseite
    // stand — samt Mietklavier, von dem in der FAQ nichts vorkam.
    for (const f of FAQ) {
      expect(f.quelle.length, `ohne Quelle: ${f.frage}`).toBeGreaterThan(3);
    }
  });

  it("jede Zahl in einer Antwort steht so auch auf einer echten Seite", () => {
    // **Von der FAQ aus geprüft, nicht umgekehrt.** Die erste Fassung
    // dieses Tests lautete sinngemäss „falls die FAQ 88 Tasten sagt, muss
    // die Preisseite 88 Tasten sagen" — und war damit blind gegen genau den
    // Fehler, den sie fangen sollte: Steht in der FAQ 76, prüft er nichts.
    // Die Gegenprobe hat das gezeigt.
    //
    // Jetzt wird jede Zahl mit Einheit aus den Antworten eingesammelt und
    // muss irgendwo im echten Seiteninhalt vorkommen.
    const quellen = [
      join(APP, "preise", "page.tsx"),
      join(APP, "agb", "page.tsx"),
      join(APP, "ueber-mich", "page.tsx"),
      join(APP, "probelektion", "page.tsx"),
      join(WURZEL, "src", "lib", "tarifvergleich.ts"),
      join(WURZEL, "src", "lib", "abo-pdf.ts"),
    ]
      .filter(existsSync)
      .map((p) => readFileSync(p, "utf8"))
      .join("\n");

    const behauptungen = new Set<string>();
    for (const f of FAQ) {
      /*
        Angaben, die nur David kennt, lassen sich nicht gegen die Seite
        prüfen. Das Mindestalter etwa steht nirgends, er hat es gesagt.
        Solche Einträge tragen ausdrücklich „Angabe David" als Quelle und
        sind damit von dieser Prüfung ausgenommen.

        Die Ausnahme entwertet den Test nicht, sie schärft ihn: Sie zwingt
        dazu, beim Schreiben zu entscheiden, ob eine Zahl belegt ist oder
        von David stammt. Was weder das eine noch das andere ist, fällt
        durch — und genau das war der ursprüngliche Fehler.
      */
      if (f.quelle.startsWith("Angabe David")) continue;
      // „88 Tasten", „5 Kilometer", „24 Stunden", „10 Tagen", „CHF 65",
      // „45 Minuten", „6 Monate" …
      // Die Einheiten stehen gebeugt: „5 Kilometern", „6 Monate", „10
      // Tagen". Die erste Fassung suchte `Kilometer\b` — und „Kilometern"
      // passte nicht, die Angabe wurde stillschweigend gar nicht geprüft.
      for (const m of f.antwort.matchAll(
        /\b(?:CHF\s*)?(\d{1,3})\s*(Tasten|Kilometer\w*|km|Stunden?|Tagen?|Minuten?|Monaten?|Jahren?)?/g
      )) {
        const zahl = m[1];
        const einheit = m[2];
        if (!einheit) continue;
        behauptungen.add(`${zahl} ${einheit}`);
      }
      // Preise gesondert, sie stehen oft ohne Einheit dahinter.
      for (const m of f.antwort.matchAll(/CHF\s*(\d{1,4})/g)) {
        behauptungen.add(`CHF:${m[1]}`);
      }
    }

    expect(behauptungen.size).toBeGreaterThan(5);

    // Zeilenumbrüche und Mehrfach-Leerzeichen raus: Im Quelltext steht
    // „88 Tasten" oft über zwei Zeilen verteilt.
    const flach = quellen.replace(/\s+/g, " ");

    const unbelegt: string[] = [];
    for (const b of behauptungen) {
      // **Zahl samt Einheit** muss vorkommen, nicht bloss die Zahl. Die
      // erste Fassung suchte nur nach der Ziffer — und „76" und „95" stehen
      // zufällig irgendwo im Quelltext, in Koordinaten und Dateinamen. Die
      // Gegenprobe lief damit durch, obwohl die FAQ falsche Tastenzahlen
      // und einen falschen Mietpreis behauptete.
      const gesucht = b.startsWith("CHF:")
        ? `CHF ${b.slice(4)}`
        : b.replace(/\s+/g, " ");
      if (!flach.includes(gesucht)) unbelegt.push(gesucht);
    }
    expect(unbelegt).toEqual([]);
  });

  it("die Anfahrt ist überall gleich beschrieben", () => {
    /*
      Die Regel hat sich geändert: Anfahrt inbegriffen, sobald in einer
      Umgebung mindestens drei Lektionen stattfinden. Der alte Satz (ab 5 km
      generell Wegkosten) stand an vier Stellen. Bleibt einer davon stehen,
      widersprechen sich Startseite, Preisseite und FAQ, und der Interessent
      glaubt die teuerste Aussage.
    */
    const oeffentlich = [
      join(APP, "preise", "page.tsx"),
      join(WURZEL, "src", "components", "sections", "Pakete.tsx"),
      join(WURZEL, "src", "components", "sections", "Preisrechner.tsx"),
    ]
      .map((p) => readFileSync(p, "utf8"))
      .join("\n")
      .replace(/\s+/g, " ");

    // Der alte, generelle Satz darf nirgends mehr stehen.
    expect(oeffentlich).not.toMatch(/Ab 5 km ab Neftenbach fallen Wegkosten/);
    expect(oeffentlich).not.toMatch(/Wegkosten ab 5 km ab Neftenbach/);
    expect(oeffentlich).not.toMatch(/erste 5 km kostenlos/);

    // Und die neue Zusage muss auf der Preisseite ausdrücklich stehen.
    const preise = readFileSync(join(APP, "preise", "page.tsx"), "utf8").replace(
      /\s+/g,
      " "
    );
    expect(preise).toContain("Die Anfahrt ist im Preis inbegriffen.");
    expect(preise).toContain("drei Lektionen");

    // Die FAQ sagt dasselbe und nennt die Ausnahme.
    const faqText = FAQ.map((f) => f.antwort).join(" ");
    expect(faqText).toContain("Anfahrt ist im Preis inbegriffen");
    expect(faqText).toContain("drei Lektionen");
  });

  it("der Preisrechner schlägt keine Wegkosten mehr auf", () => {
    // Er rechnete `basis + aufschlag`. Ein Rechner, der mehr zeigt als die
    // Preisseite verspricht, ist die teuerste Art von Widerspruch.
    const rechner = readFileSync(
      join(WURZEL, "src", "components", "sections", "Preisrechner.tsx"),
      "utf8"
    );
    expect(rechner).not.toMatch(/const aufschlag/);
    expect(rechner).toContain("const gesamt = basis;");
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
