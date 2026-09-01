"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Home, RotateCcw, AlertTriangle } from "lucide-react";

/**
 * Wenn beim Rendern etwas schiefgeht.
 *
 * Anders als die 404 ist das hier kein erwarteter Zustand, sondern ein
 * Fehler — und der Unterschied gehört auf den Bildschirm. „Nicht gefunden"
 * heisst: Du bist falsch. „Etwas ist schiefgelaufen" heisst: Ich bin schuld,
 * probier es nochmal.
 *
 * Der technische Grund bleibt bewusst unsichtbar. Ein Stack-Trace hilft dem
 * Besucher nicht und verrät Interna; in der Konsole und in Vercels Protokoll
 * steht er ohnehin.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Damit der Fehler in Vercels Runtime-Logs auftaucht statt nur im
    // Browser des Besuchers, wo ihn nie jemand sieht.
    console.error("[seite] Renderfehler:", error);
  }, [error]);

  return (
    <section className="flex-1 flex items-center justify-center px-4 py-24">
      <div className="max-w-lg text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-7 h-7 text-amber-600" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-800 text-navy-900">
          Da ist etwas schiefgelaufen
        </h1>
        <p className="text-gray-600 mt-3 leading-relaxed">
          Nicht deine Schuld. Versuch es nochmal — bleibt es dabei, schreib mir
          kurz, dann schaue ich mir das an.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 justify-center mt-7">
          <button
            onClick={reset}
            className="press inline-flex items-center justify-center gap-2 bg-navy-900 text-white text-sm font-600 px-5 py-3 rounded-xl hover:bg-[#2A3563] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Nochmal versuchen
          </button>
          <Link
            href="/"
            className="press inline-flex items-center justify-center gap-2 border border-gray-200 text-navy-900 text-sm font-600 px-5 py-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            Zur Startseite
          </Link>
        </div>

        {/* Die Kennung ist das Einzige, was dem Besucher zu zeigen sich
            lohnt: Damit findet man den Fehler im Protokoll wieder. */}
        {error.digest && (
          <p className="text-xs text-gray-400 mt-8 tabular-nums">
            Kennung: {error.digest}
          </p>
        )}
      </div>
    </section>
  );
}
