// ============================================================
// Live-Frequenzanalyse einer laufenden Aufnahme
//
// Für die *Wellenform* wäre eine Analyse zur Laufzeit falsch, sie bräuchte
// die ganze Datei entschlüsselt im Speicher, bevor überhaupt etwas zu sehen
// ist. Darum ist die vorberechnet.
//
// Für die *Klaviatur* ist es genau umgekehrt: Sie soll auf das reagieren, was
// gerade klingt. Ein AnalyserNode an einem laufenden <audio>-Element liest
// nur den Augenblick aus und braucht nichts zu entschlüsseln.
// ============================================================

/** Tiefster und höchster Ton, den die Klaviatur abbildet (Hz). */
const VON_HZ = 90;
const BIS_HZ = 2600;

export type Analyse = {
  /** Aktuelle Ausschläge je Taste, 0–1. */
  lesen: (tasten: number) => number[];
  schliessen: () => void;
};

/**
 * Hängt einen Analyser an ein Audio-Element.
 *
 * Gibt `null` zurück, wenn der Browser nicht mitspielt. Dann bleibt die
 * Klaviatur eben ruhig. Eine fehlende Verzierung ist kein Grund, die
 * Wiedergabe zu gefährden.
 *
 * Wichtig: `createMediaElementSource` darf je Element nur **einmal**
 * aufgerufen werden, und ab dann läuft der Ton durch den Graphen. Wird der
 * Analyser nicht mit dem Ausgang verbunden, hört man nichts mehr. Ein
 * Fehler, der sich als „Ton kaputt" zeigt und nicht als „Animation kaputt".
 */
export function starteAnalyse(el: HTMLAudioElement): Analyse | null {
  type MitContext = typeof window & { webkitAudioContext?: typeof AudioContext };
  const Ctor =
    typeof window !== "undefined"
      ? window.AudioContext ?? (window as MitContext).webkitAudioContext
      : undefined;
  if (!Ctor) return null;

  try {
    const ctx = new Ctor();
    const quelle = ctx.createMediaElementSource(el);
    const analyser = ctx.createAnalyser();
    // 2048 gibt bei 48 kHz rund 23 Hz je Feld, fein genug, um einzelne
    // Töne im unteren Bereich auseinanderzuhalten.
    analyser.fftSize = 2048;
    // Ohne Glättung zappeln die Tasten im Takt der Bildwiederholrate statt
    // im Takt der Musik.
    analyser.smoothingTimeConstant = 0.75;

    quelle.connect(analyser);
    analyser.connect(ctx.destination);

    const daten = new Uint8Array(analyser.frequencyBinCount);
    const proFeld = ctx.sampleRate / analyser.fftSize;

    return {
      lesen(tasten: number) {
        // Browser halten den Kontext angehalten, bis eine Geste kommt. Der
        // Klick auf Abspielen ist eine, hier nachziehen, falls nötig.
        if (ctx.state === "suspended") void ctx.resume();

        analyser.getByteFrequencyData(daten);

        const werte: number[] = [];
        for (let i = 0; i < tasten; i++) {
          // Tasten liegen logarithmisch, so wie Tonhöhen: eine Oktave höher
          // heisst doppelte Frequenz, nicht plus x Hertz. Linear verteilt
          // läge die halbe Klaviatur im Bass und bewegte sich kaum.
          const von = VON_HZ * Math.pow(BIS_HZ / VON_HZ, i / tasten);
          const bis = VON_HZ * Math.pow(BIS_HZ / VON_HZ, (i + 1) / tasten);

          const a = Math.floor(von / proFeld);
          const b = Math.max(a + 1, Math.floor(bis / proFeld));

          let summe = 0;
          for (let j = a; j < b && j < daten.length; j++) summe += daten[j];
          const mittel = summe / Math.max(1, b - a) / 255;

          // Hohe Töne sind von Natur aus leiser. Ohne Anhebung bewegte sich
          // nur die linke Hälfte der Klaviatur.
          const anhebung = 1 + (i / tasten) * 1.6;
          werte.push(Math.min(1, mittel * anhebung));
        }
        return werte;
      },
      schliessen() {
        try {
          quelle.disconnect();
          analyser.disconnect();
          void ctx.close();
        } catch {
          // Beim Aufräumen ist ein Fehlschlag folgenlos.
        }
      },
    };
  } catch {
    return null;
  }
}
