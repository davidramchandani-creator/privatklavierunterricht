/**
 * Sekunden als „2:14".
 *
 * Liegt hier und nicht bei den Hörproben, weil Hörproben und Videos dieselbe
 * Anzeige brauchen. `hoerproben.ts` reicht die Funktion weiter, damit
 * bestehende Aufrufe unverändert bleiben.
 */
export function formatDauer(sekunden: number): string {
  const min = Math.floor(sekunden / 60);
  // Abschneiden statt runden: Beim Abspielen läuft die Position stetig, und
  // Aufrunden liesse die Anzeige eine Sekunde zu früh auf die Endzeit springen.
  const sek = Math.floor(sekunden % 60);
  return `${min}:${String(sek).padStart(2, "0")}`;
}
