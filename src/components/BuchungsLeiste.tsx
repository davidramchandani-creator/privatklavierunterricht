"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";

/**
 * Mitlaufende Buchungsleiste am unteren Rand — nur auf dem Handy.
 *
 * Zwischen Hero und Schlussaufruf liegen vier Abschnitte ohne einen einzigen
 * Weg zur Probelektion. Wer dort überzeugt wird, muss scrollen, um etwas zu
 * tun — und ein Teil tut es dann nicht.
 *
 * Drei Regeln, damit die Leiste hilft statt nervt:
 *
 * **Erst nach dem Hero.** Solange der grosse Knopf im Hero sichtbar ist,
 * wäre sie eine doppelte Aufforderung an derselben Stelle.
 *
 * **Weg, sobald der Schlussaufruf da ist.** Sonst stünden zwei
 * Probelektions-Knöpfe übereinander, und der untere verdeckt den oberen.
 *
 * **Nur auf dem Handy.** Am Desktop steht der Knopf ohnehin dauerhaft in der
 * Navigation; eine zweite Leiste wäre dort nur im Weg.
 */
export default function BuchungsLeiste({
  naechsterTermin,
}: {
  naechsterTermin: string | null;
}) {
  const [sichtbar, setSichtbar] = useState(false);
  // Rastet ein, sobald der Schlussaufruf erreicht wurde – und bleibt so.
  //
  // Beim ersten Versuch stand hier ein Wert, der wieder auf „nicht versteckt"
  // zurücksprang, sobald der Schlussaufruf nach oben aus dem Bild lief. Beim
  // Weiterscrollen zur Fusszeile wäre die Leiste dort erneut aufgetaucht und
  // hätte die Links darin verdeckt. Wer den Schlussaufruf gesehen hat,
  // braucht die Leiste nicht mehr.
  const erledigt = useRef(false);

  useEffect(() => {
    // Der Schlussaufruf meldet sich selbst an: sobald er ins Bild kommt,
    // zieht sich die Leiste zurück.
    const ziel = document.getElementById("probelektion-cta");

    const beobachter = ziel
      ? new IntersectionObserver(
          (eintraege) => {
            if (eintraege.some((e) => e.isIntersecting)) {
              erledigt.current = true;
              setSichtbar(false);
              beobachter?.disconnect();
            }
          },
          { threshold: 0.1 }
        )
      : null;
    if (ziel && beobachter) beobachter.observe(ziel);

    // 70 % der Bildschirmhöhe: weit genug, dass der Hero durch ist, nah
    // genug, dass die Leiste da ist, sobald man wirklich liest.
    const schwelle = () => window.innerHeight * 0.7;

    const pruefen = () => {
      if (erledigt.current) return;
      setSichtbar(window.scrollY > schwelle());
    };

    pruefen();
    window.addEventListener("scroll", pruefen, { passive: true });
    return () => {
      window.removeEventListener("scroll", pruefen);
      beobachter?.disconnect();
    };
  }, []);

  return (
    <div
      className={`md:hidden fixed bottom-0 inset-x-0 z-40 transition-transform duration-300 ${
        sichtbar ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ transitionTimingFunction: "var(--ease-out-soft)" }}
      // Ausserhalb des Bildes für Screenreader unsichtbar – sonst läge ein
      // Knopf im Fokusweg, den man gar nicht sieht.
      aria-hidden={!sichtbar}
    >
      <div className="bg-navy-900 border-t border-white/10 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <Link
          href="/probelektion"
          tabIndex={sichtbar ? 0 : -1}
          className="flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="min-w-0">
            <p className="text-white font-700 text-sm">Probelektion buchen</p>
            <p className="text-white/55 text-xs truncate">
              {naechsterTermin
                ? `Nächster freier Termin: ${naechsterTermin}`
                : "Unverbindlich · kein Abo nötig"}
            </p>
          </div>
          <span className="flex-shrink-0 bg-white text-navy-900 font-700 text-sm rounded-xl px-4 py-2.5 inline-flex items-center gap-1.5">
            <CalendarCheck className="w-4 h-4" />
            Termin
          </span>
        </Link>
      </div>
    </div>
  );
}
