"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALTER_LABEL, ORT_LABEL, lohnAufteilung, type Altersgruppe, type Unterrichtsort } from "@/lib/lehrpersonen";
import { lehrpersonAnlegen, lehrpersonSpeichern } from "../actions";

export type FormWerte = {
  vorname: string;
  nachname: string;
  unterrichtsorte: Unterrichtsort[];
  unterrichtsadresse: string | null;
  startpunkt_adresse: string | null;
  startpunkt_gefunden?: boolean;
  region: string;
  altersgruppen: Altersgruppe[];
  startdatum: string | null;
  lohn_pro_lektion: number | null;
  ferien_prozent: number;
  sortierung: number;
  ist_inhaber?: boolean;
};

const LEER: FormWerte = {
  vorname: "",
  nachname: "",
  unterrichtsorte: ["hausbesuch"],
  unterrichtsadresse: null,
  startpunkt_adresse: null,
  region: "Winterthur",
  altersgruppen: [],
  startdatum: "2027-02-22",
  lohn_pro_lektion: 50,
  ferien_prozent: 8.33,
  sortierung: 0,
};

function Feld({ label, hinweis, children }: { label: string; hinweis?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-600 text-gray-700 block">{label}</label>
      {children}
      {hinweis && <p className="text-xs text-gray-400">{hinweis}</p>}
    </div>
  );
}

export default function LehrpersonFormular({ id, werte }: { id?: string; werte?: FormWerte }) {
  const w = werte ?? LEER;
  const neu = !id;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [lohn, setLohn] = useState(String(w.lohn_pro_lektion ?? ""));
  const [ferien, setFerien] = useState(String(w.ferien_prozent));
  const aufteilung = lohnAufteilung(Number(lohn) || 0, Number(ferien) || 0);

  function absenden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMeldung(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      if (neu) {
        const r = await lehrpersonAnlegen(fd);
        if ("error" in r && r.error) setMeldung({ ok: false, text: r.error });
        else if ("id" in r) router.push(`/admin/lehrpersonen/${r.id}`);
      } else {
        const r = await lehrpersonSpeichern(id!, fd);
        if ("error" in r && r.error) setMeldung({ ok: false, text: r.error });
        else {
          const sp = "startpunktGefunden" in r ? r.startpunktGefunden : undefined;
          setMeldung({
            ok: sp !== false,
            text:
              sp === false
                ? "Gespeichert, aber der Startpunkt wurde nicht gefunden. Bitte Adresse prüfen (Strasse Nr., PLZ Ort)."
                : "Gespeichert.",
          });
          router.refresh();
        }
      }
    });
  }

  return (
    <form onSubmit={absenden} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <Feld label="Vorname *">
          <Input name="vorname" required defaultValue={w.vorname} />
        </Feld>
        <Feld label="Nachname *">
          <Input name="nachname" required defaultValue={w.nachname} />
        </Feld>
      </div>

      {neu && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Feld label="E-Mail für das Login *" hinweis="Sie bekommt eine Einladung und setzt ihr Passwort selbst. Nie öffentlich.">
            <Input name="email" type="email" required />
          </Feld>
          <Feld label="Telefon" hinweis="Nur für dich, nie öffentlich.">
            <Input name="telefon" type="tel" />
          </Feld>
        </div>
      )}

      <Feld label="Unterrichtsorte">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ORT_LABEL) as Unterrichtsort[])
            .filter((o) => o !== "studio" || w.ist_inhaber)
            .map((o) => (
              <label
                key={o}
                className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2 cursor-pointer has-[:checked]:border-[#1C244B] has-[:checked]:bg-navy-50"
              >
                <input type="checkbox" name="unterrichtsorte" value={o} defaultChecked={w.unterrichtsorte.includes(o)} />
                {ORT_LABEL[o]}
              </label>
            ))}
        </div>
      </Feld>

      <div className="grid sm:grid-cols-2 gap-4">
        <Feld
          label="Unterrichtsadresse (bei sich zu Hause)"
          hinweis="Erhält der Kunde erst nach der Zuteilung. Nie auf der Webseite."
        >
          <Input name="unterrichtsadresse" defaultValue={w.unterrichtsadresse ?? ""} placeholder="Strasse Nr., PLZ Ort" />
        </Feld>
        <Feld
          label="Startpunkt für die Distanz"
          hinweis={
            w.startpunkt_adresse && w.startpunkt_gefunden === false
              ? "Nicht gefunden, bitte prüfen."
              : "Für Fahrpauschale und Distanz. Intern, nie öffentlich."
          }
        >
          <Input name="startpunkt_adresse" defaultValue={w.startpunkt_adresse ?? ""} placeholder="Strasse Nr., PLZ Ort" />
        </Feld>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Feld label="Region">
          <Input name="region" defaultValue={w.region} />
        </Feld>
        <Feld label="Startdatum">
          <Input name="startdatum" type="date" defaultValue={w.startdatum ?? ""} />
        </Feld>
        <Feld label="Reihenfolge auf der Webseite" hinweis="Kleinere Zahl weiter vorne.">
          <Input name="sortierung" type="number" defaultValue={w.sortierung} />
        </Feld>
      </div>

      <Feld label="Unterrichtet">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ALTER_LABEL) as Altersgruppe[]).map((a) => (
            <label
              key={a}
              className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2 cursor-pointer has-[:checked]:border-[#1C244B] has-[:checked]:bg-navy-50"
            >
              <input type="checkbox" name="altersgruppen" value={a} defaultChecked={w.altersgruppen.includes(a)} />
              {ALTER_LABEL[a]}
            </label>
          ))}
        </div>
      </Feld>

      {!w.ist_inhaber && (
        <div className="grid sm:grid-cols-2 gap-4 bg-surface rounded-xl p-4">
          <Feld label="Bruttolohn pro Lektion (CHF, inkl. Ferienentschädigung)">
            <Input name="lohn_pro_lektion" type="number" step="0.05" min="0" value={lohn} onChange={(e) => setLohn(e.target.value)} />
          </Feld>
          <Feld label="Ferienentschädigung (%)" hinweis="8.33 % bei 4 Wochen Ferien, 10.64 % unter 20 Jahren (5 Wochen).">
            <Input name="ferien_prozent" type="number" step="0.01" min="0" value={ferien} onChange={(e) => setFerien(e.target.value)} />
          </Feld>
          <p className="sm:col-span-2 text-xs text-gray-500">
            Auf der Lohnabrechnung: Grundlohn CHF {aufteilung.grundlohn.toFixed(2)} + Ferienentschädigung CHF{" "}
            {aufteilung.ferien.toFixed(2)} pro Lektion.
          </p>
        </div>
      )}

      {meldung && <p className={`text-sm ${meldung.ok ? "text-emerald-600" : "text-red-600"}`}>{meldung.text}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : neu ? "Anlegen und einladen" : "Speichern"}
      </Button>
    </form>
  );
}
