"use client";

import { useEffect, useRef } from "react";
import { SCHUELERVIDEOS } from "@/lib/schuelervideos";

/**
 * Der Weg von „nie gespielt" bis zum ersten Stück.
 *
 * Eine Zeitachse über die Unterrichtswochen. Sobald sie ins Bild kommt,
 * zieht sich die Linie von links nach rechts, und unterwegs setzt sie die
 * Schüler als Punkte — jeden in der Woche, in der seine Aufnahme entstand.
 *
 * **Warum die Bewegung hier etwas beiträgt.** Eine fertig gezeichnete Achse
 * ist eine Behauptung; eine, die vor den Augen entsteht, ist ein Verlauf. Die
 * Aussage lautet „Woche für Woche kommt etwas dazu", und genau das tut die
 * Linie. Sie ist die einzige Animation auf der Seite, die nicht schmückt,
 * sondern denselben Satz sagt wie der Text daneben.
 *
 * **Warum sie ehrlich bleibt.** Die Punkte sitzen dort, wo die Aufnahmen
 * tatsächlich entstanden sind — 4, 5, 5 und 6. Sie bilden eine Traube, keine
 * saubere Treppe. Eine Treppe wäre hübscher und gelogen: Es gibt kein Video
 * aus Woche 1, und so zu tun, als führe die Linie durch belegte Punkte,
 * hiesse Beweise zu behaupten, die nicht vorliegen.
 *
 * **Warum ohne React-Zustand und ohne Animationsschleife.** Der Ablauf ist
 * eine einzige CSS-Übergang von Breite 0 auf 100 %; die Punkte hängen mit
 * `transition-delay` daran, anteilig zu ihrer Woche. Das kostet nichts,
 * läuft flüssig auch auf alten Telefonen und braucht keinen Neuaufbau.
 */

const DAUER_MS = 1900;

export default function Fortschrittsweg() {
  const ref = useRef<HTMLDivElement | null>(null);

  const wochen = SCHUELERVIDEOS.map((v) => v.woche);
  const maxWoche = Math.max(...wochen, 1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const starten = () => el.setAttribute("data-los", "1");

    // Wer „Bewegung reduzieren" eingestellt hat, sieht den Endzustand sofort.
    // Ihn erst entstehen zu lassen wäre auch Bewegung.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      starten();
      return;
    }

    const beobachter = new IntersectionObserver(
      (eintraege) => {
        for (const e of eintraege) {
          if (e.isIntersecting) {
            starten();
            beobachter.unobserve(e.target);
          }
        }
      },
      { threshold: 0.4 },
    );
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="mt-10 mb-12"
      data-los="0"
      style={{ "--weg-dauer": `${DAUER_MS}ms` } as React.CSSProperties}
    >
      {/* Die beiden Enden benennen, was der Weg überbrückt. */}
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <p className="text-xs sm:text-sm font-600 text-gray-400 uppercase tracking-widest">
          Nie gespielt
        </p>
        <p className="text-xs sm:text-sm font-600 text-navy-900 uppercase tracking-widest text-right">
          Ein Stück, beidhändig
        </p>
      </div>

      <div className="relative h-16">
        {/* Ungefüllte Achse */}
        <div className="absolute left-0 right-0 top-3 h-[3px] rounded-full bg-[#E6E9EF]" />

        {/*
          Die Füllung. Breite 0 → 100 %, sonst passiert hier nichts. Die
          Wochenstriche liegen darüber und bleiben stehen; nur die Farbe
          wandert.
        */}
        <div className="weg-fuellung absolute left-0 top-3 h-[3px] rounded-full bg-navy-900" />

        {/* Wochenstriche – einer je Lektion. Sie machen sichtbar, dass der
            Weg aus gleich grossen Schritten besteht. */}
        {Array.from({ length: maxWoche + 1 }, (_, i) => (
          // Strich und Zahl unterschiedlich breit, deshalb beide über
          // `items-center` auf dieselbe Mitte gelegt und erst der ganze Block
          // um die halbe Breite versetzt. Zwei getrennte Verschiebungen
          // würden die Zahl ein zweites Mal nach links rücken.
          <div
            key={`strich-${i}`}
            className="absolute top-3 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${(i / maxWoche) * 100}%` }}
          >
            <div className="w-px h-2 bg-[#D3D8E2] mt-[3px]" />
            <p className="mt-1.5 text-[11px] text-gray-400 tabular-nums">
              {i === 0 ? "" : i}
            </p>
          </div>
        ))}

        {/*
          Die Schüler. Erscheinen genau dann, wenn die Linie sie erreicht —
          `transition-delay` anteilig zur Woche. Ein Punkt, der vor der Linie
          da ist, nimmt ihr die Aussage.
        */}
        {SCHUELERVIDEOS.map((v, i) => {
          const anteil = v.woche / maxWoche;
          // Mehrere in derselben Woche würden sich decken. Der zweite rückt
          // nach oben statt zur Seite: Die Woche muss stimmen, die Höhe nicht.
          const gleicheWocheDavor = SCHUELERVIDEOS.slice(0, i).filter(
            (a) => a.woche === v.woche,
          ).length;
          return (
            <div
              key={v.id}
              className="absolute -translate-x-1/2"
              style={{
                left: `${anteil * 100}%`,
                top: `${6 - gleicheWocheDavor * 14}px`,
              }}
            >
              <span
                className="weg-punkt block w-3 h-3 rounded-full bg-navy-900 ring-4 ring-white"
                style={{ transitionDelay: `${Math.round(anteil * DAUER_MS)}ms` }}
                aria-hidden
              />
            </div>
          );
        })}
      </div>

      <p className="text-sm text-gray-400 mt-1">
        Unterrichtswochen — eine Lektion pro Woche
      </p>

      {/* Für Screenreader: Die Achse ist ein Bild, die Aussage muss auch als
          Satz vorliegen. */}
      <p className="sr-only">
        {SCHUELERVIDEOS.map((v) => `${v.name} spielte ${v.titel} in Woche ${v.woche}.`).join(" ")}
      </p>
    </div>
  );
}
