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

export const KONTAKT_MAIL = "david.privatklavierunterricht@gmail.com";

export function unternehmenJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${BASIS_URL}/#unternehmen`,
    name: "Privatklavierunterricht David Ramchandani",
    description:
      "Individueller Klavierunterricht bei dir zu Hause. Ohne Noten, ohne Schema F — mit Gefühl und Verstand.",
    url: BASIS_URL,
    email: KONTAKT_MAIL,
    image: `${BASIS_URL}/opengraph-image`,
    priceRange: "CHF 65–85",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Neftenbach",
      postalCode: "8413",
      addressRegion: "ZH",
      addressCountry: "CH",
    },
    // Der Unterricht findet beim Schüler statt, nicht an einer
    // Ladenadresse. `areaServed` ist die ehrliche Angabe dafür.
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
        price: "85",
        priceCurrency: "CHF",
      },
      {
        "@type": "Offer",
        name: "Halbjahresabo, Preis pro Lektion",
        price: "70",
        priceCurrency: "CHF",
      },
      {
        "@type": "Offer",
        name: "Jahresabo, Preis pro Lektion",
        price: "65",
        priceCurrency: "CHF",
      },
    ],
  };
}
