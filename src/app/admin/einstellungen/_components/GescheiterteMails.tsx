"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw, X, MailWarning } from "lucide-react";
import {
  mailErneutVersuchen,
  mailVerwerfen,
  alleMailsVerwerfen,
} from "@/app/admin/actions";

export type GescheiterteMail = {
  id: string;
  typ: string;
  empfaenger: string | null;
  geplant: string;
  versuche: number;
};

/**
 * Die Mails, die endgültig nicht angekommen sind.
 *
 * Der Warnstreifen im Admin zeigte ihre Zahl und verlinkte hierher — nur
 * stand hier nichts. Man klickte „Ansehen", fand keine Liste und wurde den
 * Streifen nicht mehr los. Er blieb wegen fünf Fehlschlägen aus dem Juni
 * stehen, die längst niemanden mehr betrafen.
 *
 * Zwei Wege heraus, und beide braucht es:
 *
 *   **Erneut versuchen** für den Fall, dass die Ursache behoben ist —
 *   etwa eine QR-Rechnung, die jetzt als TWINT rausgeht.
 *
 *   **Verwerfen** für alles, was nur noch Geschichte ist. Die Zeile wird
 *   nicht gelöscht, sondern auf „abgebrochen" gesetzt: Der Beleg, dass hier
 *   etwas nicht ankam, bleibt erhalten.
 */
export default function GescheiterteMails({
  mails,
}: {
  mails: GescheiterteMail[];
}) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function fuehreAus(id: string, fn: () => Promise<unknown>) {
    setLaeuft(id);
    startTransition(async () => {
      await fn();
      setLaeuft(null);
      router.refresh();
    });
  }

  if (mails.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-5">
        <h2 className="font-700 text-[#1C244B] mb-1">Nicht zugestellte Mails</h2>
        <p className="text-sm text-gray-500">
          Keine. Alles, was verschickt werden sollte, ist auch angekommen.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-700 text-[#1C244B] inline-flex items-center gap-2">
            <MailWarning className="w-4 h-4 text-amber-600" />
            {mails.length} Mail{mails.length === 1 ? "" : "s"} nicht zugestellt
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Nach drei Versuchen aufgegeben. Die Empfänger haben nichts bekommen.
          </p>
        </div>
        <button
          onClick={() => fuehreAus("alle", () => alleMailsVerwerfen())}
          disabled={laeuft !== null}
          className="press shrink-0 text-xs font-600 text-gray-600 hover:text-gray-900 underline disabled:opacity-40"
        >
          {laeuft === "alle" ? "…" : "Alle verwerfen"}
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {mails.map((m) => (
          <div
            key={m.id}
            className="py-3 flex items-center justify-between gap-4 first:pt-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-600 text-gray-900 truncate">{m.typ}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {m.empfaenger ?? "kein Empfänger"}
                <span className="mx-1.5 text-gray-300">·</span>
                {m.geplant}
                <span className="mx-1.5 text-gray-300">·</span>
                {m.versuche} Versuche
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => fuehreAus(m.id, () => mailErneutVersuchen(m.id))}
                disabled={laeuft !== null}
                title="Erneut versuchen"
                className="press w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
              >
                {laeuft === m.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCw className="w-3.5 h-3.5 text-gray-600" />
                )}
              </button>
              <button
                onClick={() => fuehreAus(m.id, () => mailVerwerfen(m.id))}
                disabled={laeuft !== null}
                title="Verwerfen"
                className="press w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
              >
                <X className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
