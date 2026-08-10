// ============================================================
// Adressen zu Koordinaten
//
// Zwei Quellen, in dieser Reihenfolge:
//   1. api3.geo.admin.ch — der amtliche Schweizer Adressdienst. Kostenlos,
//      kein Schlüssel nötig, kennt jede Schweizer Hausnummer.
//   2. Nominatim (OpenStreetMap) — Rückfall für Adressen im grenznahen
//      Ausland oder wenn geo.admin gerade nicht antwortet.
//
// Läuft ausschliesslich serverseitig. Ergebnisse werden in `profiles`
// gespeichert und nur neu geholt, wenn sich die Adresse geändert hat —
// Geokodierung ist teuer und Adressen ändern sich selten.
// ============================================================

export type GeocodeTreffer = {
  lat: number;
  lng: number;
  /** Wie der Dienst die Adresse verstanden hat – zur Kontrolle. */
  gefundeneAdresse: string;
  quelle: "geo.admin" | "nominatim";
};

/**
 * Grober Rahmen um die Schweiz samt Grenzregion. Dient als Plausibilitäts-
 * prüfung: liefert ein Dienst Koordinaten irgendwo in Asien, weil er die
 * Adresse nicht verstanden hat, wollen wir das merken statt einen Schüler
 * still an den falschen Ort zu setzen.
 */
const SCHWEIZ_RAHMEN = {
  latMin: 45.5,
  latMax: 48.0,
  lngMin: 5.5,
  lngMax: 10.8,
};

function plausibel(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= SCHWEIZ_RAHMEN.latMin &&
    lat <= SCHWEIZ_RAHMEN.latMax &&
    lng >= SCHWEIZ_RAHMEN.lngMin &&
    lng <= SCHWEIZ_RAHMEN.lngMax
  );
}

const TIMEOUT_MS = 8000;

async function holen(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type GeoAdminAntwort = {
  results?: Array<{
    attrs?: { lat?: number; lon?: number; label?: string; detail?: string };
  }>;
};

async function viaGeoAdmin(adresse: string): Promise<GeocodeTreffer | null> {
  const url =
    "https://api3.geo.admin.ch/rest/services/api/SearchServer" +
    `?searchText=${encodeURIComponent(adresse)}` +
    "&type=locations&sr=4326&limit=1";

  const daten = (await holen(url)) as GeoAdminAntwort | null;
  const treffer = daten?.results?.[0]?.attrs;
  if (!treffer || treffer.lat == null || treffer.lon == null) return null;

  const lat = Number(treffer.lat);
  const lng = Number(treffer.lon);
  if (!plausibel(lat, lng)) return null;

  // `label` enthält HTML-Auszeichnung (<b>…</b>) – für die Anzeige entfernen.
  const label = (treffer.label ?? treffer.detail ?? adresse).replace(
    /<[^>]*>/g,
    ""
  );
  return { lat, lng, gefundeneAdresse: label, quelle: "geo.admin" };
}

type NominatimAntwort = Array<{ lat?: string; lon?: string; display_name?: string }>;

async function viaNominatim(adresse: string): Promise<GeocodeTreffer | null> {
  const url =
    "https://nominatim.openstreetmap.org/search" +
    `?q=${encodeURIComponent(adresse)}` +
    "&format=json&limit=1&countrycodes=ch,de,at,fr,it";

  // Nominatim verlangt eine identifizierende User-Agent-Angabe.
  const daten = (await holen(url, {
    "User-Agent": "privatklavierunterricht.ch Routenplanung (Kontakt via Website)",
    "Accept-Language": "de",
  })) as NominatimAntwort | null;

  const treffer = daten?.[0];
  if (!treffer?.lat || !treffer?.lon) return null;

  const lat = Number(treffer.lat);
  const lng = Number(treffer.lon);
  if (!plausibel(lat, lng)) return null;

  return {
    lat,
    lng,
    gefundeneAdresse: treffer.display_name ?? adresse,
    quelle: "nominatim",
  };
}

/**
 * Adresse zu Koordinaten auflösen.
 *
 * Gibt `null` zurück, wenn keine Quelle etwas Plausibles liefert. Der
 * Aufrufer muss diesen Fall sichtbar machen — ein Schüler ohne Koordinaten
 * fehlt sonst wortlos im Routenplan.
 */
export async function geocode(adresse: string): Promise<GeocodeTreffer | null> {
  const sauber = adresse.trim();
  if (sauber.length < 4) return null;

  const schweizerisch = await viaGeoAdmin(sauber);
  if (schweizerisch) return schweizerisch;

  return viaNominatim(sauber);
}

/**
 * Mehrere Adressen nacheinander auflösen, mit Pause dazwischen.
 *
 * Bewusst seriell und gedrosselt: Nominatim erlaubt höchstens eine Anfrage
 * pro Sekunde, und ein Schwung paralleler Anfragen brächte uns dort auf die
 * Sperrliste. Bei 20 Schülern dauert das gut 20 Sekunden — das passiert
 * einmal und wird danach gespeichert.
 */
export async function geocodeMehrere(
  adressen: Array<{ id: string; adresse: string }>,
  pauseMs = 1100
): Promise<Map<string, GeocodeTreffer | null>> {
  const ergebnis = new Map<string, GeocodeTreffer | null>();
  for (let i = 0; i < adressen.length; i++) {
    const { id, adresse } = adressen[i];
    ergebnis.set(id, await geocode(adresse));
    if (i < adressen.length - 1) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
  return ergebnis;
}

/**
 * Ist die gespeicherte Geokodierung noch gültig?
 *
 * Verglichen wird die Adresse, die damals zu den Koordinaten geführt hat, mit
 * der heute im Profil stehenden. Weicht sie ab, ist der Schüler umgezogen und
 * die alten Koordinaten sind falsch — schlimmer als gar keine, weil sie
 * unbemerkt eine falsche Route erzeugen.
 */
export function geokodierungAktuell(profil: {
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  geocode_adresse: string | null;
}): boolean {
  if (profil.lat == null || profil.lng == null) return false;
  if (!profil.adresse) return false;
  return normalisiere(profil.adresse) === normalisiere(profil.geocode_adresse ?? "");
}

function normalisiere(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
