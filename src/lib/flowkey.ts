// ============================================================
// Partnerschaft mit flowkey
//
// David, 4. November 2026: Er wird Teacher Partner von flowkey (App zum
// Klavierlernen). Seine Schüler bekommen mit seinem Code 25 % Rabatt auf
// jedes flowkey-Abo, er erhält eine Provision und einen kostenlosen
// Premium-Zugang. Er zeigt das auf der Webseite einmal prominent und auf
// einer eigenen Seite, und zwar offen: dass er daran verdient.
//
// Konto bei flowkey: david.privatklavierunterricht@gmail.com.
//
// ── Freigabe ───────────────────────────────────────────────
//
// Vertrag 4.2: Werbematerial, das flowkey prominent zeigt, gibt flowkey
// vorher schriftlich frei. Darum zwei Stufen:
//   aktiv = false   Die Seite /flowkey ist erreichbar, aber nirgends
//                   verlinkt und für Suchmaschinen gesperrt. David kann
//                   den Link an flowkey zur Freigabe schicken.
//   aktiv = true    Abschnitt auf der Startseite, Link im Footer, Seite in
//                   der Sitemap.
//
// ── Brand Guidelines (flowkey-logo-use.pdf, 10.11.2026) ────
//   Orange Logo (#EF7D00) auf hellem Grund, auch auf dunklem, wenn der
//   Kontrast reicht; weisses Logo auf dunklem Grund oder auf Bildern.
//   Rundherum mindestens ein Drittel der Logohöhe Freiraum. Nicht
//   verfärben, drehen, verzerren, ausschneiden, transparent machen und
//   nicht als Wort mitten in einem Satz einsetzen.
//
// Die Beschreibung der App folgt „how-to-talk-about-flowkey.pdf“, nichts
// darüber hinaus.
// ============================================================

export const FLOWKEY = {
  /** Von flowkey freigegeben am 10. November 2026 (Vertrag 4.2). */
  aktiv: true,
  /** Beantragt am 4. November 2026. */
  code: "DAVID25",
  rabattProzent: 25,
  /** Seite, auf der man den Code einlöst (David, 10. November 2026). */
  url: "https://app.flowkey.com/code",
  /** Offizielle Dateien aus dem Brandfolder von flowkey. */
  logo: {
    orange: "/partner/flowkey-logo-orange.svg",
    weiss: "/partner/flowkey-logo-weiss.svg",
    /** Seitenverhältnis laut SVG (277.67 × 107.64). */
    verhaeltnis: 277.67 / 107.64,
  },
  orange: "#EF7D00",
} as const;

/** Was flowkey kann, aus dem Partnerdokument von flowkey übernommen. */
export const FLOWKEY_FUNKTIONEN = [
  {
    titel: "Tausende Songs",
    text: "Eine grosse Bibliothek von Klassik über Pop bis Filmmusik, für Klavier arrangiert und in mehreren Schwierigkeitsstufen. Vor dem Üben hörst du jede Version an.",
  },
  {
    titel: "Hört dir zu",
    text: "Über das Mikrofon deines Geräts erkennt flowkey, was du spielst, ganz ohne Kabel, und zeigt dir sofort, ob die Töne stimmen.",
  },
  {
    titel: "Warten, wiederholen, langsamer",
    text: "Im Wartemodus geht es erst weiter, wenn du den richtigen Ton spielst. Schwierige Stellen wiederholst du in einer Schlaufe, spielst sie langsamer oder übst jede Hand einzeln.",
  },
  {
    titel: "Video und Noten zusammen",
    text: "Du siehst die Hände auf den Tasten, die Notennamen und die Noten laufen synchron mit. So verbindest du Hören, Sehen und Notenlesen.",
  },
  {
    titel: "Kurse",
    text: "Vom ersten Ton über das Spielen mit beiden Händen bis zu Notenlesen, Tonleitern, Akkorden und Improvisation, Schritt für Schritt.",
  },
] as const;
