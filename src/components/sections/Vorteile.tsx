import { BookOpen, User, Zap, Music } from "lucide-react";

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
    icon: Zap,
    titel: "Flexibel & unkompliziert",
    text: "Einzellektion oder Unterrichtspaket? Du buchst, wie es für dich passt.",
  },
  {
    icon: Music,
    titel: "Moderne Songs & Praxisbezug",
    text: "Lerne, was du wirklich brauchst – mit Songs, die du auch spielen willst.",
  },
];

export default function Vorteile() {
  return (
    <section className="py-24 bg-indigo-50/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-[#C9A84C] font-600 text-sm uppercase tracking-widest mb-3">
            Warum David
          </p>
          <h2 className="text-3xl sm:text-4xl font-800 text-gray-900 mb-4">
            Darum bist du bei mir richtig
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Mein Unterricht ist kein Einheitsbrei – er ist so individuell wie du.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {vorteile.map((v, i) => (
            <div
              key={v.titel}
              className="group bg-white rounded-2xl p-6 border border-indigo-100 hover:border-[#3730A3]/30 hover:shadow-lg hover:shadow-indigo-100 transition-all duration-300 hover:-translate-y-1 opacity-0 animate-fade-in"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center mb-4 group-hover:bg-[#3730A3] transition-colors duration-300">
                <v.icon className="w-5 h-5 text-[#3730A3] group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="font-700 text-gray-900 mb-2">{v.titel}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{v.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
