"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Loader2,
  Info,
  Check,
  Route,
  AlertTriangle,
  Mail,
} from "lucide-react";
import { formatDauer } from "@/lib/geo";
import { WEEKDAY_LABELS } from "@/lib/fixplatz";
import type { Einpassung } from "@/lib/zuteilung";
import {
  einpassungSuchen,
  einzelnEinpassen,
  wartendeSchueler,
  zeitenAnfragen,
} from "../actions";

type Wartend = {
  id: string;
  name: string;
  hatZeiten: boolean;
  angefragtBis: string | null;
};

function datum(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Einen einzelnen Schüler in den laufenden Plan einpassen.
 *
 * Der Alltagsfall zwischen zwei Planungsrunden: Jemand meldet sich an, und
 * die Frage ist nicht „wie sähe der perfekte Plan aus“, sondern „wo passt er
 * rein, ohne dass ich alle anderen umbuchen muss“.
 */
export default function EinpassenKarte({ puffer }: { puffer: number }) {
  const router = useRouter();
  const [wartend, setWartend] = useState<Wartend[]>([]);
  const [gewaehlt, setGewaehlt] = useState<string>("");
  const [vorschlaege, setVorschlaege] = useState<Einpassung[] | null>(null);
  const [name, setName] = useState<string>("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let abgebrochen = false;
    wartendeSchueler().then((r) => {
      if (!abgebrochen) setWartend(r.schueler);
    });
    return () => {
      abgebrochen = true;
    };
  }, []);

  function suchen(studentId: string) {
    setGewaehlt(studentId);
    setVorschlaege(null);
    setFehler(null);
    setMeldung(null);
    if (!studentId) return;

    startTransition(async () => {
      const res = await einpassungSuchen(studentId, puffer);
      if ("error" in res) {
        setFehler(res.error);
        return;
      }
      setName(res.schuelerName);
      if (!res.hatZeiten) {
        setVorschlaege([]);
        return;
      }
      setVorschlaege(res.vorschlaege);
    });
  }

  function anfragen() {
    if (!gewaehlt) return;
    setFehler(null);
    setMeldung(null);
    startTransition(async () => {
      const res = await zeitenAnfragen(gewaehlt);
      if (res.error) {
        setFehler(res.error);
        return;
      }
      if (!("frist" in res)) return;
      setMeldung(
        `${name} wurde angeschrieben. Er kann seine Zeiten bis ${datum(res.frist)} im Portal eintragen — danach erscheint er hier mit Vorschlägen.`
      );
      wartendeSchueler().then((r) => setWartend(r.schueler));
    });
  }

  const aktuell = wartend.find((w) => w.id === gewaehlt) ?? null;
  const brauchtZeiten = aktuell != null && !aktuell.hatZeiten;

  function setzen(v: Einpassung) {
    if (
      !confirm(
        `${name} auf ${WEEKDAY_LABELS[v.wochentag]} ${v.beginn} setzen? Die Terminserie wird gebucht.`
      )
    )
      return;
    setFehler(null);
    startTransition(async () => {
      const res = await einzelnEinpassen({
        studentId: gewaehlt,
        wochentag: v.wochentag,
        beginn: v.beginn,
        paritaet: v.paritaet,
      });
      if (res.error) {
        setFehler(res.error);
        return;
      }
      if (!("termine" in res)) return;
      setMeldung(`${name} eingeplant — ${res.termine} Termine gebucht.`);
      setVorschlaege(null);
      setGewaehlt("");
      wartendeSchueler().then((r) => setWartend(r.schueler));
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-[#1C244B]" />
        <p className="font-600 text-[#1C244B]">Einzelnen Schüler einpassen</p>
      </div>

      <div className="rounded-xl bg-[#F3F5F8] p-3.5 flex gap-2.5">
        <Info className="w-4 h-4 text-[#1C244B] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600 leading-snug space-y-1.5">
          <p>
            Für den Fall zwischen zwei Runden: Der bestehende Stundenplan bleibt
            wie er ist, gesucht wird nur, wo der Neue am wenigsten zusätzliche
            Fahrzeit kostet.
          </p>
          <p className="text-gray-500">
            Der beste Fall ist ein Platz <strong>auf dem Weg</strong> — zwischen
            zwei Terminen, an denen du ohnehin vorbeifährst.
          </p>
        </div>
      </div>

      {wartend.length === 0 ? (
        <p className="text-sm text-gray-500">
          Im Moment wartet niemand auf einen Termin.
        </p>
      ) : (
        <div className="space-y-1.5">
          <label className="text-xs font-500 text-gray-600">Schüler</label>
          <select
            value={gewaehlt}
            onChange={(e) => suchen(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3.5 min-h-[44px] text-sm focus:outline-none focus:border-[#1C244B]"
          >
            <option value="">Bitte wählen…</option>
            {wartend.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.hatZeiten
                  ? ""
                  : w.angefragtBis
                    ? " (angefragt, noch keine Antwort)"
                    : " (keine Zeiten angegeben)"}
              </option>
            ))}
          </select>
        </div>
      )}

      {brauchtZeiten && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-2.5">
          <div className="flex gap-2.5">
            <Mail className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 leading-snug min-w-0">
              <p className="font-600">
                {aktuell.name} hat noch keine Zeiten angegeben.
              </p>
              <p className="mt-1">
                {aktuell.angefragtBis ? (
                  <>
                    Angefragt, Frist {datum(aktuell.angefragtBis)} — es fehlt
                    noch die Antwort. Nochmals anschreiben erinnert ihn, ohne
                    eine zweite Anfrage anzulegen.
                  </>
                ) : (
                  <>
                    Ohne Zeiten lässt sich kein Platz finden. Die Anfrage geht
                    nur an ihn — eine laufende Runde für alle bleibt davon
                    unberührt.
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={anfragen}
            disabled={isPending}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-600 bg-white border border-amber-300 rounded-xl px-4 min-h-[40px] active:bg-amber-100 disabled:opacity-40"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <Mail className="w-3.5 h-3.5" />
            {aktuell.angefragtBis ? "Nochmals anschreiben" : "Zeiten anfragen"}
          </button>
        </div>
      )}

      {isPending && !vorschlaege && (
        <div className="py-4 text-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
        </div>
      )}

      {fehler && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {fehler}
        </p>
      )}
      {meldung && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
          {meldung}
        </p>
      )}

      {vorschlaege && vorschlaege.length === 0 && !fehler && !brauchtZeiten && (
        <p className="text-sm text-gray-600">
          Kein Platz gefunden, der zu den angegebenen Zeiten passt. Entweder ist
          alles belegt, oder es braucht ein zusätzliches Zeitfenster.
        </p>
      )}

      {vorschlaege && vorschlaege.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-600 text-gray-500 uppercase tracking-wide">
            Beste Plätze für {name}
          </p>
          {vorschlaege.map((v, i) => (
            <div
              key={`${v.wochentag}-${v.beginn}-${v.paritaet}`}
              className={`rounded-xl border p-3.5 ${
                v.aufDemWeg
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-600 text-gray-900">
                    {WEEKDAY_LABELS[v.wochentag]} {v.beginn}
                    {v.paritaet !== null && (
                      <span className="font-400 text-gray-500">
                        {" "}
                        · {v.paritaet === 0 ? "gerade" : "ungerade"} Wochen
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {v.davor ?? "Start zuhause"} → <strong>hier</strong> →{" "}
                    {v.danach ?? "Heimweg"}
                  </p>
                  <p
                    className={`text-xs mt-1 font-600 ${
                      v.aufDemWeg ? "text-emerald-700" : "text-gray-600"
                    }`}
                  >
                    {v.aufDemWeg && "✓ liegt auf dem Weg · "}
                    kostet {formatDauer(v.zusatzSekunden)} mehr Fahrzeit
                    {v.praeferenz >= 3 && " · Wunschzeit"}
                  </p>
                </div>
                <button
                  onClick={() => setzen(v)}
                  disabled={isPending}
                  className="text-xs font-600 px-3 min-h-[36px] rounded-lg border border-gray-200 bg-white active:bg-gray-50 disabled:opacity-40 whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5"
                >
                  {isPending && i === 0 && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  <Check className="w-3 h-3" />
                  Setzen
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400 leading-snug pt-1">
            <Route className="w-3 h-3 inline mr-1" />
            Die Zusatzzeit ist die Mehrfahrt an diesem Abend — inklusive Umweg
            und veränderter Reihenfolge.
          </p>
        </div>
      )}
    </div>
  );
}
