import { Star } from "lucide-react";
import { WEEKDAY_LABELS } from "@/lib/fixplatz";

export type AngegebenesFenster = {
  wochentag: number;
  von: string;
  bis: string;
  /** 1 = zur Not, 2 = gut, 3 = am besten. */
  praeferenz: number;
};

/**
 * Die angegebenen Zeiten eines Schülers als Chips.
 *
 * Dieselbe Sprache wie im Formular, in dem der Schüler sie eingetragen hat:
 * Stern für die Wunschzeit, ausgegraut für „nur zur Not". Wer die Zuteilung
 * beurteilen will, muss sehen, welchen Rang ein Fenster hatte — sonst wirkt
 * jede Zuteilung gleich gut, und man merkt nicht, wenn jemand dauerhaft nur
 * seine Notlösung bekommt.
 *
 * Bewusst als geteilte Komponente: Die Chips stehen an mehreren Stellen, und
 * unterschiedliche Farbcodes für dieselbe Zahl wären schlimmer als gar keine.
 */
export function ZeitfensterListe({
  fenster,
  klein = false,
}: {
  fenster: AngegebenesFenster[];
  klein?: boolean;
}) {
  if (fenster.length === 0) return null;

  // Nach Wochentag, dann nach Uhrzeit: In Eingabereihenfolge stünde Freitag
  // vor Montag, sobald jemand seine Angabe nachträglich ergänzt hat.
  const sortiert = [...fenster].sort(
    (a, b) => a.wochentag - b.wochentag || a.von.localeCompare(b.von)
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      {sortiert.map((f, i) => (
        <span
          key={i}
          title={
            f.praeferenz === 3
              ? "Wunschzeit"
              : f.praeferenz === 1
                ? "nur zur Not"
                : "passt gut"
          }
          className={`inline-flex items-center gap-1 rounded-lg border ${
            klein ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2 py-1"
          } ${
            f.praeferenz === 3
              ? "border-[#1C244B]/30 bg-[#1C244B]/[0.05] text-[#1C244B] font-600"
              : f.praeferenz === 1
                ? "border-gray-200 text-gray-400"
                : "border-gray-200 text-gray-600"
          }`}
        >
          {f.praeferenz === 3 && <Star className="w-3 h-3" />}
          {WEEKDAY_LABELS[f.wochentag]?.slice(0, 2) ?? f.wochentag} {f.von}–
          {f.bis}
          {f.praeferenz === 1 && !klein && " (zur Not)"}
        </span>
      ))}
    </div>
  );
}
