import { FLOWKEY } from "@/lib/flowkey";

/**
 * Das offizielle flowkey-Logo, nach den Brand Guidelines:
 * - unverändert (Originaldatei, keine Farbe, keine Transparenz, keine Drehung)
 * - Seitenverhältnis fest aus der Originaldatei
 * - rundherum ein Drittel der Logohöhe Freiraum (als Padding eingebaut)
 * - orange auf hellem, weiss auf dunklem Grund
 *
 * Nie mitten in einem Satz verwenden, nur als eigenständiges Element.
 */
export default function FlowkeyLogo({
  hoehe = 40,
  hell = false,
  className = "",
}: {
  /** Höhe des Logos in Pixel, ohne Freiraum. */
  hoehe?: number;
  /** Auf dunklem Hintergrund: weisses Logo. */
  hell?: boolean;
  className?: string;
}) {
  const freiraum = Math.round(hoehe / 3);
  const breite = Math.round(hoehe * FLOWKEY.logo.verhaeltnis);
  return (
    <span className={`inline-block ${className}`} style={{ padding: freiraum }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hell ? FLOWKEY.logo.weiss : FLOWKEY.logo.orange}
        alt="flowkey"
        width={breite}
        height={hoehe}
        style={{ width: breite, height: hoehe }}
      />
    </span>
  );
}
