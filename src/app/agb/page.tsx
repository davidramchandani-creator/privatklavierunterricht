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
      "Die enthaltenen Lektionen müssen innerhalb der Gültigkeitsdauer eingelöst werden: 4 Monate beim 10er-Paket, 8 Monate beim 20er-Paket, jeweils ab Buchungsdatum.",
      "Nicht genutzte Lektionen innerhalb dieser Frist verfallen und werden zu 100 % verrechnet.",
      "Ein Paket kann bis zur 3. genommenen Lektion storniert werden. In diesem Fall werden die bereits genommenen Lektionen zum Einzellektionspreis verrechnet. Ab der 4. Lektion ist eine Stornierung des Pakets nicht mehr möglich.",
      "Auch bei Abbruch oder Unzufriedenheit nach der 3. Lektion bleibt der gesamte Paketbetrag geschuldet.",
      "Der Vertrag bleibt über die Paketlaufzeit hinaus bestehen, bis alle offenen Lektionen eingelöst und alle Zahlungen beglichen sind.",
    ],
  },
  {
    titel: "4. Zahlung: Einmalzahlung oder Raten",
    punkte: [
      "Beim Buchen eines Pakets wählst du zwischen Einmalzahlung und Monatsraten. Bezahlt wird in beiden Fällen per TWINT oder QR-Rechnung (IBAN-Überweisung).",
      "Bei Einmalzahlung wird der gesamte Paketbetrag sofort in Rechnung gestellt und ist innert 15 Tagen fällig.",
      "Bei Ratenzahlung wird zuerst eine Anzahlung von 25 % des Paketpreises fällig. Der Restbetrag wird in gleich hohen Monatsraten verteilt: vier Raten beim 10er-Paket, acht Raten beim 20er-Paket. Die letzte Rate kann geringfügig abweichen, damit die Summe exakt dem Paketpreis entspricht.",
      "Jede Rate wird am jeweiligen Monatsstichtag in Rechnung gestellt und ist innert 10 Tagen fällig. Den vollständigen Zahlungsplan siehst du vor dem Kauf und jederzeit im Portal.",
      "Das Paket ist in beiden Fällen ab Buchung sofort und vollständig nutzbar – du musst weder auf den Zahlungseingang warten noch alle Raten bezahlt haben, um Lektionen zu buchen.",
      "Der gesamte Paketbetrag ist mit der Buchung geschuldet. Die Ratenzahlung ist eine Zahlungserleichterung und keine Kündigungsmöglichkeit: Bleiben Raten offen, werden sie unabhängig davon fällig, ob die Lektionen bezogen wurden.",
      "Einzellektionen werden nach der Lektion in Rechnung gestellt und sind innert 15 Tagen fällig.",
      "Die erste Mahnung gilt als Erinnerung. Ab der zweiten Mahnung wird eine Mahngebühr von CHF 20.– pro Mahnung erhoben.",
      "Bei mehr als zwei offenen, überfälligen Raten kann ich weitere Buchungen aussetzen, bis der Rückstand ausgeglichen ist.",
    ],
  },
  {
    titel: "5. Automatische Verlängerung & Kündigung",
    punkte: [
      "Die automatische Verlängerung ist freiwillig. Sie gilt nur, wenn du sie beim Kauf ausdrücklich aktivierst – ohne dieses Häkchen läuft dein Paket am Ende der Laufzeit einfach aus.",
      "Ist sie aktiv, verlängert sich das Paket am Ablaufdatum automatisch um eine neue Laufzeit desselben Typs und zum dann gültigen Preis. Die Zahlungsart (einmalig oder Raten) wird übernommen.",
      "Du kannst die Verlängerung jederzeit im Portal abschalten, spätestens jedoch 14 Tage vor Ablauf der laufenden Laufzeit. Danach ist die Verlängerung ausgelöst und die neue Laufzeit verbindlich.",
      "Spätestens 30 Tage vor Ablauf erhältst du eine Erinnerung per E-Mail und Push, damit du rechtzeitig entscheiden kannst.",
      "Eine Kündigung wirkt auf das Ende der laufenden Laufzeit. Bereits begonnene Laufzeiten und offene Raten bleiben geschuldet.",
      "Nicht genutzte Lektionen verfallen auch bei einer Verlängerung – sie werden nicht in die neue Laufzeit übertragen.",
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
