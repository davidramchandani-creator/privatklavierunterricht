"use client";

import { useEffect, useRef } from "react";
import type { Analyse } from "@/lib/audio-analyse";

/**
 * Klaviatur, deren Tasten sich zum Klang bewegen.
 *
 * Warum eine Klaviatur und keine Balken: Balken sind das, was jeder
 * Musikspieler zeigt. Hier geht es um Klavierunterricht, dieselbe Bewegung
 * auf Tasten übertragen sagt sofort, worum es geht, und greift das
 * Tastatur-Motiv aus dem Hero auf.
 *
 * Zwei Dinge, die den Aufbau bestimmen:
 *
 * **Gezeichnet wird ausserhalb von React.** 60 Bilder je Sekunde durch den
 * Zustand zu schicken hiesse 60 Neuaufbauten je Sekunde, für eine
 * Verzierung. Die Tasten werden direkt am Element angefasst.
 *
 * **Schwarze Tasten sind Deko.** Sie liegen nicht auf eigenen Frequenzen,
 * sondern zwischen den weissen, sie mitzurechnen ergäbe eine Klaviatur, auf
 * der die Halbtöne zufällig zucken. Sie bewegen sich mit ihren Nachbarn.
 */
export default function Klaviatur({
  analyse,
  laeuft,
  tasten = 14,
  className = "",
}: {
  analyse: Analyse | null;
  laeuft: boolean;
  tasten?: number;
  className?: string;
}) {
  const weisse = useRef<(HTMLSpanElement | null)[]>([]);
  const schwarze = useRef<(HTMLSpanElement | null)[]>([]);
  /** Zu welcher weissen Taste jede schwarze gehört. */
  const nachbarn = useRef<(number | null)[]>([]);

  useEffect(() => {
    if (!laeuft || !analyse) {
      // Zurück in die Ruhelage, damit keine Taste gedrückt stehen bleibt.
      for (const t of weisse.current) if (t) t.style.transform = "";
      for (const t of schwarze.current) if (t) t.style.transform = "";
      for (const t of weisse.current) if (t) t.style.backgroundColor = "";
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let bild = 0;
    const zeichnen = () => {
      const werte = analyse.lesen(tasten);

      for (let i = 0; i < tasten; i++) {
        const el = weisse.current[i];
        if (!el) continue;
        const w = werte[i];
        // Höchstens 3 px, eine Taste, die einen Zentimeter einsinkt, sieht
        // nach Fehler aus, nicht nach Anschlag.
        el.style.transform = `translateY(${(w * 3).toFixed(2)}px)`;
        // Der Farbanteil macht die Bewegung auch dann sichtbar, wenn die
        // Taste nur wenige Zehntel wandert.
        el.style.backgroundColor =
          w > 0.04 ? `rgba(28, 36, 75, ${(w * 0.32).toFixed(3)})` : "";
      }

      // Schwarze Tasten folgen dem Mittel ihrer beiden Nachbarn.
      //
      // Der Nachbar wird über `nachbarn` nachgeschlagen, nicht aus dem
      // Zählindex gerechnet. Beim ersten Versuch stand hier eine Rechnung
      // über SCHWARZ_NACH, die nur in der ersten Oktave stimmte. Ab der
      // zweiten reagierten die Halbtöne auf die Frequenzen der ersten.
      for (let k = 0; k < schwarze.current.length; k++) {
        const el = schwarze.current[k];
        const weiss = nachbarn.current[k];
        if (!el || weiss == null) continue;
        const links = werte[weiss] ?? 0;
        const rechts = werte[weiss + 1] ?? links;
        el.style.transform = `translateY(${(((links + rechts) / 2) * 2.4).toFixed(2)}px)`;
      }

      bild = requestAnimationFrame(zeichnen);
    };

    bild = requestAnimationFrame(zeichnen);
    return () => cancelAnimationFrame(bild);
  }, [analyse, laeuft, tasten]);

  return (
    <div
      className={`relative flex items-start gap-[2px] ${className}`}
      aria-hidden
    >
      {Array.from({ length: tasten }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            weisse.current[i] = el;
          }}
          className="flex-1 h-full rounded-b-[3px] bg-white ring-1 ring-navy-100"
          style={{ transition: "background-color 90ms linear" }}
        />
      ))}

      {/* Schwarze Tasten liegen über den Fugen der weissen. */}
      <div className="absolute inset-x-0 top-0 h-[62%] flex pointer-events-none">
        {Array.from({ length: tasten }).map((_, i) => {
          const zeigen = SCHWARZ_NACH.includes(i % 7);
          return (
            <div key={i} className="flex-1 relative">
              {zeigen && i < tasten - 1 && (
                <span
                  ref={(el) => {
                    const k = SCHWARZ_NACH.indexOf(i % 7) + Math.floor(i / 7) * 5;
                    schwarze.current[k] = el;
                    nachbarn.current[k] = i;
                  }}
                  className="absolute top-0 right-0 translate-x-1/2 w-[58%] h-full rounded-b-[2px] bg-navy-900"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Nach welchen weissen Tasten eine schwarze folgt, C, D, F, G, A.
 * Nach E und H gibt es keine, das ist die Eigenart der Klaviatur.
 */
const SCHWARZ_NACH = [0, 1, 3, 4, 5];
