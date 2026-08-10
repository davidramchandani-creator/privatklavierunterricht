"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2, Plus, Trash2, Info, X } from "lucide-react";
import { ferienAnlegen, ferienLoeschen } from "../actions";

export type Ferienzeile = {
  id: string;
  bezeichnung: string;
  start: string;
  ende: string;
  tage: number;
  vergangen: boolean;
};

function tag(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function FerienVerwaltung({ zeilen }: { zeilen: Ferienzeile[] }) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function anlegen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFehler(null);
    const daten = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startTransition(async () => {
      const res = await ferienAnlegen(daten);
      if (res.error) {
        setFehler(res.error);
        return;
      }
      form.reset();
      setOffen(false);
      router.refresh();
    });
  }

  function loeschen(id: string, bezeichnung: string) {
    if (!confirm(`„${bezeichnung}" löschen?`)) return;
    setFehler(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await ferienLoeschen(id);
      if (res.error) setFehler(res.error);
      router.refresh();
      setBusyId(null);
    });
  }

  const kommend = zeilen.filter((z) => !z.vergangen);
  const vergangen = zeilen.filter((z) => z.vergangen);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-[#F3F5F8] border border-[#E3E7EE] p-4 flex gap-3">
        <Info className="w-4 h-4 text-[#1C244B] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600 leading-snug space-y-1.5">
          <p>
            In diesen Zeiträumen findet kein Unterricht statt. Sie sind die
            Grundlage dafür, wie viele Lektionen ein Abo enthält.
          </p>
          <p>
            Ein Schüler mit Halbjahresabo ab Oktober bekommt{" "}
            <strong>20 Lektionen</strong> — nicht 26, weil sechs Termine auf
            Herbst-, Weihnachts- und Sportferien fallen. Das wird ihm beim Kauf
            genau so angezeigt.
          </p>
          <p className="text-gray-500">
            Änderungen wirken nur auf <strong>neue</strong> Abos. Bereits
            verkaufte behalten ihre zugesicherte Lektionszahl.
          </p>
        </div>
      </div>

      {fehler && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>
      )}

      {!offen ? (
        <button
          onClick={() => setOffen(true)}
          className="inline-flex items-center gap-2 text-sm font-600 text-[#1C244B] px-4 min-h-[44px] rounded-xl border border-[#1C244B]/20 hover:bg-[#1C244B]/5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Zeitraum hinzufügen
        </button>
      ) : (
        <form
          onSubmit={anlegen}
          className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="font-600 text-[#1C244B]">Neuer Zeitraum</p>
            <button
              type="button"
              onClick={() => setOffen(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              aria-label="Schliessen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">Bezeichnung</label>
            <input
              name="bezeichnung"
              placeholder="z. B. Sportferien 2028"
              required
              className="w-full rounded-lg border border-gray-200 px-3.5 min-h-[44px] text-sm focus:outline-none focus:border-[#1C244B]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-500 text-gray-600">Erster Tag</label>
              <input
                name="start_datum"
                type="date"
                required
                className="w-full rounded-lg border border-gray-200 px-3.5 min-h-[44px] text-sm focus:outline-none focus:border-[#1C244B]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-500 text-gray-600">Letzter Tag</label>
              <input
                name="end_datum"
                type="date"
                required
                className="w-full rounded-lg border border-gray-200 px-3.5 min-h-[44px] text-sm focus:outline-none focus:border-[#1C244B]"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Beide Tage zählen mit. Für zwei Ferienwochen also Montag bis Freitag
            der zweiten Woche.
          </p>

          <button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl px-5 min-h-[44px] hover:bg-[#151c3d] disabled:opacity-40 transition-colors"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Speichern
          </button>
        </form>
      )}

      <Liste
        titel="Kommend"
        zeilen={kommend}
        busyId={busyId}
        onLoeschen={loeschen}
        leerText="Keine kommenden Ferien hinterlegt. Ohne sie werden Abos mit zu vielen Lektionen berechnet."
      />

      {vergangen.length > 0 && (
        <Liste
          titel="Vergangen"
          zeilen={vergangen}
          busyId={busyId}
          onLoeschen={loeschen}
          gedimmt
        />
      )}
    </div>
  );
}

function Liste({
  titel,
  zeilen,
  busyId,
  onLoeschen,
  leerText,
  gedimmt,
}: {
  titel: string;
  zeilen: Ferienzeile[];
  busyId: string | null;
  onLoeschen: (id: string, bezeichnung: string) => void;
  leerText?: string;
  gedimmt?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-600 text-gray-500 uppercase tracking-wide mb-2">
        {titel}
      </p>
      <div className="bg-white rounded-2xl border border-[#EAECEF] divide-y divide-[#F1F3F6]">
        {zeilen.length === 0 && (
          <p className="p-5 text-sm text-gray-500 text-center">{leerText}</p>
        )}
        {zeilen.map((z) => (
          <div
            key={z.id}
            className={`p-3.5 sm:p-4 flex items-center gap-3 ${
              gedimmt ? "opacity-50" : ""
            }`}
          >
            <CalendarOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-600 text-gray-900 truncate">
                {z.bezeichnung}
              </p>
              <p className="text-xs text-gray-500">
                {tag(z.start)} – {tag(z.ende)} · {z.tage} Tage
              </p>
            </div>
            <button
              onClick={() => onLoeschen(z.id, z.bezeichnung)}
              disabled={busyId === z.id}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors flex-shrink-0"
              aria-label={`${z.bezeichnung} löschen`}
            >
              {busyId === z.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
