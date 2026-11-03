"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Plus, Trash2, X } from "lucide-react";
import { semesterAnlegen, semesterLoeschen } from "../actions";

export type Semesterzeile = {
  id: string;
  bezeichnung: string;
  beginn: string;
  ende: string;
  vergangen: boolean;
};

function tag(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Semester von Davids Studium. Ein Abo endet am Ende des Semesters, in dem
 * es beginnt, ein Jahresabo ist bis zum Ende des nächsten gebunden. Fehlt
 * das nächste Semester, kann ein Jahresabo nicht richtig gebunden werden,
 * darum der Hinweis unten.
 */
export default function SemesterVerwaltung({ semester }: { semester: Semesterzeile[] }) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, starte] = useTransition();

  const kommend = semester.filter((s) => !s.vergangen);

  return (
    <div className="bg-white rounded-2xl border border-[#EAECEF] p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-700 text-[#1C244B] flex items-center gap-2">
          <GraduationCap className="w-5 h-5" /> Semester
        </h2>
        {!offen && (
          <button
            onClick={() => setOffen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <Plus className="w-3.5 h-3.5" /> Semester anlegen
          </button>
        )}
      </div>

      {kommend.length < 2 && (
        <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
          Leg immer auch das nächste Semester an. Ohne es lässt sich ein
          Jahresabo nicht bis zum Ende des zweiten Semesters binden.
        </p>
      )}

      {offen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFehler(null);
            const daten = new FormData(e.currentTarget);
            const form = e.currentTarget;
            starte(async () => {
              const r = await semesterAnlegen(daten);
              if (r.error) {
                setFehler(r.error);
                return;
              }
              form.reset();
              setOffen(false);
              router.refresh();
            });
          }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end"
        >
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-gray-600">Bezeichnung</span>
            <input name="bezeichnung" placeholder="HS27 / WZ28" className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" required />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-600">Beginn</span>
            <input type="date" name="beginn" className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" required />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-600">Ende</span>
            <input type="date" name="ende" className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" required />
          </label>
          <div className="sm:col-span-4 flex gap-2">
            <button disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg bg-[#1C244B] text-white disabled:opacity-40">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Speichern
            </button>
            <button type="button" onClick={() => setOffen(false)} className="inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100">
              <X className="w-3.5 h-3.5" /> Abbrechen
            </button>
          </div>
        </form>
      )}

      {fehler && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{fehler}</p>}

      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
        {semester.map((s) => (
          <li key={s.id} className={`flex items-center gap-3 px-3.5 py-2.5 ${s.vergangen ? "opacity-50" : ""}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-600 text-gray-900">{s.bezeichnung}</p>
              <p className="text-xs text-gray-500 tabular-nums">
                {tag(s.beginn)} bis {tag(s.ende)}
              </p>
            </div>
            <button
              onClick={() => {
                if (!confirm(`Semester „${s.bezeichnung}" löschen?`)) return;
                starte(async () => {
                  const r = await semesterLoeschen(s.id);
                  if (r.error) setFehler(r.error);
                  router.refresh();
                });
              }}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
              title="Löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
        {semester.length === 0 && (
          <li className="px-3.5 py-3 text-sm text-gray-500">Noch kein Semester angelegt.</li>
        )}
      </ul>
    </div>
  );
}
