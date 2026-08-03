import { Metadata } from "next";
import { Mail, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Impressum – Privatklavierunterricht David Ramchandani",
  description: "Impressum und Kontaktangaben von David Ramchandani, Klavierunterricht in Neftenbach.",
};

export default function ImpressumPage() {
  return (
    <main>
      <section className="bg-navy-900 pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-white space-y-4">
          <h1 className="text-3xl sm:text-4xl font-800">Impressum</h1>
          <p className="text-white/70">Angaben gemäss schweizerischem Recht</p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="space-y-3">
            <h2 className="text-xl font-800 text-navy-900">Verantwortlich für den Inhalt</h2>
            <div className="bg-surface rounded-2xl p-6 border border-[#EAECEF] space-y-3">
              <p className="font-700 text-navy-900">David Ramchandani</p>
              <p className="text-gray-600 text-sm">Klavierunterricht</p>
              <div className="flex items-start gap-3 text-sm text-gray-600 pt-2">
                <MapPin className="w-4 h-4 mt-0.5 text-navy-600 flex-shrink-0" />
                <span>
                  Sattleracherstrasse 59
                  <br />
                  8413 Neftenbach
                  <br />
                  Schweiz
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-navy-600 flex-shrink-0" />
                <a
                  href="mailto:david.privatklavierunterricht@gmail.com"
                  className="text-navy-900 hover:underline break-all"
                >
                  david.privatklavierunterricht@gmail.com
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-800 text-navy-900">Haftungsausschluss</h2>
            <p className="text-gray-600 leading-relaxed">
              Die Inhalte dieser Website werden mit grösstmöglicher Sorgfalt erstellt.
              Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann
              jedoch keine Gewähr übernommen werden. Sollte aufgrund eines technischen
              Fehlers ein falscher Preis angezeigt werden, gilt immer der schriftlich
              oder mündlich bestätigte Preis.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-800 text-navy-900">Haftung für Links</h2>
            <p className="text-gray-600 leading-relaxed">
              Diese Website enthält Links zu externen Websites Dritter, auf deren
              Inhalte ich keinen Einfluss habe. Für die Inhalte der verlinkten Seiten
              ist stets der jeweilige Anbieter verantwortlich.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-800 text-navy-900">Urheberrecht</h2>
            <p className="text-gray-600 leading-relaxed">
              Die auf dieser Website veröffentlichten Inhalte unterliegen dem
              schweizerischen Urheberrecht. Eine Vervielfältigung oder Verwendung
              ausserhalb der Grenzen des Urheberrechts bedarf der vorherigen
              schriftlichen Zustimmung.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
