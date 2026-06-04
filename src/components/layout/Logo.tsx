/**
 * Marken-Logo (Wortmarke „PIANO", aus Klaviertasten gebaut).
 * Das SVG ist schwarz; auf dunklen Flächen `invert` setzen, damit es weiss wird.
 */
export default function Logo({
  className = "",
  invert = false,
}: {
  className?: string;
  invert?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/Ueberschrift-hinzufuegen-4.svg"
      alt="Privatklavierunterricht – David Ramchandani"
      className={`${className} ${invert ? "[filter:brightness(0)_invert(1)]" : ""}`.trim()}
    />
  );
}
