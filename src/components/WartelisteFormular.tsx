"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { meldeWarteliste } from "@/app/warteliste/actions";
import { TAG_LABEL } from "@/lib/warteliste";

type Ergebnis = { ok?: true; success?: true; error?: string } | undefined;

/**
 * Anmeldung auf die Warteliste.
 *
 * Dasselbe Formular dient der Webseite (Besucher meldet sich selbst an,
 * bekommt eine Bestätigung) und dem Admin (David trägt jemanden ein, ohne
 * Mail). Im Admin wird eine eigene Action übergeben.
 */
export default function WartelisteFormular({
  aktion,
  admin = false,
  onFertig,
}: {
  aktion?: (fd: FormData) => Promise<Ergebnis>;
  admin?: boolean;
  onFertig?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);

  function absenden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFehler(null);
    const formular = e.currentTarget;
    const fd = new FormData(formular);
    startTransition(async () => {
      const r = await (aktion ?? meldeWarteliste)(fd);
      if (r?.error) {
        setFehler(r.error);
        return;
      }
      if (admin) {
        formular.reset();
        onFertig?.();
      } else {
        setFertig(true);
      }
    });
  }

  if (fertig) {
    return (
      <div className="text-center space-y-3 py-4 animate-enter-up">
        <div className="w-14 h-14 bg-status-paid/10 rounded-2xl flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7 text-status-paid" />
        </div>
        <h2 className="text-xl font-800 text-navy-900">Du stehst auf der Warteliste</h2>
        <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
          Danke! Du bekommst gleich eine Bestätigung per Mail. Sobald ein Platz
          frei wird, der zu deinen Wünschen passt, melde ich mich bei dir.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={absenden} className="space-y-4">
      {/* Honigtopf gegen Bots, für Menschen unsichtbar. */}
      {!admin && (
        <input
          type="text"
          name="firma"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] w-px h-px opacity-0"
        />
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-600 text-navy-900 mb-1 block">Vorname *</label>
          <Input name="vorname" required autoComplete="given-name" />
        </div>
        <div>
          <label className="text-sm font-600 text-navy-900 mb-1 block">Nachname *</label>
          <Input name="nachname" required autoComplete="family-name" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-600 text-navy-900 mb-1 block">E-Mail *</label>
          <Input name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="text-sm font-600 text-navy-900 mb-1 block">Telefon</label>
          <Input name="telefon" type="tel" autoComplete="tel" />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-600 text-navy-900 mb-1.5">Wie oft?</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ["zweiwoechentlich", "Alle zwei Wochen"],
            ["woechentlich", "Jede Woche"],
            ["egal", "Egal"],
          ].map(([wert, label]) => (
            <label
              key={wert}
              className="press flex items-center gap-2 text-sm border border-[#EAECEF] rounded-lg px-3 py-2 cursor-pointer has-[:checked]:border-navy-900 has-[:checked]:bg-navy-50"
            >
              <input type="radio" name="wunsch_rhythmus" value={wert} defaultChecked={wert === "egal"} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-600 text-navy-900 mb-1.5">Welche Tage gehen?</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((t) => (
            <label
              key={t}
              className="press flex items-center gap-2 text-sm border border-[#EAECEF] rounded-lg px-3 py-2 cursor-pointer has-[:checked]:border-navy-900 has-[:checked]:bg-navy-50"
            >
              <input type="checkbox" name="wunsch_tage" value={t} />
              {TAG_LABEL[t]}
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Nichts angekreuzt heisst: alle Tage möglich.</p>
      </fieldset>

      <div>
        <label className="text-sm font-600 text-navy-900 mb-1 block">Zu welchen Zeiten?</label>
        <Input name="wunsch_zeiten" placeholder="z. B. ab 17 Uhr, oder Freitagnachmittag" />
      </div>

      <div>
        <label className="text-sm font-600 text-navy-900 mb-1 block">Nachricht</label>
        <textarea
          name="nachricht"
          rows={3}
          placeholder="Für wen ist der Unterricht, wie alt, schon Erfahrung?"
          className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {admin && (
        <div>
          <label className="text-sm font-600 text-navy-900 mb-1 block">Notiz (nur für dich)</label>
          <Input name="notizen" placeholder="z. B. kam über Matchspace" />
        </div>
      )}

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : admin ? (
          "Eintragen"
        ) : (
          "Auf die Warteliste"
        )}
      </Button>
    </form>
  );
}
