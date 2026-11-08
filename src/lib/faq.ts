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
// damals Wegkosten ab 5 km nannte. (Seit November 2026 gibt es keine
// Hausbesuche mehr, der Unterricht findet im Studio in Neftenbach statt.)
//
// Erfundene Antworten sind hier besonders teuer. Sie stehen im
// Suchergebnis, jemand richtet sich danach, und am Ende widersprechen sie
// den AGB — auf die sich dann jemand beruft.
//
// Dieselbe Liste speist die sichtbare Seite und die strukturierten Daten für
// Google. Zwei getrennte Listen liefen unweigerlich auseinander, und dann
// stünde im Suchergebnis etwas anderes als auf der Seite.
// ============================================================

import { NEUPREISE, betrag } from "./neupreise";
import { GRUPPENUNTERRICHT, GRUPPE_ABWESENHEIT } from "./gruppenunterricht";

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
      "Nein. Ich unterrichte praxisorientiert mit Fokus auf Spielen nach Gehör, nach Mustern und nach Auge. Noten kommen dazu, wenn sie dir helfen, mit guten Medien und Apps. Voraussetzung sind sie nicht.",
  },
  {
    frage: "Wie lange dauert eine Lektion?",
    quelle: "LEKTION_MINUTEN in lib/tarifvergleich",
    antwort:
      "45 Minuten. Der Unterricht findet in meinem Studio in Neftenbach statt.",
  },
  {
    frage: "Was kostet der Unterricht?",
    quelle: "/preise, EIGENE_ANGEBOTE",
    antwort:
      `Eine Einzellektion kostet CHF ${betrag(NEUPREISE.einzel)}. Mit einem Semesterabo zahlst du CHF ${betrag(NEUPREISE.semester)} pro Lektion, mit einem Jahresabo CHF ${betrag(NEUPREISE.jahr)}. Alle Preise gelten für 45 Minuten.`,
  },
  {
    frage: "Gibt es Unterricht zu zweit oder zu dritt?",
    quelle: "/preise Abschnitt Zu zweit oder zu dritt, lib/gruppenunterricht",
    antwort: `Ja, als feste Gruppe im Semester- oder Jahresabo. Eine Lektion dauert ${GRUPPENUNTERRICHT[2].minuten} Minuten. Zu zweit zahlt jede Person CHF ${GRUPPENUNTERRICHT[2].semester} pro Lektion (Jahresabo CHF ${GRUPPENUNTERRICHT[2].jahr}), zu dritt CHF ${GRUPPENUNTERRICHT[3].semester} (Jahresabo CHF ${GRUPPENUNTERRICHT[3].jahr}). ${GRUPPE_ABWESENHEIT}`,
  },
  {
    frage: "Kommen Wegkosten dazu?",
    quelle: "/preise Abschnitt Wo der Unterricht stattfindet, AGB Ziffer 2",
    antwort:
      "Nein. Der Unterricht findet in meinem Studio in Neftenbach statt, es kommen keine Wegkosten dazu.",
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
      "Beim Abo steht der Preis pro Lektion tiefer, dafür gehst du eine feste Laufzeit ein: Das Semesterabo läuft bis Semesterende (Mitte Februar oder Mitte September), das Jahresabo zwei Semester. Wer später einsteigt, bezahlt nur die verbleibenden Lektionen. Bezahlt wird monatlich in gleichbleibenden Beträgen. Einzellektionen sind teurer, binden dich aber nicht.",
  },
  {
    frage: "Kann ich eine Lektion absagen oder verschieben?",
    quelle: "AGB Ziffer 6",
    antwort:
      "Ja, bis spätestens 24 Stunden vor Beginn, direkt über dein Portal auf der Website. Bei späterer Absage oder Nichterscheinen wird die Lektion verrechnet. Falle ich aus, bekommst du in jedem Fall Ersatz.",
  },
  {
    frage: "Was passiert in den Ferien?",
    quelle: "Abo-Bestaetigung, lib/abo-pdf",
    antwort:
      "In meinen Ferien und während meiner Praktika findet kein Unterricht statt. Diese Wochen sind in der Lektionszahl deines Abos bereits abgezogen. Sie werden weder verrechnet noch nachgeholt. In den Schulferien des Kantons ist sonst normal Unterricht.",
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
    quelle: "/preise, Abschnitt Wo der Unterricht stattfindet",
    antwort:
      "In meinem Studio in Neftenbach. Du spielst dort auf einem Kawai ES120, einem E-Piano mit 88 gewichteten Tasten und Hammermechanik, dessen Klang einem Kawai-Konzertflügel nachempfunden ist. Die genaue Adresse bekommst du, sobald wir einen Termin abgemacht haben.",
  },
  {
    frage: "Wie wird bezahlt?",
    quelle: "AGB Ziffer 4",
    antwort:
      "Per TWINT oder QR-Rechnung. Bei einem Abo kommt jeden Monat eine Rechnung über denselben Betrag, fällig innert 10 Tagen. Einzellektionen werden nach der Stunde verrechnet, fällig innert 15 Tagen.",
  },
  {
    frage: "Bist du ausgebildeter Musiklehrer?",
    quelle: "AGB Ziffer 1, /ueber-mich",
    antwort:
      "Ich bin angehende Lehrperson: Seit Herbst 2026 studiere ich an der PH Zürich, deren Diplom von der EDK anerkannt ist. Ein abgeschlossenes Musikpädagogikstudium habe ich noch nicht. Mein Unterricht beruht auf Spielerfahrung seit 2009 und eigenem Unterricht seit 2024, und er ist praxisorientiert. Wer eine konservatoriumsnahe Ausbildung sucht, ist bei einer Musikschule besser aufgehoben. Wer spielen lernen will, was ihm gefällt, bei mir.",
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
