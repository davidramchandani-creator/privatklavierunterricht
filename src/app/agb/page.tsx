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
      "Alle Preise – ob für Einzellektionen oder Pakete – sind verbindlich.",
      "Probestunden sind immer kostenlos.",
      "Einzellektionen sind nach der Buchung verbindlich und unterliegen denselben Regeln wie Pakete.",
    ],
  },
  {
    titel: "3. Pakete (verbindlich & Rücktritt)",
    punkte: [
      "Mit der Buchung eines Pakets gehst du eine verbindliche Vereinbarung ein.",
      "Die enthaltenen Lektionen müssen innerhalb der im Angebot genannten Gültigkeitsdauer eingelöst werden.",
      "Nicht genutzte Lektionen innerhalb dieser Frist verfallen und werden zu 100 % verrechnet.",
      "Ein Paket kann bis zur 3. genommenen Lektion storniert werden. In diesem Fall werden die bereits genommenen Lektionen zum Einzellektionspreis verrechnet. Ab der 4. Lektion ist eine Stornierung des Pakets nicht mehr möglich.",
      "Auch bei Abbruch oder Unzufriedenheit nach der 3. Lektion bleibt der gesamte Paketbetrag geschuldet.",
      "Der Vertrag bleibt über die Paketlaufzeit hinaus bestehen, bis alle offenen Lektionen eingelöst und alle Zahlungen beglichen sind.",
    ],
  },
  {
    titel: "4. Zahlung & Mahnung",
    punkte: [
      "Beim Buchen eines Pakets wird der gesamte Paketbetrag in Rechnung gestellt. Die Zahlung erfolgt per TWINT oder QR-Rechnung (IBAN-Überweisung) und ist innert 15 Tagen fällig.",
      "Das Paket ist ab Buchung sofort nutzbar – du musst also nicht auf den Zahlungseingang warten, um Lektionen zu buchen.",
      "Einzellektionen werden nach der Lektion in Rechnung gestellt und sind ebenfalls innert 15 Tagen fällig.",
      "Die erste Mahnung gilt als Erinnerung. Ab der zweiten Mahnung wird eine Mahngebühr von CHF 20.– pro Mahnung erhoben.",
    ],
  },
  {
    titel: "5. Stornierung & Verschiebung",
    punkte: [
      "Lektionen können nur über die Website und bis spätestens 24 Stunden vor Beginn storniert oder verschoben werden.",
      "Bei späterer Absage oder Nichterscheinen wird der volle Preis der Lektion in Rechnung gestellt.",
    ],
  },
  {
    titel: "6. Krankheit, Unfall & Ferien",
    punkte: [
      "Bei längerfristiger, begründeter Krankheit oder Unfall wird das Paket pausiert.",
      "Kurzzeitige Krankheitsabwesenheiten von weniger als zwei Wochen werden nicht berücksichtigt, da der Standard-Rhythmus zwei Wochen beträgt.",
      "Ferien von meiner Seite und von Schülerseite werden ebenfalls berücksichtigt und führen zur Pausierung des Pakets.",
      "Abwesenheiten durch Ferien oder längere Krankheiten müssen frühzeitig mitgeteilt werden.",
    ],
  },
  {
    titel: "7. Unterrichtsort & Material",
    punkte: [
      "Der Unterricht findet aktuell ausschliesslich beim Schüler statt.",
      "Ich stelle keine Unterrichtsmaterialien zur Verfügung, empfehle aber passende Materialien und Quellen nach bestem Wissen.",
      "Ein Anspruch auf Lernmaterialien besteht nicht.",
    ],
  },
  {
    titel: "8. Fehlerhafte Preisangaben",
    absaetze: [
      "Sollte aufgrund eines technischen Fehlers ein falscher Preis auf der Website angezeigt werden, gilt immer der von mir schriftlich oder mündlich bestätigte Preis.",
    ],
  },
  {
    titel: "9. Datenschutz",
    absaetze: [
      "Alle Daten werden vertraulich behandelt und nicht an Dritte weitergegeben. Sie dienen ausschliesslich der Organisation und Durchführung des Unterrichts.",
    ],
  },
  {
    titel: "10. Vertragsdauer",
    absaetze: [
      "Der Vertrag gilt für die Dauer des gebuchten Pakets und darüber hinaus, bis alle Lektionen eingelöst und alle offenen Beträge bezahlt wurden.",
    ],
  },
  {
    titel: "11. Schlussbestimmungen",
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
