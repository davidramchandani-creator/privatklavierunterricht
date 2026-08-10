import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Allgemeine Geschäftsbedingungen (AGB) – Privatklavierunterricht",
  description:
    "Allgemeine Geschäftsbedingungen für den Klavierunterricht von David Ramchandani.",
};

type Abschnitt = { titel: string; absaetze?: string[]; punkte?: string[] };

const abschnitte: Abschnitt[] = [
  {
    titel: "1. Unterricht & Inhalte",
    absaetze: [
      "Mein Unterricht basiert auf über 14 Jahren Spielerfahrung und persönlichem Unterricht.",
      "Ich habe kein abgeschlossenes Musikpädagogikstudium, sondern unterrichte praxisorientiert mit Fokus auf Spielen nach Gehör, Muster und Auge.",
      "Ein bestimmter Lernerfolg kann nicht garantiert werden, der Fortschritt hängt auch vom Engagement des Schülers ab.",
    ],
  },
  {
    titel: "2. Buchung & Preise",
    punkte: [
      "Alle Preise – ob für Einzellektionen oder Abos – sind verbindlich.",
      "Probestunden sind immer kostenlos.",
      "Einzellektionen sind nach der Buchung verbindlich und unterliegen denselben Regeln wie Abos.",
    ],
  },
  {
    titel: "3. Abo (Laufzeit & Umfang)",
    punkte: [
      "Mit dem Abschluss eines Abos gehst du eine verbindliche Vereinbarung über eine feste Laufzeit ein: 6 Monate beim Halbjahresabo, 12 Monate beim Jahresabo.",
      "Wie viele Lektionen dein Abo enthält, ergibt sich aus deinem gewählten Rhythmus (wöchentlich oder alle zwei Wochen), deinem Wochentag und der Ferienlage. Die genaue Zahl wird beim Abschluss für deinen Termin berechnet, dir vor der Bestätigung angezeigt und ist damit vertraglich zugesichert.",
      "In den Schulferien findet kein Unterricht statt. Diese Termine sind in der zugesicherten Lektionszahl bereits abgezogen und werden nicht verrechnet – es besteht dafür weder Anspruch auf Ersatz noch auf Rückerstattung.",
      "Die zugesicherten Lektionen sind innerhalb der Laufzeit zu beziehen. Nicht bezogene Lektionen verfallen am Ende der Laufzeit.",
      "Beim Fixplatz sind alle Termine der Laufzeit von Beginn an eingetragen. Bei flexibler Buchung buchst du jede Lektion selbst; die Lektionszahl gilt dann als Richtwert für die Preisberechnung.",
      "Ein vorzeitiger Ausstieg ist nur in Ausnahmefällen und nach Absprache möglich. Angefangene Monate bleiben in jedem Fall vollständig geschuldet; die restlichen Monate entfallen.",
    ],
  },
  {
    titel: "4. Zahlung",
    punkte: [
      "Das Abo wird monatlich bezahlt. Der Monatsbetrag ergibt sich aus dem Gesamtpreis der Laufzeit geteilt durch die Anzahl Monate und bleibt über die ganze Laufzeit gleich – unabhängig davon, wie viele Lektionen in einen einzelnen Monat fallen.",
      "Bezahlt wird per TWINT oder QR-Rechnung (IBAN-Überweisung). Jede Monatsrechnung wird am Monatsstichtag gestellt und ist innert 10 Tagen fällig.",
      "Eine Anzahlung gibt es nicht. Der Unterricht steht dir ab dem ersten Tag der Laufzeit vollständig zur Verfügung.",
      "Der Gesamtbetrag der Laufzeit ist mit dem Abschluss geschuldet. Die monatliche Zahlung ist eine Zahlungserleichterung und keine Kündigungsmöglichkeit.",
      "Den vollständigen Zahlungsplan mit allen Fälligkeitsdaten siehst du vor dem Abschluss und jederzeit im Portal.",
      "Einzellektionen werden nach der Lektion in Rechnung gestellt und sind innert 15 Tagen fällig.",
      "Die erste Mahnung gilt als Erinnerung. Ab der zweiten Mahnung wird eine Mahngebühr von CHF 20.– pro Mahnung erhoben.",
      "Bei mehr als zwei offenen, überfälligen Monatsrechnungen kann ich weitere Buchungen aussetzen, bis der Rückstand ausgeglichen ist.",
    ],
  },
  {
    titel: "5. Automatische Verlängerung & Kündigung",
    punkte: [
      "Ist die automatische Verlängerung aktiv, verlängert sich das Abo am Ende der Laufzeit um eine neue Periode derselben Dauer – mit demselben Rhythmus, derselben Buchungsart und demselben festen Termin.",
      "Die Lektionszahl und damit der Monatsbetrag werden für die neue Periode neu berechnet, weil in verschiedenen Halbjahren unterschiedlich viele Ferien liegen. Der Preis pro Lektion bleibt dabei unverändert, sofern die Preise nicht generell angepasst wurden.",
      "Du kannst die Verlängerung jederzeit im Portal abschalten, spätestens jedoch 30 Tage vor Ablauf der laufenden Periode. Danach ist die Verlängerung ausgelöst und die neue Laufzeit verbindlich.",
      "Spätestens 30 Tage vor Ablauf erhältst du eine Erinnerung per E-Mail und Push, damit du rechtzeitig entscheiden kannst.",
      "Eine Kündigung wirkt auf das Ende der laufenden Periode. Bereits begonnene Perioden und offene Monatsbeträge bleiben geschuldet.",
      "Nicht bezogene Lektionen verfallen auch bei einer Verlängerung – sie werden nicht in die neue Periode übertragen.",
    ],
  },
  {
    titel: "6. Stornierung & Verschiebung",
    punkte: [
      "Lektionen können nur über die Website und bis spätestens 24 Stunden vor Beginn storniert oder verschoben werden.",
      "Bei späterer Absage oder Nichterscheinen wird der volle Preis der Lektion in Rechnung gestellt.",
    ],
  },
  {
    titel: "7. Krankheit, Unfall & Ferien",
    punkte: [
      "Bei längerfristiger, begründeter Krankheit oder Unfall wird das Paket pausiert. Die Gültigkeitsdauer verlängert sich entsprechend; der Ratenplan läuft unverändert weiter.",
      "Kurzzeitige Krankheitsabwesenheiten von weniger als zwei Wochen werden nicht berücksichtigt, da der Standard-Rhythmus zwei Wochen beträgt.",
      "Ferien von meiner Seite und von Schülerseite werden ebenfalls berücksichtigt und führen zur Pausierung des Pakets.",
      "Abwesenheiten durch Ferien oder längere Krankheiten müssen frühzeitig mitgeteilt werden.",
    ],
  },
  {
    titel: "8. Unterrichtsort & Material",
    punkte: [
      "Der Unterricht findet aktuell ausschliesslich beim Schüler statt.",
      "Ich stelle keine Unterrichtsmaterialien zur Verfügung, empfehle aber passende Materialien und Quellen nach bestem Wissen.",
      "Ein Anspruch auf Lernmaterialien besteht nicht.",
    ],
  },
  {
    titel: "9. Fehlerhafte Preisangaben",
    absaetze: [
      "Sollte aufgrund eines technischen Fehlers ein falscher Preis auf der Website angezeigt werden, gilt immer der von mir schriftlich oder mündlich bestätigte Preis.",
    ],
  },
  {
    titel: "10. Datenschutz",
    absaetze: [
      "Alle Daten werden vertraulich behandelt und nicht an Dritte weitergegeben. Sie dienen ausschliesslich der Organisation und Durchführung des Unterrichts.",
    ],
  },
  {
    titel: "11. Vertragsdauer",
    absaetze: [
      "Der Vertrag gilt für die Dauer des gebuchten Pakets und darüber hinaus, bis alle Lektionen eingelöst und alle offenen Beträge – einschliesslich noch ausstehender Raten – bezahlt wurden.",
    ],
  },
  {
    titel: "12. Schlussbestimmungen",
    absaetze: [
      "Der Unterricht basiert auf gegenseitigem Vertrauen und Einvernehmen.",
      "Sollte es trotzdem einmal nicht passen, suche ich zuerst das Gespräch. Änderungen dieser AGB behalte ich mir vor.",
    ],
  },
];

export default function AgbPage() {
  return (
    <main>
      <section className="bg-navy-900 pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-white space-y-4">
          <h1 className="text-3xl sm:text-4xl font-800 leading-tight">
            Allgemeine Geschäftsbedingungen
          </h1>
          <p className="text-white/70">
            für den Klavierunterricht von <strong className="text-white">David Ramchandani</strong>
          </p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-10">
          {abschnitte.map(({ titel, absaetze, punkte }) => (
            <div key={titel} className="space-y-3">
              <h2 className="text-xl font-800 text-navy-900">{titel}</h2>
              {absaetze?.map((a) => (
                <p key={a} className="text-gray-600 leading-relaxed">
                  {a}
                </p>
              ))}
              {punkte && (
                <ul className="space-y-2.5">
                  {punkte.map((p) => (
                    <li key={p} className="flex gap-3 text-gray-600 leading-relaxed">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-navy-900/40 flex-shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="pt-6 border-t border-[#EAECEF] text-sm text-gray-500">
            <p className="font-700 text-navy-900">David Ramchandani</p>
            <p>Klavierunterricht – Neftenbach</p>
          </div>
        </div>
      </section>
    </main>
  );
}
