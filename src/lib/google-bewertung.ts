// ============================================================
// Google-Bewertungen
//
// Warum überhaupt zu Google und nicht ins eigene Formular?
//
// Bewertungen auf der eigenen Website überzeugen jemanden, der schon da
// ist. In der lokalen Suche zählen sie nicht mit. Wer „Klavierunterricht
// Neftenbach" eingibt, sieht zuerst die Kartenbox, und dort entscheiden
// Anzahl, Wertung und Aktualität der Google-Bewertungen mit, wer erscheint.
//
// Der Preis dafür ist die Kontrolle: Bei Google steht sofort öffentlich,
// was jemand schreibt. Freigeben lässt sich nichts, nur antworten oder
// melden. Deshalb bleibt das eigene Formular als zweiter Weg bestehen, für
// alle ohne Google-Konto und für alle, die nicht öffentlich schreiben
// wollen.
//
// ── Zur Adresse ────────────────────────────────────────────
//
// Der Link öffnet das Bewertungsfenster direkt, ohne Umweg über das
// Profil. Die Kennung stammt aus dem Maps-Eintrag und wurde im Browser
// geprüft: Sie öffnet das richtige Unternehmen.
//
// Es gibt bei Google zwei Einträge unter derselben Adresse. Dieser hier
// ist der mit den Bewertungen. Solange der zweite existiert, verteilen
// sich neue Bewertungen womöglich auf beide, und geteilte Bewertungen
// zählen in der lokalen Suche weniger als gebündelte.
// ============================================================

/** Kennung des Google-Unternehmensprofils. */
export const GOOGLE_PLACE_ID = "ChIJC5nv8ZyPM4MRSsVvnRqaCiA";

/** Öffnet direkt das Fenster zum Schreiben einer Bewertung. */
export const GOOGLE_BEWERTEN_URL = `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`;

/** Das Profil selbst, für Links auf der Website. */
export const GOOGLE_PROFIL_URL =
  "https://www.google.com/maps/place/?q=place_id:" + GOOGLE_PLACE_ID;
