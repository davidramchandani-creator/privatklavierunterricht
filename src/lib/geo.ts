// ============================================================
// Geografie & Fahrzeitschätzung
//
// Grundlage für den Routenplaner. Bewusst so gebaut, dass alles auch **ohne**
// externen Routing-Dienst funktioniert: die Schätzung aus Luftlinie und
// Umwegfaktor ist für Distanzen im Winterthurer Umland gut genug, um Routen
// sinnvoll zu ordnen. Wer es exakt will, hinterlegt einen OSRM-Server
// (Umgebungsvariable OSRM_BASE_URL) — dann werden echte Fahrzeiten geholt und
// dauerhaft zwischengespeichert.
// ============================================================

export type Punkt = {
  lat: number;
  lng: number;
};

export type BenannterPunkt = Punkt & {
  id: string;
  name: string;
  adresse?: string | null;
};

const ERDRADIUS_M = 6371000;

/** Luftlinie zwischen zwei Punkten in Metern. */
export function haversineMeter(a: Punkt, b: Punkt): number {
  const toRad = (g: number) => (g * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * ERDRADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Umwegfaktor: Strassen sind länger als die Luftlinie. 1.35 ist ein
 * gängiger Wert für gewachsene Siedlungsgebiete — im Flachland mit
 * Dorfstrassen eher zu tief als zu hoch angesetzt.
 */
export const UMWEGFAKTOR = 1.35;

/** Angenommene Durchschnittsgeschwindigkeit inkl. Ortsdurchfahrten (km/h). */
export const DURCHSCHNITT_KMH = 45;

/**
 * Fixe Zeit pro Fahrt, unabhängig von der Distanz: Auto holen, parkieren,
 * zur Haustür, klingeln. Ohne diesen Aufschlag wirken kurze Wege gratis und
 * der Planer stapelt Schüler unrealistisch dicht.
 */
export const FIXZEIT_SEKUNDEN = 180;

/**
 * Geschätzte Fahrzeit zwischen zwei Punkten in Sekunden.
 * Wird verwendet, solange keine echte Route hinterlegt ist.
 */
export function schaetzeFahrzeit(a: Punkt, b: Punkt): number {
  const meter = haversineMeter(a, b) * UMWEGFAKTOR;
  const sekunden = (meter / 1000 / DURCHSCHNITT_KMH) * 3600;
  return Math.round(sekunden + FIXZEIT_SEKUNDEN);
}

/** Koordinate für den Cache-Schlüssel runden (5 Stellen ≈ 1 m). */
export function rundeKoordinate(wert: number): number {
  return Math.round(wert * 1e5) / 1e5;
}

export function punktSchluessel(p: Punkt): string {
  return `${rundeKoordinate(p.lat)},${rundeKoordinate(p.lng)}`;
}

/**
 * Fahrzeit-Nachschlagefunktion. Der Planer arbeitet nur damit und weiss
 * nicht, ob dahinter eine Schätzung, ein Routing-Dienst oder ein von Hand
 * korrigierter Wert steckt.
 */
export type Fahrzeitfunktion = (a: Punkt, b: Punkt) => number;

/**
 * Baut eine Fahrzeitfunktion, die zuerst in den hinterlegten Werten
 * nachschaut und erst dann schätzt.
 *
 * Manuell korrigierte Werte gewinnen immer: wenn David weiss, dass eine
 * Strecke zur Stosszeit 20 Minuten dauert, ist das mehr wert als jede
 * Berechnung.
 */
export function fahrzeitMitCache(
  cache: Map<string, number>
): Fahrzeitfunktion {
  return (a, b) => {
    const key = `${punktSchluessel(a)}|${punktSchluessel(b)}`;
    const treffer = cache.get(key);
    if (treffer != null) return treffer;
    // Auch die Gegenrichtung akzeptieren – Fahrzeiten sind fast symmetrisch,
    // und ein zweiter API-Aufruf für dieselbe Strecke wäre Verschwendung.
    const rueck = cache.get(`${punktSchluessel(b)}|${punktSchluessel(a)}`);
    if (rueck != null) return rueck;
    return schaetzeFahrzeit(a, b);
  };
}

// ── Hilfsgrössen für die Ausgabe ───────────────────────────

/** Sekunden als "12 Min." bzw. "1 Std. 05 Min." */
export function formatDauer(sekunden: number): string {
  const min = Math.round(sekunden / 60);
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${h} Std.` : `${h} Std. ${String(rest).padStart(2, "0")} Min.`;
}

/** Mittelpunkt mehrerer Punkte – für Cluster-Zentren. */
export function schwerpunkt(punkte: Punkt[]): Punkt {
  if (punkte.length === 0) return { lat: 0, lng: 0 };
  const lat = punkte.reduce((s, p) => s + p.lat, 0) / punkte.length;
  const lng = punkte.reduce((s, p) => s + p.lng, 0) / punkte.length;
  return { lat, lng };
}
