// ============================================================
// Häufige Fragen
//
// Jede Antwort hier ist aus AGB, Preisseite oder dem tatsächlichen Ablauf
// abgeleitet — **nichts** davon ist neu erfunden. Eine FAQ, die etwas
// verspricht, das anderswo anders steht, ist schlimmer als keine: Sie ist
// die Stelle, auf die sich später jemand beruft.
//
// Dieselbe Liste speist die sichtbare Seite und die strukturierten Daten für
// Google. Zwei getrennte Listen liefen unweigerlich auseinander, und dann
// stünde im Suchergebnis etwas anderes als auf der Seite.
// ============================================================

export type FrageAntwort = {
  frage: string;
  antwort: string;
};

export const FAQ: FrageAntwort[] = [
  {
    frage: "Brauche ich ein eigenes Klavier?",
    antwort:
      "Für die Probelektion nicht. Danach schon: Ohne Instrument zum Üben zwischen den Stunden bringt Unterricht wenig. Ein einfaches Digitalpiano mit gewichteten Tasten genügt für den Anfang völlig, ein Flügel ist nicht nötig.",
  },
  {
    frage: "Muss ich Noten lesen können?",
    antwort:
      "Nein. Ich unterrichte praxisorientiert mit Fokus auf Spielen nach Gehör, nach Mustern und nach Auge. Noten kommen dazu, wenn sie dir helfen — sie sind nicht die Voraussetzung.",
  },
  {
    frage: "Wie lange dauert eine Lektion?",
    antwort:
      "45 Minuten. Der Unterricht findet bei dir zu Hause statt, in Neftenbach und Umgebung.",
  },
  {
    frage: "Was kostet der Unterricht?",
    antwort:
      "Eine Einzellektion kostet CHF 85. Mit einem Halbjahresabo zahlst du CHF 70 pro Lektion, mit einem Jahresabo CHF 65. Alle Preise gelten für 45 Minuten inklusive Anfahrt.",
  },
  {
    frage: "Ist die Probelektion wirklich kostenlos?",
    antwort:
      "Ja, und sie verpflichtet zu nichts. Du buchst sie über die Website, wir spielen eine Stunde zusammen, und danach entscheidest du in Ruhe.",
  },
  {
    frage: "Was ist der Unterschied zwischen Abo und Einzellektionen?",
    antwort:
      "Beim Abo steht der Preis pro Lektion tiefer, dafür gehst du eine feste Laufzeit ein: 6 Monate beim Halbjahresabo, 12 Monate beim Jahresabo. Bezahlt wird monatlich in gleichbleibenden Beträgen. Einzellektionen sind teurer, binden dich aber nicht.",
  },
  {
    frage: "Kann ich eine Lektion absagen oder verschieben?",
    antwort:
      "Ja, bis spätestens 24 Stunden vor Beginn, direkt über dein Portal auf der Website. Bei späterer Absage oder Nichterscheinen wird die Lektion verrechnet. Falle ich aus, bekommst du in jedem Fall Ersatz.",
  },
  {
    frage: "Was passiert in den Schulferien?",
    antwort:
      "In den Schulferien findet kein Unterricht statt. Diese Wochen sind in der Lektionszahl deines Abos bereits abgezogen — sie werden weder verrechnet noch nachgeholt.",
  },
  {
    frage: "Ab welchem Alter ist Klavierunterricht sinnvoll?",
    antwort:
      "Ich unterrichte Kinder, Jugendliche und Erwachsene. Nach oben gibt es keine Grenze, und für den Einstieg ist es nie zu spät.",
  },
  {
    frage: "Wo unterrichtest du?",
    antwort:
      "Bei dir zu Hause, in Neftenbach und der Umgebung bis Winterthur. Ob deine Adresse noch dazugehört, klärt sich am schnellsten über das Kontaktformular.",
  },
  {
    frage: "Wie wird bezahlt?",
    antwort:
      "Per TWINT oder QR-Rechnung. Bei einem Abo kommt jeden Monat eine Rechnung über denselben Betrag, fällig innert 10 Tagen. Einzellektionen werden nach der Stunde verrechnet, fällig innert 15 Tagen.",
  },
  {
    frage: "Bist du ausgebildeter Musiklehrer?",
    antwort:
      "Ich habe kein abgeschlossenes Musikpädagogikstudium. Mein Unterricht beruht auf über 14 Jahren Spielerfahrung und langjährigem eigenem Unterricht, und er ist praxisorientiert. Wer eine konservatoriumsnahe Ausbildung sucht, ist bei einer Musikschule besser aufgehoben — wer spielen lernen will, was ihm gefällt, bei mir.",
  },
];

/**
 * Die strukturierten Daten, die Google versteht.
 *
 * Damit kann die FAQ direkt im Suchergebnis erscheinen, aufklappbar, ohne
 * dass jemand die Seite öffnet. Für lokale Suchen wie „Klavierunterricht
 * Neftenbach Kosten" ist das der Unterschied zwischen gefunden werden und
 * unter zehn anderen Ergebnissen stehen.
 */
export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.frage,
      acceptedAnswer: { "@type": "Answer", text: f.antwort },
    })),
  };
}
