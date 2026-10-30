// ============================================================
// Häufige Fragen
//
// **Jede Antwort muss eine Quelle auf der Seite haben.** Hinter jedem
// Eintrag steht, woher sie stammt. Wer eine Frage ergänzt, für die es keine
// Quelle gibt, muss David fragen — nicht plausibel weiterdenken.
//
// Das steht so ausdrücklich hier, weil es beim ersten Anlauf genau daran
// scheiterte: Die Antwort zum Instrument war frei erfunden („ein einfaches
// Digitalpiano mit gewichteten Tasten genügt"), obwohl auf der Preisseite
// die richtige Antwort stand — 88 Tasten, Anschlagdynamik, und ein
// vermitteltes Mietklavier für CHF 65 im Monat, von dem gar nichts in der
// FAQ vorkam. Ebenso falsch: „inklusive Anfahrt", während die Preisseite
// Wegkosten ab 5 km nennt.
//
// Erfundene Antworten sind hier besonders teuer. Sie stehen im
// Suchergebnis, jemand richtet sich danach, und am Ende widersprechen sie
// den AGB — auf die sich dann jemand beruft.
//
// Dieselbe Liste speist die sichtbare Seite und die strukturierten Daten für
// Google. Zwei getrennte Listen liefen unweigerlich auseinander, und dann
// stünde im Suchergebnis etwas anderes als auf der Seite.
// ============================================================

export type FrageAntwort = {
  frage: string;
  /** Woher die Antwort stammt. Ohne Quelle kein Eintrag. */
  quelle: string;
  antwort: string;
};

export const FAQ: FrageAntwort[] = [
  {
    frage: "Brauchst du ein eigenes Instrument?",
    quelle: "/preise, Abschnitt Instrument",
    antwort:
      "Zum Üben zwischen den Lektionen ja, mindestens ein Keyboard. Am besten ein E-Piano oder Klavier mit 88 Tasten und Anschlagdynamik, damit du von Anfang an die richtige Technik lernst statt sie später umzulernen. Noch keins? Ich vermittle ein Mietklavier für CHF 65 im Monat. So musst du nichts kaufen, bevor du weisst, ob dir das Spielen liegt.",
  },
  {
    frage: "Muss ich Noten lesen können?",
    quelle: "AGB Ziffer 1, /ueber-mich",
    antwort:
      "Nein. Ich unterrichte praxisorientiert mit Fokus auf Spielen nach Gehör, nach Mustern und nach Auge. Noten kommen dazu, wenn sie dir helfen. Voraussetzung sind sie nicht.",
  },
  {
    frage: "Wie lange dauert eine Lektion?",
    quelle: "LEKTION_MINUTEN in lib/tarifvergleich",
    antwort:
      "45 Minuten. Der Unterricht findet bei dir zu Hause statt, in Neftenbach und Umgebung.",
  },
  {
    frage: "Was kostet der Unterricht?",
    quelle: "/preise, EIGENE_ANGEBOTE",
    antwort:
      "Eine Einzellektion kostet CHF 85. Mit einem Halbjahresabo zahlst du CHF 70 pro Lektion, mit einem Jahresabo CHF 65. Alle Preise gelten für 45 Minuten.",
  },
  {
    frage: "Kommen Wegkosten dazu?",
    quelle: "/preise Abschnitt Anfahrt, AGB Ziffer 2",
    antwort:
      "In aller Regel nicht. Die Anfahrt ist im Preis inbegriffen, sobald in deiner Umgebung mindestens drei Lektionen stattfinden, und das ist der Normalfall. Ich unterrichte an einem Abend mehrere Leute auf derselben Strecke. Nur wenn ich eigens für eine einzelne Lektion in eine Gegend fahre, in der ich sonst niemanden unterrichte, kommen ab 5 Kilometern CHF 5.– pro angefangene 5 Kilometer dazu. Das bespreche ich vorher mit dir, nie nachträglich.",
  },
  {
    frage: "Ist die Probelektion wirklich kostenlos?",
    quelle: "/probelektion, /preise",
    antwort:
      "Ja, und sie verpflichtet zu nichts. Du buchst sie über die Website und lernst mich und meinen Unterricht in Ruhe kennen, bevor du dich entscheidest.",
  },
  {
    frage: "Was ist der Unterschied zwischen Abo und Einzellektionen?",
    quelle: "AGB Ziffer 3 und 4",
    antwort:
      "Beim Abo steht der Preis pro Lektion tiefer, dafür gehst du eine feste Laufzeit ein: 6 Monate beim Halbjahresabo, 12 Monate beim Jahresabo. Bezahlt wird monatlich in gleichbleibenden Beträgen. Einzellektionen sind teurer, binden dich aber nicht.",
  },
  {
    frage: "Kann ich eine Lektion absagen oder verschieben?",
    quelle: "AGB Ziffer 6",
    antwort:
      "Ja, bis spätestens 24 Stunden vor Beginn, direkt über dein Portal auf der Website. Bei späterer Absage oder Nichterscheinen wird die Lektion verrechnet. Falle ich aus, bekommst du in jedem Fall Ersatz.",
  },
  {
    frage: "Was passiert in den Schulferien?",
    quelle: "Abo-Bestaetigung, lib/abo-pdf",
    antwort:
      "In den Schulferien findet kein Unterricht statt. Diese Wochen sind in der Lektionszahl deines Abos bereits abgezogen. Sie werden weder verrechnet noch nachgeholt.",
  },
  {
    frage: "Für wen ist der Unterricht?",
    quelle: "/ueber-mich",
    antwort:
      "Für Anfängerinnen und Fortgeschrittene, und ausdrücklich auch für Wiedereinsteiger. Es zählt nicht die Perfektion, sondern dass du spielst, was dich berührt.",
  },
  {
    // Angabe von David selbst, sie steht sonst nirgends auf der Seite.
    frage: "Ab welchem Alter ist Klavierunterricht sinnvoll?",
    quelle: "Angabe David",
    antwort:
      "In der Regel ab etwa 6 Jahren, das kommt aber auf das Kind an und lässt sich in der Probelektion am besten beurteilen. Nach oben gibt es keine Grenze. Für den Einstieg ist es nie zu spät.",
  },
  {
    frage: "Wo unterrichtest du?",
    quelle: "/preise, Wegkosten und Einzugsgebiet",
    antwort:
      "Bei dir zu Hause, in Neftenbach und der Umgebung bis Winterthur. Ob deine Adresse noch dazugehört, klärt sich am schnellsten über das Kontaktformular.",
  },
  {
    frage: "Wie wird bezahlt?",
    quelle: "AGB Ziffer 4",
    antwort:
      "Per TWINT oder QR-Rechnung. Bei einem Abo kommt jeden Monat eine Rechnung über denselben Betrag, fällig innert 10 Tagen. Einzellektionen werden nach der Stunde verrechnet, fällig innert 15 Tagen.",
  },
  {
    frage: "Bist du ausgebildeter Musiklehrer?",
    quelle: "AGB Ziffer 1",
    antwort:
      "Ich habe kein abgeschlossenes Musikpädagogikstudium. Mein Unterricht beruht auf über 14 Jahren Spielerfahrung und langjährigem eigenem Unterricht, und er ist praxisorientiert. Wer eine konservatoriumsnahe Ausbildung sucht, ist bei einer Musikschule besser aufgehoben. Wer spielen lernen will, was ihm gefällt, bei mir.",
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
