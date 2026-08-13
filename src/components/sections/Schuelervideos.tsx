"use client";

import { useState } from "react";
import Schuelervideo from "@/components/Schuelervideo";
import { SCHUELERVIDEOS } from "@/lib/schuelervideos";

/**
 * Die Videos innerhalb des Bewertungsabschnitts.
 *
 * Bewusst kein eigener Abschnitt mit eigener Überschrift: Zitate und Videos
 * beantworten dieselbe Frage — „funktioniert das bei anderen?". Zwei
 * getrennte Abschnitte hintereinander würden sie doppelt stellen.
 *
 * Ist die Liste leer, verschwindet der Block vollständig. Ein „Videos folgen
 * bald" ist ein Versprechen, an das sich später niemand erinnert.
 */
export default function Schuelervideos() {
  const [aktiv, setAktiv] = useState<string | null>(null);

  if (SCHUELERVIDEOS.length === 0) return null;

  return (
    <div className="mt-14">
      <p className="text-sm font-600 text-gray-400 uppercase tracking-widest mb-3">
        Aus dem Unterricht
      </p>
      {/*
        Der eigentliche Satz. Ohne ihn sind es vier Leute, die Klavier
        spielen — mit ihm ist es der Beweis, dass fünf Wochen reichen.
        Der Zusatz „eine Lektion pro Woche" ist nicht schmückend: Ohne ihn
        könnte „nach 5 Wochen" auch einen Intensivkurs meinen, und genau die
        Vermutung entwertet die Aufnahmen.
      */}
      <p className="text-lg text-gray-500 leading-relaxed max-w-2xl mb-6">
        Keiner der vier hatte vorher je am Klavier gesessen. Eine Lektion pro
        Woche, mehr nicht.
      </p>
      {/*
        Bei vier Videos zwei Spalten statt drei: Drei nebeneinander liessen
        das vierte allein in einer zweiten Zeile stehen.
      */}
      <div
        className={`grid gap-6 ${
          SCHUELERVIDEOS.length === 1
            ? "max-w-2xl"
            : SCHUELERVIDEOS.length === 2 || SCHUELERVIDEOS.length === 4
              ? "sm:grid-cols-2"
              : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {SCHUELERVIDEOS.map((v) => (
          <Schuelervideo
            key={v.id}
            video={v}
            laeuft={aktiv === v.id}
            onStart={() => setAktiv(v.id)}
            onStopp={() => setAktiv((a) => (a === v.id ? null : a))}
          />
        ))}
      </div>
    </div>
  );
}
