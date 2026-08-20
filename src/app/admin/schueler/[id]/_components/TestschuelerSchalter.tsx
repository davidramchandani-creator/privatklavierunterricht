"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2 } from "lucide-react";
import { testschuelerMarkieren } from "@/app/admin/testmodus/actions";

/**
 * Ein echtes Konto zum Testschüler machen.
 *
 * Der Weg, um eine Runde allein durchzuspielen: Probelauf schreibt genau die
 * Testschüler an, und zwar an ihre echte Adresse. Wer sehen will, was bei den
 * Schülern ankommt, markiert dafür ein eigenes Konto.
 *
 * Der Warnhinweis steht bewusst da, wo geklickt wird, und nicht in einer
 * Anleitung: „Testdaten entfernen" löscht Testschüler samt Login, und das
 * wäre bei einem echten Konto eine böse Überraschung.
 */
export default function TestschuelerSchalter({
  studentId,
  istTest,
}: {
  studentId: string;
  istTest: boolean;
}) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function umschalten() {
    if (
      !istTest &&
      !confirm(
        "Diesen Schüler als Testschüler markieren?\n\nEr fällt damit aus echten Runden, aus der Routenplanung und aus der Zuteilung heraus. Mails bekommt er weiterhin an seine echte Adresse.\n\nAchtung: „Testdaten entfernen“ löscht Testschüler vollständig, samt Login."
      )
    ) {
      return;
    }
    setFehler(null);
    starte(async () => {
      const res = await testschuelerMarkieren(studentId, !istTest);
      if (res.error) {
        setFehler(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={umschalten}
        disabled={laeuft}
        className={`press inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg border transition-colors disabled:opacity-40 ${
          istTest
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-gray-200 text-gray-500 hover:text-gray-800"
        }`}
      >
        {laeuft ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FlaskConical className="w-3.5 h-3.5" />
        )}
        {istTest ? "Testschüler, zurückholen" : "Als Testschüler markieren"}
      </button>

      {istTest && (
        <p className="text-xs text-amber-700 mt-1.5 leading-snug max-w-sm">
          Zählt in echten Runden nicht mit. Ein Probelauf schreibt genau ihn an.
        </p>
      )}
      {fehler && <p className="text-xs text-red-600 mt-1.5">{fehler}</p>}
    </div>
  );
}
