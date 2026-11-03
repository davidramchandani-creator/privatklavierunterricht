import { createAdminClient } from "@/lib/supabase/server";
import { NEUPREISE } from "@/lib/neupreise";
import {
  ALTPREISE,
  MINDEST_ANFRAGEN_FUER_QUOTE,
  PREISSTART,
  baueAuswertung,
} from "@/lib/auswertung";

export const dynamic = "force-dynamic";

const MONATSNAMEN = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

function monatLabel(monat: string): string {
  const [j, m] = monat.split("-").map(Number);
  return `${MONATSNAMEN[m - 1]} ${j}`;
}

function datumLabel(tag: string): string {
  const [j, m, d] = tag.split("-").map(Number);
  return `${d}. ${MONATSNAMEN[m - 1]} ${j}`;
}

/**
 * Wirken die neuen Preise?
 *
 * Für Davids Test der Preise vom 3. November 2026 (100 / 85 / 80 für neue
 * Schüler): wie viele Anfragen kommen, wie viele setzen sich auf die
 * Warteliste, wie viele werden Schüler und zu welchem Preis.
 *
 * Es sind wenige Personen pro Monat. Einzelne Monate sind darum Zufall, und
 * die Seite sagt das auch.
 */
export default async function AuswertungPage() {
  const admin = await createAdminClient();
  const [{ data: anfragen }, { data: warteliste }, { data: schueler }] = await Promise.all([
    admin.from("anfragen").select("erstellt_am, email"),
    admin.from("warteliste").select("erstellt_am, quelle"),
    admin
      .from("profiles")
      .select("erstellt_am, email, price_halbjahr")
      .eq("role", "student")
      .eq("ist_test", false)
      .eq("extern", false),
  ]);

  const a = baueAuswertung(
    {
      anfragen: (anfragen ?? []) as { erstellt_am: string; email: string }[],
      warteliste: (warteliste ?? []) as { erstellt_am: string; quelle: "webseite" | "admin" }[],
      schueler: (schueler ?? []) as {
        erstellt_am: string;
        email: string | null;
        price_halbjahr: number | string | null;
      }[],
    },
    new Date()
  );

  const s = a.seitPreisstart;
  const davor = a.vorPreisstart;
  const heute = new Date().toISOString().slice(0, 10);
  const tageSeit = Math.max(
    0,
    Math.floor((new Date(heute).getTime() - new Date(PREISSTART).getTime()) / 86400000)
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Auswertung</h1>
        <p className="text-sm text-gray-500 mt-1">
          Seit {datumLabel(PREISSTART)} zahlen neue Schüler {NEUPREISE.einzel} / {NEUPREISE.semester} /{" "}
          {NEUPREISE.jahr} CHF pro Lektion (vorher {ALTPREISE.einzel} / {ALTPREISE.semester} /{" "}
          {ALTPREISE.jahr}).
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kachel titel="Anfragen" wert={s.anfragen} unter={`in ${tageSeit} Tagen`} />
        <Kachel titel="Warteliste" wert={s.warteliste} unter="Anmeldungen" />
        <Kachel titel="Neue Schüler" wert={s.neueSchueler} unter={`${s.guenstiger} zu einem günstigeren Preis`} />
        <Kachel
          titel="Aus Anfrage zu Schüler"
          wert={s.quote === null ? "noch offen" : `${Math.round(s.quote * 100)} %`}
          unter={
            s.quote === null
              ? `ab ${MINDEST_ANFRAGEN_FUER_QUOTE} Anfragen`
              : "der Anfragen seit der Umstellung"
          }
        />
      </div>

      {davor.anfragenProMonat !== null && (
        <p className="text-sm text-gray-600 bg-white rounded-2xl border border-gray-200 p-4 leading-relaxed">
          Zum Vergleich: In den {davor.monate} Monaten vor der Umstellung kamen im Schnitt{" "}
          <strong>{davor.anfragenProMonat.toLocaleString("de-CH", { maximumFractionDigits: 1 })}</strong>{" "}
          Anfragen pro Monat.
        </p>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                <th className="px-4 py-3 font-600">Monat</th>
                <th className="px-4 py-3 font-600 text-right">Anfragen</th>
                <th className="px-4 py-3 font-600 text-right">Warteliste</th>
                <th className="px-4 py-3 font-600 text-right">Neue Schüler</th>
                <th className="px-4 py-3 font-600 text-right">davon Listenpreis</th>
                <th className="px-4 py-3 font-600 text-right">davon günstiger</th>
              </tr>
            </thead>
            <tbody>
              {[...a.monate].reverse().map((m) => (
                <tr key={m.monat} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-600 text-[#1C244B]">{monatLabel(m.monat)}</td>
                  <Zahl wert={m.anfragen} />
                  <Zahl wert={m.warteliste} />
                  <Zahl wert={m.neueSchueler} />
                  <Zahl wert={m.zuListenpreis} />
                  <Zahl wert={m.guenstiger} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-gray-500 space-y-2 leading-relaxed">
        <p>
          <strong className="text-gray-700">Wie du die Zahlen liest:</strong> Es sind wenige Personen pro
          Monat. Drei Anfragen mehr oder weniger sind Zufall, kein Trend. Erst über zwei, drei Monate
          zeigt sich, ob die Preise tragen.
        </p>
        <p>
          „Aus Anfrage zu Schüler“ zählt neue Schüler, die sich mit derselben E-Mail-Adresse in den
          letzten 90 Tagen für eine Probelektion gemeldet hatten. Wer sich unter einer anderen Adresse
          anmeldet, wird nicht zugeordnet. „Günstiger“ heisst: Der Semesterpreis im Profil liegt unter dem
          Listenpreis, der am Tag des Anlegens galt.
        </p>
        <p>
          Nicht erfasst: Wer den Preis sieht und gar nicht erst anfragt. Das merkst du nur daran, dass die
          Anfragen sinken.
        </p>
      </div>
    </div>
  );
}

function Kachel({
  titel,
  wert,
  unter,
}: {
  titel: string;
  wert: number | string;
  unter: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <p className="text-xs font-600 text-gray-400 uppercase tracking-wide">{titel}</p>
      <p className="text-2xl font-800 text-[#1C244B] mt-1">{wert}</p>
      <p className="text-xs text-gray-500 mt-1">{unter}</p>
    </div>
  );
}

function Zahl({ wert }: { wert: number }) {
  return (
    <td className={`px-4 py-2.5 text-right tabular-nums ${wert === 0 ? "text-gray-300" : "text-gray-800"}`}>
      {wert}
    </td>
  );
}
