import { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/datenschutz" },
  title: "Datenschutzerklärung: Privatklavierunterricht David Ramchandani",
  description:
    "Wie ich mit deinen Daten umgehe: Erhebung, Verwendung, Speicherung und deine Rechte.",
};

const abschnitte = [
  {
    titel: "Verantwortliche Stelle",
    text: "Verantwortlich für die Datenbearbeitung auf dieser Website ist David Ramchandani, Sattleracherstrasse 59, 8413 Neftenbach, Schweiz. Bei Fragen zum Datenschutz erreichst du mich unter david.privatklavierunterricht@gmail.com.",
  },
  {
    titel: "Welche Daten ich erhebe",
    text: "Bei einer Anfrage für eine Probelektion erhebe ich Vorname, Nachname, E-Mail-Adresse, optional Telefonnummer sowie deine Nachricht und einen allfälligen Wunschtermin. Als Schülerin oder Schüler kommen Adresse, gebuchte Lektionen, Pakete und Zahlungsstatus dazu. All das ist für die Organisation des Unterrichts nötig.",
  },
  {
    titel: "Zweck der Bearbeitung",
    text: "Die Daten dienen ausschliesslich der Organisation und Durchführung des Unterrichts: Terminplanung, Kommunikation, Rechnungsstellung und Verwaltung deines Pakets. Es findet keine Weitergabe an Dritte zu Werbezwecken statt.",
  },
  {
    titel: "Auftragsverarbeiter",
    text: "Für den Betrieb der Website und des Schülerportals nutze ich Dienstleister, die Daten in meinem Auftrag bearbeiten: Vercel (Hosting), Supabase (Datenbank und Login), Resend (E-Mail-Versand) sowie Google Calendar für die Terminsynchronisation. Diese Anbieter verarbeiten die Daten ausschliesslich zur Erbringung ihrer Leistung.",
  },
  {
    titel: "Speicherdauer",
    text: "Deine Daten werden so lange aufbewahrt, wie das Unterrichtsverhältnis besteht und gesetzliche Aufbewahrungsfristen es verlangen. Danach werden sie gelöscht.",
  },
  {
    titel: "Cookies & Statistik",
    text: "Diese Website setzt technisch notwendige Cookies für den Login ein. Zusätzlich nutze ich Vercel Analytics und Speed Insights, um die Website zu verbessern. Dabei werden keine personenbezogenen Profile gebildet.",
  },
  {
    titel: "Deine Rechte",
    text: "Du hast jederzeit das Recht auf Auskunft über deine gespeicherten Daten sowie auf Berichtigung, Löschung oder Einschränkung der Bearbeitung. Eine kurze Nachricht per E-Mail genügt.",
  },
  {
    titel: "Sicherheit",
    text: "Die Übertragung erfolgt verschlüsselt via HTTPS. Der Zugriff auf das Schülerportal ist passwortgeschützt; Zahlungsdaten wie Kreditkartennummern werden nicht erhoben.",
  },
];

export default function DatenschutzPage() {
  return (
    <main>
      <section className="bg-navy-900 pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-white space-y-4">
          <h1 className="text-3xl sm:text-4xl font-800">Datenschutzerklärung</h1>
          <p className="text-white/70">
            Alle Daten werden vertraulich behandelt und nicht an Dritte weitergegeben.
          </p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          {abschnitte.map(({ titel, text }) => (
            <div key={titel} className="space-y-3">
              <h2 className="text-xl font-800 text-navy-900">{titel}</h2>
              <p className="text-gray-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
