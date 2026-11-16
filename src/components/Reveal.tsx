"use client";

import { useEffect, useRef } from "react";

/**
 * Blendet einen Abschnitt ein, sobald er in Sicht kommt.
 *
 * Drei Entscheidungen:
 *
 * **Ohne React-Zustand.** Die Sichtbarkeit wird direkt als Klasse am Element
 * gesetzt. Ein Zustand würde bei jedem Abschnitt einen Neuaufbau auslösen,
 * nur um eine CSS-Eigenschaft zu ändern, und React beschwert sich zu Recht
 * über `setState` im Effekt.
 *
 * **Nur einmal.** Wer zurückscrollt, soll nicht dieselbe Animation noch
 * einmal sehen; das wirkt billig und lenkt beim zweiten Lesen ab. Der
 * Beobachter hängt sich nach dem ersten Auslösen selbst aus.
 *
 * **Sichtbar, wenn kein JavaScript läuft.** Der Ausgangszustand im Markup ist
 * sichtbar. Versteckt wird erst, wenn der Effekt läuft. Sonst bliebe die
 * Seite ohne JavaScript leer, und das wäre ein hoher Preis für eine
 * Verzierung.
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  /** Versatz in Millisekunden, für gestaffelte Reihen. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Wer „Bewegung reduzieren" eingestellt hat, bekommt den Inhalt ohne
    // Zutun. Ihn erst beim Scrollen erscheinen zu lassen wäre auch Bewegung.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    el.style.transition =
      "opacity 600ms var(--ease-out-soft), transform 600ms var(--ease-out-soft)";
    el.style.transitionDelay = `${delay}ms`;
    el.style.opacity = "0";
    el.style.transform = "translateY(16px)";

    const zeigen = () => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    };

    // Steht der Abschnitt beim Laden schon im Bild, sofort zeigen. Sonst
    // bliebe er unsichtbar, bis jemand scrollt. Auf grossen Bildschirmen
    // trifft das den zweiten Abschnitt regelmässig.
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        for (const e of eintraege) {
          if (e.isIntersecting) {
            zeigen();
            beobachter.unobserve(e.target);
          }
        }
      },
      // Ausgelöst wird, sobald die Oberkante 12 % in den Bildschirm gerückt
      // ist, nicht bei einem Anteil des Abschnitts.
      //
      // Vorher stand hier `threshold: 0.15`: Es mussten 15 % der Fläche des
      // Abschnitts gleichzeitig sichtbar sein. Am Handy ist der Abschnitt mit
      // den Bewertungen und sieben Videos über sechsmal so hoch wie der
      // Bildschirm, 15 % davon passen nie gleichzeitig hinein. Er blieb
      // unsichtbar, samt Videos (David, 16. November 2026). Der Rand unten
      // sorgt weiterhin dafür, dass der Abschnitt angekommen ist, bevor er
      // sich bewegt.
      { threshold: 0, rootMargin: "0px 0px -12% 0px" }
    );

    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
