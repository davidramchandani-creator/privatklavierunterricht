"use client";

import { useState } from "react";
import Schuelervideo from "@/components/Schuelervideo";
import Reveal from "@/components/Reveal";
import { SCHUELERVIDEOS } from "@/lib/schuelervideos";

/**
 * Die Videos innerhalb des Bewertungsabschnitts.
 *
 * Bewusst kein eigener Abschnitt mit eigener Überschrift: Zitate und Videos
 * beantworten dieselbe Frage, „funktioniert das bei anderen?". Zwei
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
        Der eigentliche Satz. Ohne ihn sind es Leute, die Klavier spielen,
        mit ihm ist es der Beweis, dass wenige Wochen reichen.
        Der Zusatz „eine Lektion pro Woche" ist nicht schmückend: Ohne ihn
        könnte „nach 5 Wochen" auch einen Intensivkurs meinen, und genau die
        Vermutung entwertet die Aufnahmen.

        Hier stand einmal „Keiner der vier". Sobald ein fünftes Video
        dazukam, stimmte der Satz nicht mehr, und gemerkt hätte es niemand.
        Zahlen im Fliesstext, die von einer Liste daneben abhängen, veralten
        still. Deshalb jetzt ohne.
      */}
      <p className="text-lg text-gray-500 leading-relaxed max-w-2xl mb-6">
        Niemand hier hatte vorher je am Klavier gesessen. Eine Lektion pro
        Woche, mehr nicht.
      </p>

      {/*
        Hier stand eine animierte Zeitachse, die den Weg von „nie gespielt"
        bis zum ersten Stück gezeichnet hat. Sie ist wieder verschwunden,
        und der Grund ist lehrreich: Jede Karte trägt ihre Wochenzahl
        bereits. Die Achse hat dieselbe Auskunft ein zweites Mal gegeben,
        nur grösser und mit Bewegung. Genau das lässt einen Abschnitt
        überladen wirken, nicht die Menge an Gestaltung, sondern die
        Wiederholung derselben Aussage in zwei Formen.
      */}

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
        {SCHUELERVIDEOS.map((v, i) => (
          // Versetztes Einblenden. Nicht mehr als 90 ms je Karte: Darüber
          // wartet man auf die letzte, statt die erste anzusehen.
          <Reveal key={v.id} delay={i * 90}>
            <Schuelervideo
              video={v}
              laeuft={aktiv === v.id}
              onStart={() => setAktiv(v.id)}
              onStopp={() => setAktiv((a) => (a === v.id ? null : a))}
            />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
