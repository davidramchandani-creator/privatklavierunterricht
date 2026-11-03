// ============================================================
// Strukturierte Daten für Suchmaschinen
//
// Google liest die sichtbare Seite und rät sich den Rest zusammen: Ist das
// ein Unternehmen? Wo? Was kostet es? Diese Angaben beantworten das
// ausdrücklich, in einem Format, das keine Interpretation braucht.
//
// Der Nutzen ist bei einem lokalen Angebot am grössten. „Klavierunterricht
// in meiner Nähe" ist eine Suche mit Ortsbezug — und ohne diese Angaben
// weiss Google zwar, dass das Wort Neftenbach auf der Seite vorkommt, aber
// nicht, dass dort unterrichtet wird.
//
// Alle Werte stammen aus Impressum und Preisseite. Erfundene Angaben wären
// hier besonders schädlich: Sie erscheinen im Suchergebnis, wo sie niemand
// gegenliest.
// ============================================================

import { BASIS_URL } from "./seo";
import { NEUPREISE } from "./neupreise";

export const KONTAKT_MAIL = "david.privatklavierunterricht@gmail.com";

export function unternehmenJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${BASIS_URL}/#unternehmen`,
    name: "Privatklavierunterricht David Ramchandani",
    description:
      "Individueller Klavierunterricht im Studio in Neftenbach. Ohne Noten, ohne Schema F, mit Gefühl und Verstand.",
    url: BASIS_URL,
    email: KONTAKT_MAIL,
    image: `${BASIS_URL}/opengraph-image`,
    priceRange: `CHF ${NEUPREISE.jahr}–${NEUPREISE.einzel}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Neftenbach",
      postalCode: "8413",
      addressRegion: "ZH",
      addressCountry: "CH",
    },
    // Der Unterricht findet im Studio in Neftenbach statt. Öffentlich steht
    // nur der Ort, keine Strasse. `areaServed` nennt, woher die Schüler
    // kommen.
    areaServed: [
      { "@type": "City", name: "Neftenbach" },
      { "@type": "City", name: "Winterthur" },
      { "@type": "City", name: "Pfungen" },
      { "@type": "City", name: "Hettlingen" },
    ],
    knowsLanguage: ["de-CH", "de"],
    makesOffer: [
      {
        "@type": "Offer",
        name: "Einzellektion, 45 Minuten",
        price: String(NEUPREISE.einzel),
        priceCurrency: "CHF",
      },
      {
        "@type": "Offer",
        name: "Semesterabo, Preis pro Lektion",
        price: String(NEUPREISE.semester),
        priceCurrency: "CHF",
      },
      {
        "@type": "Offer",
        name: "Jahresabo, Preis pro Lektion",
        price: String(NEUPREISE.jahr),
        priceCurrency: "CHF",
      },
    ],
  };
}
