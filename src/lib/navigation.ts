// ============================================================
// Navigation der öffentlichen Seiten
//
// David, 16. November 2026: Die Webseite soll nicht nur ein One-Pager sein,
// sondern eine übersichtliche Navigation haben. Gewählt: vier Bereiche,
// Unterricht, Einblicke, Preise, Über mich, dazu FAQ und Kontakt.
// „Lehrperson werden" wandert in den Footer, es richtet sich nicht an die
// Leute, für die die Seite gemacht ist.
//
// Eine einzige Quelle für Header, Handy-Menü und Footer. Vorher standen
// die Links an drei Stellen von Hand und liefen auseinander.
// ============================================================

import { FLOWKEY } from "./flowkey";

export type NavEintrag = {
  href: string;
  label: string;
  /** Kurze Zeile im Klappmenü, nur Tatsachen. */
  beschreibung?: string;
};

export type NavBereich = {
  label: string;
  /** Ziel beim Klick auf den Bereich selbst. */
  href: string;
  /** Unterpunkte im Klappmenü. Ohne: einfacher Link. */
  kinder?: NavEintrag[];
};

export const HAUPTNAVIGATION: NavBereich[] = [
  {
    label: "Unterricht",
    href: "/unterricht",
    kinder: [
      {
        href: "/unterricht#einzel",
        label: "Einzelunterricht",
        beschreibung: "45 Minuten im Studio in Neftenbach",
      },
      {
        href: "/unterricht#gruppen",
        label: "Zu zweit oder zu dritt",
        beschreibung: "Feste Gruppe, 60 Minuten",
      },
      {
        href: "/unterricht#ablauf",
        label: "So startest du",
        beschreibung: "Von der Anfrage zur ersten Lektion",
      },
      {
        href: "/probelektion",
        label: "Probelektion",
        beschreibung: "Unverbindlich ausprobieren",
      },
    ],
  },
  { label: "Einblicke", href: "/einblicke" },
  { label: "Preise", href: "/preise" },
  {
    label: "Über mich",
    href: "/ueber-mich",
    kinder: [
      { href: "/ueber-mich", label: "Über mich", beschreibung: "Wer ich bin und wie ich unterrichte" },
      { href: "/lehrpersonen", label: "Lehrpersonen", beschreibung: "Wer unterrichtet dich?" },
      // Partnerseite, erst nach Freigabe durch flowkey (lib/flowkey).
      ...(FLOWKEY.aktiv
        ? [{ href: "/flowkey", label: "Partner: flowkey", beschreibung: `${FLOWKEY.rabattProzent} % auf die Klavier-App` }]
        : []),
    ],
  },
  { label: "FAQ", href: "/faq" },
  { label: "Kontakt", href: "/kontakt" },
];

/** Footer: alle öffentlichen Seiten, flach. */
export const FOOTER_NAVIGATION: NavEintrag[] = [
  { href: "/unterricht", label: "Unterricht" },
  { href: "/einblicke", label: "Einblicke" },
  { href: "/preise", label: "Preise" },
  { href: "/probelektion", label: "Probelektion" },
  { href: "/ueber-mich", label: "Über mich" },
  { href: "/lehrpersonen", label: "Lehrpersonen" },
  { href: "/faq", label: "Häufige Fragen" },
  { href: "/kontakt", label: "Kontakt" },
  { href: "/lehrperson-werden", label: "Lehrperson werden" },
  ...(FLOWKEY.aktiv ? [{ href: "/flowkey", label: "Partner: flowkey" }] : []),
];

/**
 * Gehört der aktuelle Pfad zu diesem Bereich? Für die Markierung im Header.
 * Anker zählen nicht, `/unterricht#gruppen` ist `/unterricht`.
 */
export function istAktiv(pfad: string, bereich: NavBereich): boolean {
  const ziele = [bereich.href, ...(bereich.kinder ?? []).map((k) => k.href)]
    .map((h) => h.split("#")[0])
    .filter((h) => h !== "/");
  return ziele.some((z) => pfad === z || pfad.startsWith(`${z}/`));
}
