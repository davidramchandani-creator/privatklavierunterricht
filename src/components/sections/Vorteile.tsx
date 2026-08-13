import { BookOpen, User, CalendarCheck, Music } from "lucide-react";
import AbschnittsKopf from "@/components/AbschnittsKopf";

const vorteile = [
  {
    icon: BookOpen,
    titel: "Unterricht ohne Noten",
    text: "Du lernst intuitiv mit Akkorden und Melodien – ohne Theorieballast.",
  },
  {
    icon: User,
    titel: "Individueller Unterricht",
    text: "Jede Lektion wird auf deine Wünsche und dein Spielniveau abgestimmt.",
  },
  {
    // Stand hier vorher als „Einzellektion oder Unterrichtspaket? Du buchst,
    // wie es für dich passt." — das stimmt seit dem Abo-Modell nicht mehr:
    // Der Schüler wählt kein Paket, er bekommt einen festen Platz aus der
    // Zuteilung. Ein Versprechen, das die Seite nicht hält, fällt spätestens
    // beim Abschluss auf.
    icon: CalendarCheck,
    titel: "Ein fester Platz",
    text: "Dein Termin steht für die ganze Periode – kein wöchentliches Suchen nach einem Slot.",
  },
  {
    icon: Music,
    titel: "Moderne Songs & Praxisbezug",
    text: "Lerne, was du wirklich brauchst – mit Songs, die du auch spielen willst.",
  },
];

export default function Vorteile() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AbschnittsKopf
          kicker="Warum David"
          titel="Darum bist du bei mir richtig"
          text="Mein Unterricht ist kein Einheitsbrei – er ist so individuell wie du."
          className="mb-12"
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {vorteile.map((v) => (
            <div
              key={v.titel}
              className="group bg-white rounded-2xl p-6 border border-[#EAECEF] hover:border-navy-900/20 hover:shadow-lg hover:shadow-navy-100/60 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-11 h-11 rounded-xl bg-navy-50 flex items-center justify-center mb-4 group-hover:bg-navy-900 transition-colors duration-300">
                <v.icon className="w-5 h-5 text-navy-900 group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="font-700 text-navy-900 mb-2">{v.titel}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{v.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
