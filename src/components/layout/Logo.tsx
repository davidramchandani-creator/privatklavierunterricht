/**
 * Marken-Logo (Wortmarke „PIANO", aus Klaviertasten gebaut).
 * Das SVG ist schwarz; auf dunklen Flächen `invert` setzen, damit es weiss wird.
 *
 * `withText` blendet rechts daneben „privatklavierunterricht" ein.
 * Die Textfarbe folgt `currentColor` – die aufrufende Komponente steuert sie
 * also über die Text-Klasse (z. B. `text-navy-900` oder `text-white`).
 */
export default function Logo({
  className = "",
  invert = false,
  withText = false,
  textClassName = "",
}: {
  className?: string;
  invert?: boolean;
  withText?: boolean;
  textClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Ueberschrift-hinzufuegen-4.svg"
        alt="Privatklavierunterricht – David Ramchandani"
        className={`${className} ${invert ? "[filter:brightness(0)_invert(1)]" : ""}`.trim()}
      />
      {withText && (
        <span
          className={`font-700 tracking-tight leading-none lowercase ${textClassName}`.trim()}
        >
          privatklavierunterricht
        </span>
      )}
    </span>
  );
}
