"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import EinfacherText from "@/components/EinfacherText";
import {
  entwurfEntscheiden,
  fotoHochladen,
  kurztextVeroeffentlichen,
  lehrpersonStatus,
} from "../../actions";

type Ergebnis = { error?: string; success?: true } | undefined;

export default function ProfilBereich({
  id,
  kurztext,
  entwurf,
  eingereichtAm,
  status,
  istInhaber,
}: {
  id: string;
  kurztext: string | null;
  entwurf: string | null;
  eingereichtAm: string | null;
  status: string;
  istInhaber: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState(kurztext ?? "");
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  function los(fn: () => Promise<Ergebnis>, ok: string) {
    setMeldung(null);
    startTransition(async () => {
      const r = await fn();
      if (r?.error) setMeldung({ ok: false, text: r.error });
      else {
        setMeldung({ ok: true, text: ok });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {entwurf && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-700 text-amber-800">
            Neuer Profiltext zur Freigabe
            {eingereichtAm && (
              <span className="font-400 text-amber-700">
                {" "}
                · eingereicht am {new Date(eingereichtAm).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}
              </span>
            )}
          </p>
          <div className="bg-white rounded-xl p-4 text-sm text-gray-700">
            <EinfacherText text={entwurf} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending} onClick={() => los(() => entwurfEntscheiden(id, true), "Freigegeben, steht jetzt auf der Webseite.")}>
              Freigeben
            </Button>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => los(() => entwurfEntscheiden(id, false), "Entwurf verworfen.")}>
              Ablehnen
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <p className="text-sm font-700 text-[#1C244B]">Profiltext auf der Webseite</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={1200}
          placeholder="Kurz und persönlich: Wer bist du, was ist dir beim Unterrichten wichtig, wen unterrichtest du gern?"
          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C244B]/20"
        />
        <p className="text-xs text-gray-400">
          **fett**, *kursiv*, Leerzeile für einen neuen Absatz. Ohne Telefon, Mail oder Adresse.
        </p>
        <Button size="sm" disabled={isPending || text === (kurztext ?? "")} onClick={() => los(() => kurztextVeroeffentlichen(id, text), "Veröffentlicht.")}>
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Veröffentlichen"}
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <p className="text-sm font-700 text-[#1C244B]">Foto</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            los(() => fotoHochladen(id, fd), "Foto gespeichert.");
          }}
          className="flex flex-wrap items-center gap-3"
        >
          <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
          <Button size="sm" type="submit" variant="outline" disabled={isPending}>
            Hochladen
          </Button>
        </form>
        <p className="text-xs text-gray-400">JPG, PNG oder WebP, höchstens 3 MB. Am besten quadratisch.</p>
      </div>

      {!istInhaber && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-700 text-[#1C244B]">{status === "aktiv" ? "Aktiv" : "Inaktiv"}</p>
            <p className="text-xs text-gray-500">
              Inaktiv: nicht mehr auf der Webseite, keine neuen Anfragen, Login gesperrt. Daten bleiben erhalten.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              los(() => lehrpersonStatus(id, status !== "aktiv"), status === "aktiv" ? "Deaktiviert." : "Aktiviert.")
            }
          >
            {status === "aktiv" ? "Deaktivieren" : "Aktivieren"}
          </Button>
        </div>
      )}

      {meldung && <p className={`text-sm ${meldung.ok ? "text-emerald-600" : "text-red-600"}`}>{meldung.text}</p>}
    </div>
  );
}
