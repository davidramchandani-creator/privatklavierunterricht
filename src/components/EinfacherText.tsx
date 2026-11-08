/**
 * Zeigt einfach formatierten Text (für Leitbild und Profiltexte).
 *
 * Unterstützt das Nötigste, ohne HTML zu erlauben:
 *   ## Überschrift
 *   - Aufzählung
 *   **fett** und *kursiv*
 *   Leerzeile = neuer Absatz
 *
 * Zeile für Zeile gelesen, damit eine Überschrift direkt über einer
 * Aufzählung (ohne Leerzeile dazwischen) trotzdem eine Überschrift ist.
 *
 * Gebaut aus React-Elementen statt mit `dangerouslySetInnerHTML`. So kann
 * kein eingegebener Text Code auf der Seite ausführen.
 */
type Block =
  | { art: "titel"; text: string }
  | { art: "liste"; punkte: string[] }
  | { art: "absatz"; zeilen: string[] };

export function zerlege(text: string): Block[] {
  const bloecke: Block[] = [];
  for (const roh of text.replace(/\r\n/g, "\n").split("\n")) {
    const zeile = roh.trimEnd();
    const letzter = bloecke[bloecke.length - 1];
    if (zeile.trim() === "") {
      bloecke.push({ art: "absatz", zeilen: [] });
      continue;
    }
    if (/^#{1,3}\s/.test(zeile)) {
      bloecke.push({ art: "titel", text: zeile.replace(/^#{1,3}\s/, "") });
    } else if (/^\s*[-*]\s/.test(zeile)) {
      const punkt = zeile.replace(/^\s*[-*]\s/, "");
      if (letzter?.art === "liste") letzter.punkte.push(punkt);
      else bloecke.push({ art: "liste", punkte: [punkt] });
    } else if (letzter?.art === "absatz") {
      letzter.zeilen.push(zeile);
    } else {
      bloecke.push({ art: "absatz", zeilen: [zeile] });
    }
  }
  return bloecke.filter((b) => b.art !== "absatz" || b.zeilen.length > 0);
}

export default function EinfacherText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {zerlege(text).map((b, i) =>
        b.art === "titel" ? (
          <h3 key={i} className="text-lg font-800 text-navy-900 pt-2">
            {inline(b.text)}
          </h3>
        ) : b.art === "liste" ? (
          <ul key={i} className="list-disc pl-5 space-y-1">
            {b.punkte.map((p, j) => (
              <li key={j}>{inline(p)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="leading-relaxed">
            {b.zeilen.map((z, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(z)}
              </span>
            ))}
          </p>
        )
      )}
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
