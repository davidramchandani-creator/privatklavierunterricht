import { BILDMARKE_PFAD, BILDMARKE_VIEWBOX, LOGO, MARKE } from "@/lib/marke";

/**
 * Das Logo „clavis“: Wortmarke, in der das a ein Flügel von oben ist, und
 * darunter wahlweise der Zusatz „KLAVIERSCHULE“.
 *
 * Ein einziges SVG aus Umrissen, ohne Schrift und ohne Bilddatei. Die Farbe
 * folgt `currentColor`: Die aufrufende Stelle setzt `text-navy-900` auf
 * hellem Grund oder `text-white` auf Navy. Andere Farben sind nicht
 * vorgesehen, kein Gold und kein Filter.
 *
 * Die Grösse kommt über `className` (z. B. `h-7 w-auto`). Ohne Zusatz ist
 * die Höhe die der Buchstaben, mit Zusatz reicht sie bis unter den Zusatz.
 *
 * Auf kleinen Flächen (Handy-Navbar, Admin, Portal) ohne Zusatz: Er wäre
 * dort zu klein zum Lesen.
 */
export default function Logo({
  className = "h-7 w-auto",
  withTagline = false,
}: {
  className?: string;
  /** Den Zusatz „KLAVIERSCHULE“ unter der Wortmarke zeigen. */
  withTagline?: boolean;
}) {
  const unten = withTagline ? LOGO.untenMit : LOGO.untenOhne;
  return (
    <svg
      viewBox={`0 ${LOGO.oben} ${LOGO.breite} ${unten - LOGO.oben}`}
      className={className}
      fill="currentColor"
      role="img"
      aria-label={MARKE.voll}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={LOGO.wortmarke} />
      <g transform={LOGO.bildmarkeTransform}>
        <path d={BILDMARKE_PFAD} fillRule="evenodd" />
      </g>
      {withTagline && <path d={LOGO.zusatz} />}
    </svg>
  );
}

/**
 * Nur der Flügel, für Stellen, an denen kein Platz für den Namen ist oder
 * der Name schon daneben steht. Rein schmückend, darum ohne Beschriftung.
 */
export function Bildmarke({ className = "h-5 w-auto" }: { className?: string }) {
  return (
    <svg
      viewBox={BILDMARKE_VIEWBOX}
      className={className}
      fill="currentColor"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={BILDMARKE_PFAD} fillRule="evenodd" />
    </svg>
  );
}
