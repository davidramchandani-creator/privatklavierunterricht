/**
 * Wann darf die App-Aufforderung im Schülerportal erscheinen?
 *
 * Die Entscheidung steckt bewusst hier und nicht in der Komponente. Sie hat
 * mehrere Bedingungen, die alle stimmen müssen, und lässt sich so testen,
 * ohne einen Browser zu simulieren.
 *
 * Der wichtigste Fall ist der unsichtbare: Wer die App bereits installiert
 * hat, öffnet das Portal im Standalone-Modus. Dort wäre die Aufforderung
 * schlicht falsch und würde jedes Mal auftauchen.
 */

export const SPEICHERSCHLUESSEL = "pku:app-hinweis-weggeklickt";
export const SPEICHERSCHLUESSEL_INSTALLIERT = "pku:app-installiert";

/** So lange bleibt der Hinweis weg, nachdem er weggeklickt wurde. */
export const RUHEZEIT_TAGE = 14;

const TAG_IN_MS = 24 * 60 * 60 * 1000;

/**
 * iPhone und iPad. Ab iPadOS 13 meldet sich das iPad als "Macintosh", lässt
 * sich aber am Touchscreen erkennen: Ein echter Mac hat maxTouchPoints 0.
 */
export function istIos(ua: string, maxTouchPoints: number): boolean {
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  return /macintosh/i.test(ua) && maxTouchPoints > 1;
}

/**
 * Läuft die Seite bereits als installierte App?
 *
 * Android und Desktop melden das über display-mode, iOS über das
 * hauseigene navigator.standalone.
 */
export function istStandalone(
  displayModeStandalone: boolean,
  navigatorStandalone: boolean | undefined,
): boolean {
  return displayModeStandalone || navigatorStandalone === true;
}

export function darfHinweisZeigen(zustand: {
  istMobil: boolean;
  standalone: boolean;
  bereitsInstalliert: boolean;
  weggeklicktAm: number | null;
  jetzt: number;
}): boolean {
  const { istMobil, standalone, bereitsInstalliert, weggeklicktAm, jetzt } =
    zustand;

  if (!istMobil) return false;
  if (standalone) return false;
  if (bereitsInstalliert) return false;

  if (weggeklicktAm !== null) {
    // Ein Zeitstempel aus der Zukunft deutet auf eine verstellte Uhr hin.
    // Dann lieber schweigen als sofort wieder nerven.
    if (weggeklicktAm > jetzt) return false;
    if (jetzt - weggeklicktAm < RUHEZEIT_TAGE * TAG_IN_MS) return false;
  }

  return true;
}

/** Liest einen Zeitstempel aus dem Speicher und verwirft Unsinn. */
export function leseZeitstempel(roh: string | null): number | null {
  if (!roh) return null;
  const zahl = Number(roh);
  return Number.isFinite(zahl) && zahl > 0 ? zahl : null;
}
