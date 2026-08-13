/**
 * Kopfbereich eines Abschnitts — Kicker, Überschrift, Einleitung.
 *
 * Vorher stand dieselbe Struktur viermal im Quelltext, und die Kopien waren
 * bereits auseinandergelaufen: die alten Abschnitte zentriert mit grauem
 * Kicker, der neue Hörproben-Kopf linksbündig mit blauem. Genau so entsteht
 * der Eindruck, eine Seite sei aus Teilen zusammengesetzt.
 *
 * **Linksbündig, nicht zentriert.** Zentrierte Überschriften über linksbündigem
 * Inhalt sind der Standardlook jeder Vorlage. Für die gewählte Richtung —
 * hell, luftig, editorial — beginnt Text an einer gemeinsamen Kante; das Auge
 * findet den Zeilenanfang, ohne ihn zu suchen.
 *
 * **Breite auf `max-w-2xl` begrenzt.** Über etwa 70 Zeichen je Zeile wird
 * Lesen mühsam, weil der Rücksprung zur nächsten Zeile misslingt.
 */
export default function AbschnittsKopf({
  kicker,
  titel,
  text,
  className = "",
}: {
  kicker: string;
  titel: React.ReactNode;
  text?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-w-2xl ${className}`}>
      <p className="text-navy-600 font-600 text-xs uppercase tracking-widest mb-3">
        {kicker}
      </p>
      <h2 className="text-3xl sm:text-4xl font-800 text-navy-900 tracking-tight leading-[1.15]">
        {titel}
      </h2>
      {text && (
        <p className="text-lg text-gray-500 leading-relaxed mt-4">{text}</p>
      )}
    </div>
  );
}
