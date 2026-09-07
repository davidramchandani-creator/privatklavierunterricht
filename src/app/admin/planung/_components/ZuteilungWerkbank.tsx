"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Trash2, X, Lock, Clock, Send, Mail } from "lucide-react";
import { WEEKDAY_LABELS } from "@/lib/fixplatz";
import type { FreigabeArt, ZuteilungEintrag } from "@/lib/zuteilung-uebernahme";
import {
  bestaetigungErneutSenden,
  schuelerFreigeben,
  zuteilungEintragAendern,
  zuteilungEintragEntfernen,
} from "../actions";

/**
 * Die Werkbank: Was der Routenplaner vorgeschlagen hat, hier von Hand
 * nachjustiert und pro Schüler freigegeben.
 *
 * Kein Knopf hier tut etwas für mehrere Leute auf einmal. Eine Freigabe
 * heisst Abo, Termine und eine Vertragsmail für genau diese Person, und
 * David will jede einzeln sehen, bevor sie geht. Der frühere Ein-Knopf-
 * Ablauf („Zuteilung anwenden") hat alle gleichzeitig verschickt, auch die,
 * bei denen noch etwas offen war.
 */

const ART_TEXT: Record<FreigabeArt, { kurz: string; lang: string; ton: string }> = {
  umstellung: {
    kurz: "Abo + Vertrag",
    lang: "Legt das gewählte Abo an, bucht alle Termine, schickt die Bestätigung mit PDF.",
    ton: "bg-navy-50 text-navy-900",
  },
  abo: {
    kurz: "Fixplatz + Mail",
    lang: "Setzt den festen Termin im laufenden Abo, bucht die Serie, schickt die Bestätigung.",
    ton: "bg-navy-50 text-navy-900",
  },
  extern: {
    kurz: "Nur Kalender",
    lang: "Trägt die Termine in die Vereinbarung ein. Externe bekommen keine Mail.",
    ton: "bg-gray-100 text-gray-600",
  },
  ohne_abo: {
    kurz: "Nur reservieren",
    lang: "Kein Abo vorhanden. Der Platz wird geblockt, es geht nichts raus. Sobald das Abo da ist, nochmal freigeben.",
    ton: "bg-amber-50 text-amber-700",
  },
};

const STATUS_TEXT: Record<ZuteilungEintrag["status"], { label: string; ton: string }> = {
  offen: { label: "Vorschlag", ton: "bg-gray-100 text-gray-600" },
  reserviert: { label: "Reserviert", ton: "bg-amber-50 text-amber-700" },
  freigegeben: { label: "Freigegeben", ton: "bg-emerald-50 text-emerald-700" },
};

function paritaetText(p: 0 | 1 | null): string {
  if (p === null) return "jede Woche";
  return p === 0 ? "gerade Wochen" : "ungerade Wochen";
}

/** Viertelstunden zwischen zwei Uhrzeiten, für das Auswahlfeld. */
function raster(von: string, bis: string): string[] {
  const m = (t: string) => {
    const [h, mi] = t.split(":").map(Number);
    return h * 60 + mi;
  };
  const raus: string[] = [];
  for (let t = m(von); t + 45 <= m(bis); t += 15) {
    raus.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return raus;
}

export default function ZuteilungWerkbank({
  eintraege,
  arten,
  fenster,
}: {
  eintraege: ZuteilungEintrag[];
  arten: Record<string, FreigabeArt>;
  fenster: { wochentag: number; beginn: string; ende: string }[];
}) {
  const [bearbeite, setBearbeite] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [laeuft, starte] = useTransition();
  const [aktiv, setAktiv] = useState<string | null>(null);

  const tage = [...new Set(fenster.map((f) => f.wochentag))].sort();

  const nachTag = new Map<number, ZuteilungEintrag[]>();
  for (const z of eintraege) {
    const liste = nachTag.get(z.wochentag) ?? [];
    liste.push(z);
    nachTag.set(z.wochentag, liste);
  }
  for (const liste of nachTag.values()) {
    liste.sort((a, b) => a.beginn.localeCompare(b.beginn) || (a.paritaet ?? -1) - (b.paritaet ?? -1));
  }

  const offen = eintraege.filter((z) => z.status === "offen").length;
  const reserviert = eintraege.filter((z) => z.status === "reserviert").length;
  const frei = eintraege.filter((z) => z.status === "freigegeben").length;

  function freigeben(z: ZuteilungEintrag) {
    const art = arten[z.schuelerId];
    const frage =
      art === "ohne_abo"
        ? `${z.name} hat kein Abo. Platz nur reservieren, nichts verschicken?`
        : art === "extern"
          ? `${z.name}: Termine in die Vereinbarung eintragen? Es geht keine Mail raus.`
          : `${z.name} freigeben? Das legt Abo und Termine an und schickt die Bestätigung. Das lässt sich nicht rückgängig machen.`;
    if (!window.confirm(frage)) return;

    setMeldung(null);
    setAktiv(z.schuelerId);
    starte(async () => {
      const r = await schuelerFreigeben(z.schuelerId);
      setAktiv(null);
      if ("error" in r && r.error) {
        setMeldung({ text: `${z.name}: ${r.error}`, fehler: true });
        return;
      }
      if (!("art" in r)) return;
      setMeldung({
        text:
          `${z.name}: ` +
          (r.mailVerschickt ? "freigegeben, Mail ist raus." : "erledigt, keine Mail.") +
          (r.hinweis ? ` ${r.hinweis}` : ""),
        fehler: false,
      });
    });
  }

  function erneutSenden(z: ZuteilungEintrag) {
    if (
      !window.confirm(
        `${z.name}: Bestätigung mit der aktuellen Terminliste und dem PDF noch einmal schicken?`
      )
    ) {
      return;
    }
    setMeldung(null);
    setAktiv(z.schuelerId);
    starte(async () => {
      const r = await bestaetigungErneutSenden(z.schuelerId);
      setAktiv(null);
      if ("error" in r && r.error) {
        setMeldung({ text: `${z.name}: ${r.error}`, fehler: true });
        return;
      }
      if (!("termine" in r)) return;
      setMeldung({
        text: `${z.name}: Bestätigung erneut verschickt, mit ${r.termine} Terminen.`,
        fehler: false,
      });
    });
  }

  function entfernen(z: ZuteilungEintrag) {
    if (!window.confirm(`${z.name} aus der Zuteilung nehmen?`)) return;
    setMeldung(null);
    starte(async () => {
      const r = await zuteilungEintragEntfernen(z.schuelerId);
      if ("error" in r && r.error) setMeldung({ text: r.error, fehler: true });
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-700 text-[#1C244B]">Zuteilung</h2>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">
            Aus dem Routenplaner übernommen. Jeden Eintrag anpassen, dann
            einzeln freigeben. Nichts geht ohne deinen Klick raus.
          </p>
        </div>
        <div className="flex gap-1.5 text-[11px] font-600">
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{offen} offen</span>
          {reserviert > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{reserviert} reserviert</span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{frei} freigegeben</span>
        </div>
      </div>

      {meldung && (
        <p
          className={`text-sm rounded-xl px-3.5 py-2.5 ${
            meldung.fehler ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {meldung.text}
        </p>
      )}

      {eintraege.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          Noch nichts übernommen. Im Routenplaner rechnen und &bdquo;Als Zuteilung übernehmen&ldquo; klicken.
        </p>
      ) : (
        <div className="space-y-4">
          {tage.filter((t) => nachTag.has(t)).map((t) => (
            <div key={t}>
              <p className="text-xs font-600 text-gray-400 uppercase tracking-wide mb-1.5">
                {WEEKDAY_LABELS[t]}
              </p>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {(nachTag.get(t) ?? []).map((z) => {
                  const art = arten[z.schuelerId] ?? "ohne_abo";
                  const st = STATUS_TEXT[z.status];
                  const istOffen = bearbeite === z.schuelerId;
                  const fix = z.status === "freigegeben";
                  return (
                    <li key={z.schuelerId} className="px-3.5 py-3">
                      {istOffen ? (
                        <Bearbeiten
                          z={z}
                          fenster={fenster}
                          onFertig={() => setBearbeite(null)}
                          onMeldung={(m) => setMeldung(m)}
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-[52px] flex-shrink-0 text-sm font-700 text-[#1C244B] tabular-nums">
                            {z.beginn}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-600 text-gray-900 truncate">
                              {z.name}
                              <span className={`ml-2 text-[10px] font-600 px-1.5 py-0.5 rounded ${st.ton}`}>
                                {st.label}
                              </span>
                            </p>
                            <p className="text-xs text-gray-500">
                              {paritaetText(z.paritaet)}
                              <span className="mx-1.5 text-gray-300">·</span>
                              <span title={ART_TEXT[art].lang}>{ART_TEXT[art].kurz}</span>
                            </p>
                          </div>

                          {fix ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {art !== "extern" && (
                                <button
                                  onClick={() => erneutSenden(z)}
                                  disabled={laeuft}
                                  className="p-2 rounded-lg text-gray-400 hover:text-[#1C244B] hover:bg-gray-100 disabled:opacity-40"
                                  title="Bestätigung mit aktueller Terminliste erneut senden"
                                >
                                  {laeuft && aktiv === z.schuelerId ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Mail className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              <Lock className="w-4 h-4 text-gray-300" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => setBearbeite(z.schuelerId)}
                                disabled={laeuft}
                                className="p-2 rounded-lg text-gray-400 hover:text-[#1C244B] hover:bg-gray-100 disabled:opacity-40"
                                title="Tag, Uhrzeit oder Woche ändern"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => entfernen(z)}
                                disabled={laeuft}
                                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                                title="Aus der Zuteilung nehmen"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => freigeben(z)}
                                disabled={laeuft}
                                className={`press inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 ${
                                  art === "ohne_abo"
                                    ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    : "bg-[#1C244B] text-white hover:bg-[#2A3563]"
                                }`}
                              >
                                {laeuft && aktiv === z.schuelerId ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : art === "ohne_abo" ? (
                                  <Clock className="w-3.5 h-3.5" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                {art === "ohne_abo"
                                  ? z.status === "reserviert"
                                    ? "Bleibt reserviert"
                                    : "Reservieren"
                                  : "Freigeben"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Bearbeiten({
  z,
  fenster,
  onFertig,
  onMeldung,
}: {
  z: ZuteilungEintrag;
  fenster: { wochentag: number; beginn: string; ende: string }[];
  onFertig: () => void;
  onMeldung: (m: { text: string; fehler: boolean }) => void;
}) {
  const [wochentag, setWochentag] = useState(z.wochentag);
  const [beginn, setBeginn] = useState(z.beginn);
  const [paritaet, setParitaet] = useState<0 | 1 | null>(z.paritaet);
  const [laeuft, starte] = useTransition();

  const f = fenster.find((x) => x.wochentag === wochentag);
  const zeiten = f ? raster(f.beginn, f.ende) : [];

  function speichern() {
    starte(async () => {
      const r = await zuteilungEintragAendern(z.schuelerId, { wochentag, beginn, paritaet });
      if ("error" in r && r.error) {
        onMeldung({ text: `${z.name}: ${r.error}`, fehler: true });
        return;
      }
      onMeldung({ text: `${z.name} verschoben.`, fehler: false });
      onFertig();
    });
  }

  return (
    <div className="space-y-2.5">
      <p className="text-sm font-600 text-gray-900">{z.name}</p>
      <div className="flex flex-wrap gap-2">
        <select
          value={wochentag}
          onChange={(e) => {
            const wt = Number(e.target.value);
            setWochentag(wt);
            const nf = fenster.find((x) => x.wochentag === wt);
            if (nf && !raster(nf.beginn, nf.ende).includes(beginn)) setBeginn(nf.beginn);
          }}
          className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm bg-white"
        >
          {fenster.map((x) => (
            <option key={x.wochentag} value={x.wochentag}>
              {WEEKDAY_LABELS[x.wochentag]}
            </option>
          ))}
        </select>
        <select
          value={beginn}
          onChange={(e) => setBeginn(e.target.value)}
          className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm bg-white tabular-nums"
        >
          {zeiten.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={paritaet === null ? "jede" : String(paritaet)}
          onChange={(e) =>
            setParitaet(e.target.value === "jede" ? null : (Number(e.target.value) as 0 | 1))
          }
          className="rounded-lg border border-gray-200 px-2.5 py-2 text-sm bg-white"
        >
          <option value="jede">jede Woche</option>
          <option value="0">gerade Wochen</option>
          <option value="1">ungerade Wochen</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button
          onClick={speichern}
          disabled={laeuft}
          className="press inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg bg-[#1C244B] text-white hover:bg-[#2A3563] disabled:opacity-40"
        >
          {laeuft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Übernehmen
        </button>
        <button
          onClick={onFertig}
          disabled={laeuft}
          className="inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <X className="w-3.5 h-3.5" /> Abbrechen
        </button>
      </div>
    </div>
  );
}
