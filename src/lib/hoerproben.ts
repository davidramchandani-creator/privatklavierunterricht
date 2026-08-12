// ============================================================
// Hörproben
//
// Der überzeugendste Beweis für einen Klavierlehrer ist, ihn spielen zu
// hören. Drei Sekunden Klang sagen mehr als vier Bewertungen — darum steht
// dieser Abschnitt weit oben, direkt nach dem Hero.
// ============================================================

export type Hoerprobe = {
  id: string;
  titel: string;
  /** Komponist, Arrangement oder „Eigene Improvisation". */
  herkunft: string;
  /** Datei unter /public/hoerproben/. */
  datei: string;
  /** Länge in Sekunden – für die Anzeige, bevor die Datei geladen ist. */
  dauer: number;
  /**
   * Wellenform als Höhen zwischen 0 und 1.
   *
   * Bewusst vorberechnet und nicht zur Laufzeit aus der Datei gelesen: Eine
   * Analyse im Browser bräuchte die vollständige Datei im Speicher, verzögert
   * den Start um Sekunden und bricht auf manchen mobilen Browsern ganz. So
   * steht die Wellenform sofort, auch bevor jemand auf Abspielen drückt.
   *
   * Erzeugen mit:
   *   ffmpeg -i stueck.mp3 -ac 1 -filter:a aresample=8000 -map 0:a -c:a pcm_s16le -f data - \
   *     | node scripts/wellenform.mjs
   */
  wellenform: number[];
};

/**
 * ACHTUNG — Titel und Herkunft sind noch Platzhalter.
 *
 * Die Aufnahmen sind da und spielbar, aber ich konnte sie nicht benennen:
 * Welches Stück von wem, das weiss nur David. Solange „Aufnahme 1" dasteht,
 * wirkt der Abschnitt unfertig — genau das Gegenteil dessen, wofür er da ist.
 *
 * Was hier stehen sollte:
 *
 *   • ein klassisches Stück — zeigt Handwerk
 *   • ein Pop-Arrangement — zeigt, dass es nicht nur Klassik gibt
 *   • etwas Eigenes oder Improvisiertes — zeigt Persönlichkeit
 *   • wenn möglich eine Schüleraufnahme (mit Erlaubnis) — nichts überzeugt
 *     Eltern mehr als ein Kind, das nach einem Jahr etwas Erkennbares spielt
 *
 * Je 30–60 Sekunden, nicht ganze Werke. Niemand hört zwei Minuten zu, bevor
 * er weiterscrollt.
 *
 * Solange die Liste leer ist, erscheint der Abschnitt gar nicht. Ein leerer
 * Zustand mit „Bald verfügbar" wäre auf einer Verkaufsseite schädlicher als
 * gar kein Abschnitt.
 */
export const HOERPROBEN: Hoerprobe[] = [
  {
    id: "aufnahme-1",
    titel: "Aufnahme 1",
    herkunft: "Noch zu benennen",
    datei: "/hoerproben/aufnahme-1.mp3",
    dauer: 16,
    wellenform: [0.043, 0.872, 0.2, 0.497, 0.624, 0.949, 0.426, 0.48, 1, 0.964, 0.469, 0.386, 0.577, 0.461, 0.371, 0.239, 0.465, 0.328, 0.337, 0.444, 0.222, 0.253, 0.588, 0.502, 0.414, 0.173, 0.541, 0.399, 0.271, 0.197, 0.393, 0.27, 0.172, 0.31, 0.339, 0.296, 0.223, 0.448, 0.609, 0.591, 0.597, 0.462, 0.364, 0.26, 0.356, 0.51, 0.397, 0.229, 0.192, 0.79, 0.385, 0.289, 0.225, 0.77, 0.461, 0.236, 0.538, 0.54, 0.605, 0.174, 0.161, 0.347, 0.41, 0.324, 0.539, 0.488, 0.525, 0.575, 0.371, 0.454, 0.199, 0.22, 0.279, 0.297, 0.159, 0.206, 0.562, 0.295, 0.207, 0.299, 0.389, 0.286, 0.156, 0.422, 0.494, 0.383, 0.255, 0.355, 0.247, 0.21, 0.404, 0.386, 0.308, 0.211, 0.136, 0.1],
  },
  {
    id: "aufnahme-2",
    titel: "Aufnahme 2",
    herkunft: "Noch zu benennen",
    datei: "/hoerproben/aufnahme-2.mp3",
    dauer: 34,
    wellenform: [0.045, 0.026, 0.048, 0.029, 0.154, 0.214, 0.202, 0.298, 0.922, 0.921, 0.894, 0.73, 0.56, 0.789, 0.899, 0.553, 0.817, 0.436, 0.432, 0.461, 0.394, 0.267, 0.263, 0.261, 0.225, 0.174, 0.199, 0.199, 0.175, 0.294, 0.311, 0.689, 0.706, 0.479, 0.482, 0.951, 0.596, 0.846, 0.479, 0.771, 0.655, 0.719, 0.607, 0.622, 0.591, 0.458, 0.33, 0.285, 0.486, 0.368, 0.43, 0.389, 0.518, 0.326, 0.305, 0.262, 0.409, 0.418, 0.341, 0.289, 0.265, 0.285, 0.751, 0.391, 0.43, 1, 0.719, 0.818, 0.839, 0.634, 0.742, 0.564, 0.503, 0.525, 0.443, 0.351, 0.249, 0.317, 0.261, 0.259, 0.213, 0.299, 0.199, 0.226, 0.231, 0.262, 0.235, 0.15, 0.127, 0.087, 0.07, 0.089, 0.074, 0.086, 0.088, 0.026],
  },
  {
    id: "aufnahme-3",
    titel: "Aufnahme 3",
    herkunft: "Noch zu benennen",
    datei: "/hoerproben/aufnahme-3.mp3",
    dauer: 35,
    wellenform: [0.838, 0.505, 0.402, 0.637, 0.623, 0.488, 0.502, 0.649, 0.289, 0.356, 0.642, 0.456, 0.361, 0.605, 0.505, 0.383, 0.627, 0.554, 0.539, 0.616, 0.419, 0.346, 1, 0.758, 0.615, 0.554, 0.689, 0.868, 0.73, 0.624, 0.651, 0.41, 0.586, 0.535, 0.499, 0.639, 0.531, 0.434, 0.481, 0.648, 0.502, 0.529, 0.555, 0.446, 0.634, 0.525, 0.538, 0.61, 0.444, 0.442, 0.545, 0.361, 0.386, 0.471, 0.322, 0.456, 0.446, 0.522, 0.604, 0.517, 0.339, 0.448, 0.502, 0.398, 0.528, 0.411, 0.335, 0.549, 0.612, 0.578, 0.664, 0.496, 0.469, 0.533, 0.523, 0.416, 0.402, 0.367, 0.343, 0.541, 0.466, 0.485, 0.473, 0.473, 0.757, 0.594, 0.417, 0.387, 0.441, 0.332, 0.35, 0.54, 0.329, 0.494, 0.588, 0.381],
  },
  {
    id: "aufnahme-4",
    titel: "Aufnahme 4",
    herkunft: "Noch zu benennen",
    datei: "/hoerproben/aufnahme-4.mp3",
    dauer: 45,
    wellenform: [0.12, 0.76, 0.964, 0.425, 0.558, 0.268, 0.592, 0.64, 0.302, 0.56, 0.327, 0.621, 0.456, 0.458, 0.455, 0.43, 0.524, 0.297, 0.481, 0.393, 0.555, 0.543, 0.833, 0.533, 0.578, 0.689, 0.472, 0.551, 0.465, 0.483, 0.381, 0.588, 0.431, 0.353, 0.439, 0.345, 0.46, 0.374, 0.352, 0.545, 0.462, 0.463, 0.461, 0.369, 0.388, 0.361, 0.423, 0.114, 0.116, 0.375, 0.76, 1, 0.702, 0.605, 0.59, 0.437, 0.729, 0.468, 0.385, 0.342, 0.459, 0.462, 0.481, 0.351, 0.321, 0.399, 0.339, 0.564, 0.551, 0.358, 0.314, 0.495, 0.429, 0.511, 0.384, 0.492, 0.482, 0.443, 0.304, 0.42, 0.5, 0.406, 0.474, 0.311, 0.232, 0.369, 0.33, 0.31, 0.253, 0.384, 0.374, 0.227, 0.38, 0.11, 0.071, 0.104],
  },
  {
    id: "aufnahme-5",
    titel: "Aufnahme 5",
    herkunft: "Noch zu benennen",
    datei: "/hoerproben/aufnahme-5.mp3",
    dauer: 48,
    wellenform: [0.18, 0.167, 0.124, 0.379, 0.71, 0.745, 0.788, 0.669, 0.833, 0.768, 0.501, 0.335, 0.495, 0.531, 0.591, 0.36, 0.638, 0.622, 0.679, 0.616, 0.436, 0.525, 0.655, 0.434, 0.436, 0.411, 0.402, 0.638, 0.396, 0.418, 0.468, 0.566, 0.413, 0.464, 0.49, 0.569, 0.565, 0.315, 0.396, 0.53, 0.571, 0.271, 0.39, 0.261, 0.7, 0.621, 0.546, 0.488, 0.37, 0.365, 0.361, 0.421, 0.151, 0.406, 0.436, 0.166, 0.154, 0.214, 0.552, 1, 0.976, 0.92, 0.746, 0.524, 0.601, 0.533, 0.449, 0.456, 0.664, 0.597, 0.684, 0.453, 0.451, 0.427, 0.394, 0.413, 0.444, 0.553, 0.696, 0.596, 0.448, 0.563, 0.414, 0.682, 0.64, 0.559, 0.603, 0.483, 0.535, 0.483, 0.535, 0.296, 0.393, 0.188, 0.133, 0.086],
  },
];

/** Sekunden als "2:14". */
export function formatDauer(sekunden: number): string {
  const min = Math.floor(sekunden / 60);
  const sek = Math.floor(sekunden % 60);
  return `${min}:${String(sek).padStart(2, "0")}`;
}
