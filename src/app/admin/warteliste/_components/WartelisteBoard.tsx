"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Mail, Phone, Plus, RefreshCw, Send, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import WartelisteFormular from "@/components/WartelisteFormular";
import {
  ANGEBOT_FRIST_TAGE,
  RHYTHMUS_LABEL,
  STATUS_LABEL,
  TAG_LABEL,
  type WartelistenStatus,
  type WunschRhythmus,
} from "@/lib/warteliste";
import {
  platzAnbieten,
  platzstatusNeuRechnen,
  wartelisteEintragen,
  wartelisteLoeschen,
  wartelisteNotiz,
  wartelisteStatus,
} from "../actions";

export type Eintrag = {
  id: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string | null;
  nachricht: string | null;
  wunsch_rhythmus: WunschRhythmus;
  wunsch_tage: number[];
  wunsch_zeiten: string | null;
  quelle: "webseite" | "admin";
  status: WartelistenStatus;
  angebot_text: string | null;
  angebot_frist: string | null;
  angeboten_am: string | null;
  beantwortet_am: string | null;
  notizen: string | null;
  erstellt_am: string;
};

function datum(iso: string, mitZeit = false): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(mitZeit ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

const BADGE: Record<WartelistenStatus, string> = {
  wartend: "bg-navy-50 text-navy-900",
  angeboten: "bg-amber-100 text-amber-700",
  zugesagt: "bg-emerald-100 text-emerald-700",
  abgelehnt: "bg-gray-100 text-gray-500",
  entfernt: "bg-gray-100 text-gray-500",
};

export default function WartelisteBoard({ eintraege }: { eintraege: Eintrag[] }) {
  const [neu, setNeu] = useState(false);
  const [isPending, startTransition] = useTransition();

  const offen = eintraege.filter((e) => e.status === "wartend" || e.status === "angeboten");
  const zugesagt = eintraege.filter((e) => e.status === "zugesagt");
  const erledigt = eintraege.filter((e) => e.status === "abgelehnt" || e.status === "entfernt");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setNeu((v) => !v)} variant={neu ? "outline" : "default"}>
          {neu ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {neu ? "Abbrechen" : "Selbst eintragen"}
        </Button>
        <Button
          variant="outline"
          disabled={isPending}
          onClick={() => startTransition(async () => void (await platzstatusNeuRechnen()))}
        >
          <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
          Freie Plätze neu rechnen
        </Button>
      </div>

      {neu && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 animate-enter-up">
          <p className="text-sm text-gray-500 mb-4">
            Für Anfragen per Mail, Telefon oder Plattform. Die Person bekommt kein Mail.
          </p>
          <WartelisteFormular admin aktion={wartelisteEintragen} onFertig={() => setNeu(false)} />
        </div>
      )}

      <Abschnitt titel="Wartet" leer="Niemand wartet gerade.">
        {offen.map((e, i) => (
          <Karte key={e.id} e={e} position={i + 1} />
        ))}
      </Abschnitt>

      {zugesagt.length > 0 && (
        <Abschnitt titel="Zugesagt, als Schüler anlegen">
          {zugesagt.map((e) => (
            <Karte key={e.id} e={e} />
          ))}
        </Abschnitt>
      )}

      {erledigt.length > 0 && (
        <details className="group">
          <summary className="text-sm font-600 text-gray-500 uppercase tracking-wide cursor-pointer">
            Erledigt ({erledigt.length})
          </summary>
          <div className="space-y-3 mt-3">
            {erledigt.map((e) => (
              <Karte key={e.id} e={e} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Abschnitt({
  titel,
  leer,
  children,
}: {
  titel: string;
  leer?: string;
  children: React.ReactNode[] | React.ReactNode;
}) {
  const anzahl = Array.isArray(children) ? children.length : 1;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-600 text-gray-500 uppercase tracking-wide">{titel}</h2>
      {anzahl === 0 && leer ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          {leer}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Karte({ e, position }: { e: Eintrag; position?: number }) {
  const [isPending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [anbieten, setAnbieten] = useState(false);
  const [angebotText, setAngebotText] = useState(e.angebot_text ?? "");
  const [frist, setFrist] = useState(String(ANGEBOT_FRIST_TAGE));
  const [notiz, setNotiz] = useState(e.notizen ?? "");

  const abgelaufen =
    e.status === "angeboten" && e.angebot_frist && new Date(e.angebot_frist).getTime() < Date.now();

  function los(fn: () => Promise<{ error?: string } | { success: true } | undefined>) {
    setFehler(null);
    startTransition(async () => {
      const r = await fn();
      if (r && "error" in r && r.error) setFehler(r.error);
    });
  }

  const tage = e.wunsch_tage.length > 0 ? e.wunsch_tage.map((t) => TAG_LABEL[t]).join(", ") : "alle Tage";
  const anlegenHref = `/admin/schueler/neu?${new URLSearchParams({
    vorname: e.vorname,
    nachname: e.nachname,
    email: e.email,
    ...(e.telefon ? { telefon: e.telefon } : {}),
  }).toString()}`;

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3 transition-transform hover:-translate-y-px ${
        e.status === "abgelehnt" || e.status === "entfernt" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-700 text-gray-900">
            {position ? <span className="text-gray-400 mr-1.5">{position}.</span> : null}
            {e.vorname} {e.nachname}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Seit {datum(e.erstellt_am)} · {e.quelle === "admin" ? "von dir eingetragen" : "über die Webseite"}
          </p>
        </div>
        <span className={`text-xs font-600 px-2.5 py-1 rounded-full ${abgelaufen ? "bg-red-100 text-red-600" : BADGE[e.status]}`}>
          {abgelaufen ? "Frist abgelaufen" : STATUS_LABEL[e.status]}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        <a href={`mailto:${e.email}`} className="flex items-center gap-2 text-[#1C244B] hover:underline">
          <Mail className="w-3.5 h-3.5" /> {e.email}
        </a>
        {e.telefon && (
          <a href={`tel:${e.telefon}`} className="flex items-center gap-2 text-gray-600 hover:text-[#1C244B]">
            <Phone className="w-3.5 h-3.5" /> {e.telefon}
          </a>
        )}
        <p className="text-gray-600 sm:col-span-2">
          <strong className="font-600 text-gray-800">{RHYTHMUS_LABEL[e.wunsch_rhythmus]}</strong> · {tage}
          {e.wunsch_zeiten ? ` · ${e.wunsch_zeiten}` : ""}
        </p>
      </div>

      {e.nachricht && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">{e.nachricht}</p>
      )}

      {e.status === "angeboten" && e.angebot_text && (
        <p className="text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-amber-800">
          Angeboten: <strong>{e.angebot_text}</strong>
          {e.angebot_frist ? `, Antwort bis ${datum(e.angebot_frist, true)}` : ""}
        </p>
      )}
      {e.status === "zugesagt" && e.angebot_text && (
        <p className="text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-emerald-800">
          Zugesagt für <strong>{e.angebot_text}</strong>
        </p>
      )}

      <div className="flex gap-2 items-center">
        <Input
          value={notiz}
          onChange={(ev) => setNotiz(ev.target.value)}
          placeholder="Notiz"
          className="h-9 text-xs"
        />
        {notiz !== (e.notizen ?? "") && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => los(() => wartelisteNotiz(e.id, notiz))}>
            Speichern
          </Button>
        )}
      </div>

      {anbieten && (
        <div className="space-y-2 bg-navy-50 rounded-xl p-3">
          <label className="text-xs font-600 text-navy-900 block">Welcher Platz?</label>
          <Input
            value={angebotText}
            onChange={(ev) => setAngebotText(ev.target.value)}
            placeholder="Montag 17:00, alle zwei Wochen, ab 22. Februar 2027"
          />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Antwort innert</span>
            <Input
              type="number"
              min={1}
              max={14}
              value={frist}
              onChange={(ev) => setFrist(ev.target.value)}
              className="w-20 h-9"
            />
            <span className="text-gray-600">Tagen</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={isPending}
              onClick={() =>
                los(async () => {
                  const r = await platzAnbieten(e.id, angebotText, Number(frist));
                  if (r && "success" in r) setAnbieten(false);
                  return r;
                })
              }
            >
              <Send className="w-3.5 h-3.5" /> Mail senden
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAnbieten(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(e.status === "wartend" || e.status === "angeboten") && !anbieten && (
          <Button size="sm" onClick={() => setAnbieten(true)} disabled={isPending}>
            <Send className="w-3.5 h-3.5" />
            {e.status === "angeboten" ? "Erneut anbieten" : "Platz anbieten"}
          </Button>
        )}
        {e.status === "angeboten" && (
          <>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => los(() => wartelisteStatus(e.id, "zugesagt"))}>
              Hat zugesagt
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => los(() => wartelisteStatus(e.id, "wartend"))}>
              Zurück auf wartend
            </Button>
          </>
        )}
        {e.status === "zugesagt" && (
          <Link href={anlegenHref}>
            <Button size="sm">
              <UserPlus className="w-3.5 h-3.5" /> Als Schüler anlegen
            </Button>
          </Link>
        )}
        {(e.status === "abgelehnt" || e.status === "entfernt") && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => los(() => wartelisteStatus(e.id, "wartend"))}>
            Wieder auf die Liste
          </Button>
        )}
        {e.status !== "entfernt" && e.status !== "abgelehnt" && (
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => los(() => wartelisteStatus(e.id, "entfernt"))}>
            Entfernen
          </Button>
        )}
        {(e.status === "entfernt" || e.status === "abgelehnt") && (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              if (confirm(`${e.vorname} ${e.nachname} endgültig löschen?`)) los(() => wartelisteLoeschen(e.id));
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Löschen
          </Button>
        )}
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
