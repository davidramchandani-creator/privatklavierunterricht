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
        mit ihm ist es der Beweis, dass es schnell geht.

        Zweimal musste er schon nachgeben, beide Male aus demselben Grund:
        Er behauptete etwas über eine Liste, die sich ändert. Erst „Keiner
        der vier", das mit dem fünften Video falsch wurde. Dann „Eine
        Lektion pro Woche, mehr nicht", das mit Marina falsch wurde, denn
        sie kommt alle zwei Wochen und spielt seit einem Jahr.

        Deshalb sagt er jetzt nur noch, was für alle gilt, und verweist für
        den Rest auf die Zeile über jeder Aufnahme. Was dort steht, pflegt
        man beim Eintragen des Videos, und man sieht dabei genau die eine
        Karte vor sich.
      */}
      <p className="text-lg text-gray-500 leading-relaxed max-w-2xl mb-6">
        Alle haben bei null angefangen. Über jeder Aufnahme steht, wie weit
        sie zu diesem Zeitpunkt waren.
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
