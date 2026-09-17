"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { KATEGORIEN, KATEGORIE_LABELS, type MailKategorie } from "@/lib/mail-kategorien";
import {
  hauptKategorienSetzen,
  mailadresseEntfernen,
  mailadresseHinzufuegen,
  mailadresseKategorienSetzen,
} from "../mail-actions";

/**
 * Wer bekommt welche Post.
 *
 * Eine Zeile je Adresse, vier Häkchen je Zeile. Die Hauptadresse steht
 * zuoberst und lässt sich hier nicht umschreiben, nur ihre Häkchen: Sie
 * gehört dem Login-Konto. Login-Mails gehen immer dorthin, unabhängig von
 * den Häkchen.
 *
 * Häkchen speichern sofort. Ein Formular mit „Speichern" für vier Kreuzchen
 * wäre mehr Klicks als die Sache wert ist.
 */
type Zeile = {
  id: string | null;
  email: string;
  bezeichnung: string | null;
  kategorien: readonly string[];
};

export default function Mailadressen({
  studentId,
  haupt,
  weitere,
}: {
  studentId: string;
  haupt: { email: string; kategorien: readonly string[] } | null;
  weitere: { id: string; email: string; bezeichnung: string | null; kategorien: readonly string[] }[];
}) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const [neu, setNeu] = useState(false);
  const [neuEmail, setNeuEmail] = useState("");
  const [neuBez, setNeuBez] = useState("");
  const [neuKat, setNeuKat] = useState<MailKategorie[]>([]);

  const zeilen: Zeile[] = [
    ...(haupt ? [{ id: null, email: haupt.email, bezeichnung: "Hauptadresse, Login", kategorien: haupt.kategorien }] : []),
    ...weitere,
  ];

  // Welche Kategorie hat niemanden? Dann springt die Hauptadresse ein, und
  // das soll man sehen, statt es aus den Häkchen herauszulesen.
  const ohneEmpfaenger = KATEGORIEN.filter(
    (k) => !zeilen.some((z) => z.kategorien.includes(k))
  );

  function umschalten(z: Zeile, k: MailKategorie) {
    const naechste = z.kategorien.includes(k)
      ? z.kategorien.filter((x) => x !== k)
      : [...z.kategorien, k];
    setFehler(null);
    starte(async () => {
      const r =
        z.id === null
          ? await hauptKategorienSetzen(studentId, naechste)
          : await mailadresseKategorienSetzen(z.id, naechste);
      if ("error" in r && r.error) setFehler(r.error);
      else router.refresh();
    });
  }

  function entfernen(z: Zeile) {
    if (!z.id) return;
    if (!window.confirm(`${z.email} entfernen? Post dieser Kategorien geht dann an die übrigen Adressen.`)) return;
    setFehler(null);
    starte(async () => {
      const r = await mailadresseEntfernen(z.id!);
      if ("error" in r && r.error) setFehler(r.error);
      else router.refresh();
    });
  }

  function hinzufuegen() {
    setFehler(null);
    starte(async () => {
      const r = await mailadresseHinzufuegen(studentId, neuEmail, neuBez, neuKat);
      if ("error" in r && r.error) {
        setFehler(r.error);
        return;
      }
      setNeu(false);
      setNeuEmail("");
      setNeuBez("");
      setNeuKat([]);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <h2 className="text-lg font-700 text-[#1C244B] flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Wer bekommt welche Post
          </h2>
          <p className="text-sm text-gray-500 mt-1 leading-snug">
            Zum Beispiel die Rechnungen an den Vater, die Terminerinnerungen an die Mutter.
            Passwort und Zugang gehen immer an die Hauptadresse.
          </p>
        </div>
        {!neu && (
          <button
            onClick={() => setNeu(true)}
            className="press inline-flex items-center gap-1.5 text-sm font-600 px-3 py-2 rounded-xl border border-gray-200 text-[#1C244B] hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            Adresse
          </button>
        )}
      </div>

      <div className="mt-4 overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-[11px] font-600 uppercase tracking-wide text-gray-400">
              <th className="text-left font-600 pb-2 pr-3">Adresse</th>
              {KATEGORIEN.map((k) => (
                <th key={k} className="pb-2 px-2 text-center font-600" title={KATEGORIE_LABELS[k].hinweis}>
                  {KATEGORIE_LABELS[k].titel}
                </th>
              ))}
              <th className="pb-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {zeilen.map((z) => (
              <tr key={z.id ?? "haupt"}>
                <td className="py-2.5 pr-3">
                  <p className="text-gray-900 break-all">{z.email}</p>
                  {z.bezeichnung && <p className="text-xs text-gray-400">{z.bezeichnung}</p>}
                </td>
                {KATEGORIEN.map((k) => (
                  <td key={k} className="py-2.5 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={z.kategorien.includes(k)}
                      disabled={laeuft}
                      onChange={() => umschalten(z, k)}
                      className="w-4 h-4 accent-[#1C244B] cursor-pointer disabled:opacity-40"
                      aria-label={`${KATEGORIE_LABELS[k].titel} an ${z.email}`}
                    />
                  </td>
                ))}
                <td className="py-2.5 text-right">
                  {z.id && (
                    <button
                      onClick={() => entfernen(z)}
                      disabled={laeuft}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                      title="Adresse entfernen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {neu && (
        <div className="mt-4 rounded-xl bg-[#F3F5F8] p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              type="email"
              value={neuEmail}
              onChange={(e) => setNeuEmail(e.target.value)}
              placeholder="mail@beispiel.ch"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              autoFocus
            />
            <input
              type="text"
              value={neuBez}
              onChange={(e) => setNeuBez(e.target.value)}
              placeholder="Für wen, z. B. Roland (Vater)"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {KATEGORIEN.map((k) => (
              <label key={k} className="inline-flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={neuKat.includes(k)}
                  onChange={() =>
                    setNeuKat((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))
                  }
                  className="w-4 h-4 accent-[#1C244B]"
                />
                {KATEGORIE_LABELS[k].titel}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={hinzufuegen}
              disabled={laeuft || !neuEmail}
              className="press inline-flex items-center gap-2 text-sm font-600 px-4 py-2 rounded-xl bg-[#1C244B] text-white hover:bg-[#2A3563] disabled:opacity-40"
            >
              {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Hinzufügen
            </button>
            <button
              onClick={() => {
                setNeu(false);
                setFehler(null);
              }}
              className="text-sm font-600 px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-100"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {ohneEmpfaenger.length > 0 && haupt && (
        <p className="mt-3 text-xs text-gray-400 leading-snug">
          Ohne Häkchen: {ohneEmpfaenger.map((k) => KATEGORIE_LABELS[k].titel).join(", ")}.
          Diese Post geht an die Hauptadresse.
        </p>
      )}
      {fehler && <p className="mt-3 text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
