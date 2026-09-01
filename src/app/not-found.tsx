import Link from "next/link";
import type { Metadata } from "next";
import { Home, Piano, Mail } from "lucide-react";

/**
 * Die Seite für Adressen, die es nicht (mehr) gibt.
 *
 * Ohne diese Datei liefert Next.js seine eigene Standardseite: schwarzer
 * Hintergrund, englischer Text, kein Weg zurück. Bei einer Seite mit
 * Umzugsgeschichte ist das keine Randerscheinung — die alten
 * WordPress-Adressen sind bei Google indexiert, stehen in Lesezeichen und in
 * WhatsApp-Nachrichten an Eltern. `next.config.ts` fängt die bekannten davon
 * ab; alles andere landet hier.
 *
 * Darum steht hier nicht bloss „nicht gefunden", sondern der Weg weiter. Wer
 * eine Klavierlehrerseite sucht und auf einer Fehlermeldung landet, sucht
 * sonst weiter — bei jemand anderem.
 */

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  // Suchmaschinen sollen eine Fehlerseite nicht in den Index nehmen.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="flex-1 flex items-center justify-center px-4 py-24">
      <div className="max-w-lg text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-6">
          <Piano className="w-7 h-7 text-navy-900" />
        </div>

        <p className="text-sm font-600 text-gray-400 tracking-wide">404</p>
        <h1 className="text-2xl sm:text-3xl font-800 text-navy-900 mt-1">
          Diese Seite gibt es nicht mehr
        </h1>
        <p className="text-gray-600 mt-3 leading-relaxed">
          Vermutlich stammt der Link aus der alten Website. Der Unterricht gibt
          es weiterhin — nur die Adressen haben sich geändert.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 justify-center mt-7">
          <Link
            href="/"
            className="press inline-flex items-center justify-center gap-2 bg-navy-900 text-white text-sm font-600 px-5 py-3 rounded-xl hover:bg-[#2A3563] transition-colors"
          >
            <Home className="w-4 h-4" />
            Zur Startseite
          </Link>
          <Link
            href="/probelektion"
            className="press inline-flex items-center justify-center gap-2 border border-gray-200 text-navy-900 text-sm font-600 px-5 py-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Probelektion buchen
          </Link>
        </div>

        <p className="text-sm text-gray-500 mt-8">
          Etwas Bestimmtes gesucht?{" "}
          <Link
            href="/kontakt"
            className="inline-flex items-center gap-1 underline font-600 text-navy-900 hover:opacity-80"
          >
            <Mail className="w-3.5 h-3.5" />
            Schreib mir
          </Link>
        </p>
      </div>
    </section>
  );
}
