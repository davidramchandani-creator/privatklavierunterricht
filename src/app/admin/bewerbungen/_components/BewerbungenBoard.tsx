"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, Mail, Phone, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ALTERSGRUPPEN,
  MOBILITAET,
  ORTE,
  STATUS_LABEL,
  TAGE,
  ZEITFENSTER,
  hinweise,
  vorlageFuer,
  type Bewerbung,
  type BewerbungStatus,
} from "@/lib/bewerbung";
import { bewerbungLoeschen, bewerbungNotiz, bewerbungStufe } from "../actions";

export type BewerbungZeile = Bewerbung & {
  id: string;
  status: BewerbungStatus;
  notizen: string | null;
  erstellt_am: string;
};

const SPALTEN: BewerbungStatus[] = ["neu", "gespraech", "probelektion", "zusage", "absage"];
const FARBE: Record<BewerbungStatus, string> = {
  neu: "bg-navy-50 text-navy-900",
  gespraech: "bg-amber-100 text-amber-700",
  probelektion: "bg-indigo-100 text-indigo-700",
  zusage: "bg-emerald-100 text-emerald-700",
  absage: "bg-gray-100 text-gray-500",
  zurueckgezogen: "bg-gray-100 text-gray-500",
};
const NAECHSTE: Partial<Record<BewerbungStatus, BewerbungStatus[]>> = {
  neu: ["gespraech", "absage"],
  gespraech: ["probelektion", "zusage", "absage"],
  probelektion: ["zusage", "absage"],
};

const label = <T extends { key: string; label: string }>(liste: readonly T[], keys: string[]) =>
  keys.map((k) => liste.find((x) => x.key === k)?.label ?? k).join(", ");

export default function BewerbungenBoard({ liste }: { liste: BewerbungZeile[] }) {
  const [filter, setFilter] = useState<BewerbungStatus | "offen">("offen");
  const sichtbar = liste.filter((b) =>
    filter === "offen" ? ["neu", "gespraech", "probelektion"].includes(b.status) : b.status === filter
  );
  const zahl = (s: BewerbungStatus) => liste.filter((b) => b.status === s).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("offen")}
          className={`text-xs font-600 px-3 py-1.5 rounded-full border ${filter === "offen" ? "bg-[#1C244B] text-white border-[#1C244B]" : "border-gray-200 text-gray-600"}`}
        >
          Offen ({zahl("neu") + zahl("gespraech") + zahl("probelektion")})
        </button>
        {SPALTEN.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs font-600 px-3 py-1.5 rounded-full border ${filter === s ? "bg-[#1C244B] text-white border-[#1C244B]" : "border-gray-200 text-gray-600"}`}
          >
            {STATUS_LABEL[s]} ({zahl(s)})
          </button>
        ))}
      </div>

      {sichtbar.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-400">
          Hier ist gerade nichts.
        </div>
      ) : (
        sichtbar.map((b) => <Karte key={b.id} b={b} />)
      )}
    </div>
  );
}

function Karte({ b }: { b: BewerbungZeile }) {
  const [offen, setOffen] = useState(false);
  const [mail, setMail] = useState<{ status: BewerbungStatus; betreff: string; text: string } | null>(null);
  const [notiz, setNotiz] = useState(b.notizen ?? "");
  const [isPending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const h = hinweise(b);
  const alterJahre = b.spielt_seit ? new Date().getFullYear() - b.spielt_seit : null;

  function los(fn: () => Promise<{ error?: string } | { success: true } | undefined>, danach?: () => void) {
    setFehler(null);
    startTransition(async () => {
      const r = await fn();
      if (r && "error" in r && r.error) setFehler(r.error);
      else danach?.();
    });
  }

  const anlegenHref = `/admin/lehrpersonen/neu?${new URLSearchParams({
    vorname: b.vorname,
    nachname: b.nachname,
    email: b.email,
    ...(b.telefon ? { telefon: b.telefon } : {}),
    orte: b.unterrichtsorte.join(","),
    alter: b.altersgruppen.join(","),
    ferien: b.mindestens_20 === false ? "10.64" : "8.33",
    start: b.start_ab ?? "",
  }).toString()}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm transition-transform hover:-translate-y-px">
      <button onClick={() => setOffen((x) => !x)} className="w-full text-left p-5 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-700 text-[#1C244B]">
            {b.vorname} {b.nachname}
            <span className={`ml-2 text-xs font-600 px-2 py-0.5 rounded-full ${FARBE[b.status]}`}>{STATUS_LABEL[b.status]}</span>
          </p>
          <p className="text-xs text-gray-500">
            {new Date(b.erstellt_am).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}
            {b.wohnort ? ` · ${b.wohnort}` : ""}
            {alterJahre !== null ? ` · spielt seit ${alterJahre} Jahren` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {h.gut.map((x) => (
              <span key={x} className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">✓ {x}</span>
            ))}
            {h.offen.map((x) => (
              <span key={x} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">? {x}</span>
            ))}
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${offen ? "rotate-180" : ""}`} />
      </button>

      {offen && (
        <div className="px-5 pb-5 space-y-4 text-sm animate-enter-up">
          <div className="flex flex-wrap gap-4 text-[#1C244B]">
            <a href={`mailto:${b.email}`} className="flex items-center gap-1.5 hover:underline">
              <Mail className="w-3.5 h-3.5" /> {b.email}
            </a>
            {b.telefon && (
              <a href={`tel:${b.telefon}`} className="flex items-center gap-1.5 hover:underline">
                <Phone className="w-3.5 h-3.5" /> {b.telefon}
              </a>
            )}
          </div>

          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-gray-700">
            <Eintrag k="Stile" v={b.stile.join(", ")} />
            <Eintrag k="Song" v={b.lieblingssong} />
            <Eintrag k="Unterrichtserfahrung" v={[b.unterrichtserfahrung, b.unterrichtserfahrung_text].filter(Boolean).join(": ")} />
            <Eintrag k="Ausbildung" v={b.ausbildung} />
            <Eintrag k="Am liebsten" v={label(ALTERSGRUPPEN, b.altersgruppen)} />
            <Eintrag k="Orte" v={label(ORTE, b.unterrichtsorte)} />
            <Eintrag k="Unterwegs mit" v={label(MOBILITAET, b.mobilitaet)} />
            <Eintrag k="Lektionen pro Woche" v={b.lektionen_pro_woche} />
            <Eintrag k="Ab" v={b.start_ab ? new Date(b.start_ab).toLocaleDateString("de-CH") : null} />
            <Eintrag k="20 oder älter" v={b.mindestens_20 === null ? null : b.mindestens_20 ? "Ja" : "Nein"} />
          </dl>

          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th />
                  {TAGE.map((t) => (
                    <th key={t.key} className="px-1.5 text-gray-500 font-600">{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ZEITFENSTER.map((z) => (
                  <tr key={z.key}>
                    <td className="pr-2 text-gray-500 whitespace-nowrap">{z.label}</td>
                    {TAGE.map((t) => (
                      <td key={t.key} className="p-0.5">
                        <div className={`w-8 h-5 rounded ${(b.verfuegbarkeit[t.key] ?? []).includes(z.key) ? "bg-[#1C244B]" : "bg-gray-100"}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {b.akkord_erklaerung && (
            <Zitat titel="Akkord für eine 9-Jährige">{b.akkord_erklaerung}</Zitat>
          )}
          {b.wichtig_im_unterricht && <Zitat titel="Wichtig im Unterricht">{b.wichtig_im_unterricht}</Zitat>}

          <div className="flex gap-2 items-center">
            <Input value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Deine Notiz" className="h-9 text-xs" />
            {notiz !== (b.notizen ?? "") && (
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => los(() => bewerbungNotiz(b.id, notiz))}>
                Speichern
              </Button>
            )}
          </div>

          {mail ? (
            <div className="bg-navy-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-700 text-[#1C244B]">Mail an {b.vorname}: Stufe „{STATUS_LABEL[mail.status]}“</p>
              <Input value={mail.betreff} onChange={(e) => setMail({ ...mail, betreff: e.target.value })} />
              <textarea
                value={mail.text}
                onChange={(e) => setMail({ ...mail, text: e.target.value })}
                rows={9}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={isPending} onClick={() => los(() => bewerbungStufe(b.id, mail.status, mail), () => setMail(null))}>
                  Senden und Stufe setzen
                </Button>
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => los(() => bewerbungStufe(b.id, mail.status, null), () => setMail(null))}>
                  Nur Stufe setzen, ohne Mail
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMail(null)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(NAECHSTE[b.status] ?? []).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === "absage" ? "outline" : "default"}
                  onClick={() => {
                    const v = vorlageFuer(s, b.vorname);
                    if (v) setMail({ status: s, ...v });
                  }}
                >
                  {STATUS_LABEL[s]}
                </Button>
              ))}
              {b.status === "zusage" && (
                <Link href={anlegenHref}>
                  <Button size="sm">
                    <UserPlus className="w-3.5 h-3.5" /> Als Lehrperson anlegen
                  </Button>
                </Link>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => {
                  if (confirm(`Bewerbung von ${b.vorname} ${b.nachname} endgültig löschen?`)) los(() => bewerbungLoeschen(b.id));
                }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Löschen
              </Button>
            </div>
          )}

          {fehler && <p className="text-sm text-red-600">{fehler}</p>}
        </div>
      )}
    </div>
  );
}

function Eintrag({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null;
  return (
    <div>
      <dt className="text-xs text-gray-400">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Zitat({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl px-4 py-3">
      <p className="text-xs font-600 text-gray-500 mb-1">{titel}</p>
      <p className="text-gray-700 leading-relaxed whitespace-pre-line">{children}</p>
    </div>
  );
}
