/**
 * Zeigt einfach formatierten Text (für Leitbild und Profiltexte).
 *
 * Unterstützt das Nötigste, ohne HTML zu erlauben:
 *   ## Überschrift
 *   - Aufzählung
 *   **fett** und *kursiv*
 *   Leerzeile = neuer Absatz
 *
 * Gebaut aus React-Elementen statt mit `dangerouslySetInnerHTML`. So kann
 * kein eingegebener Text Code auf der Seite ausführen.
 */
export default function EinfacherText({ text, className = "" }: { text: string; className?: string }) {
  const bloecke = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={`space-y-3 ${className}`}>
      {bloecke.map((block, i) => {
        const zeilen = block.split("\n").filter((z) => z.trim() !== "");
        if (zeilen.length === 0) return null;
        if (zeilen.length === 1 && /^#{1,3}\s/.test(zeilen[0])) {
          return (
            <h3 key={i} className="text-lg font-800 text-navy-900 pt-2">
              {inline(zeilen[0].replace(/^#{1,3}\s/, ""))}
            </h3>
          );
        }
        if (zeilen.every((z) => /^\s*[-*]\s/.test(z))) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {zeilen.map((z, j) => (
                <li key={j}>{inline(z.replace(/^\s*[-*]\s/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="leading-relaxed">
            {zeilen.map((z, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(z)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function inline(s: string): React.ReactNode[] {
  const teile: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let letzte = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s))) {
    if (m.index > letzte) teile.push(s.slice(letzte, m.index));
    const t = m[0];
    teile.push(
      t.startsWith("**") ? <strong key={k++}>{t.slice(2, -2)}</strong> : <em key={k++}>{t.slice(1, -1)}</em>
    );
    letzte = m.index + t.length;
  }
  if (letzte < s.length) teile.push(s.slice(letzte));
  return teile;
}
