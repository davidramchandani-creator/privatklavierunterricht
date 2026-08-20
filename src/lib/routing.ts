// ============================================================
// Routenplaner, Schüler auf Wochentage und Uhrzeiten verteilen
//
// Aufgabe: Aus einer Liste von Schülern mit Adressen und Rhythmus einen
// Wochenplan bauen, der möglichst wenig Fahrzeit kostet und in die
// Unterrichtsfenster passt.
//
// Der Kern-Trick: Der Plan beschreibt einen **Zwei-Wochen-Zyklus**. Ein
// wöchentlicher Schüler belegt eine Position in beiden Wochen. Zwei
// zweiwöchentliche Schüler teilen sich eine Position, der eine in geraden,
// der andere in ungeraden Wochen. Genau dort liegt der Kapazitätsgewinn:
// eine Position trägt zwei Schüler statt anderthalb.
//
// Verfahren (Heuristik, kein exakter Optimierer. Das wäre ein VRP und für
// 15–25 Schüler überdimensioniert):
//   1. Zweiwöchentliche Schüler paarweise auf gemeinsame Positionen legen
//   2. Positionen nach Fahrtrichtung gruppieren („Sweep“), so viele Gruppen
//      wie es Unterrichtstage gibt
//   3. Reihenfolge je Tag optimieren (Nächster Nachbar + 2-opt)
//   4. Uhrzeiten vergeben und prüfen, ob alles ins Fenster passt
//   5. Übriggebliebene auf Tage mit Luft nachsetzen
//
// Die Reihenfolge von 1 und 2 ist wesentlich: Wird zuerst gruppiert, landen
// zweiwöchentliche Schüler in verschiedenen Tagesgruppen und finden keinen
// Partner mehr, genau der Partner ist aber der Kapazitätsgewinn.
//
// Reine Funktionen, DB-Zugriff und Geokodierung liegen in routing-server.ts.
// ============================================================

import {
  haversineMeter,
  schaetzeFahrzeit,
  schwerpunkt,
  type Fahrzeitfunktion,
  type Punkt,
} from "./geo";
import { WEEKDAY_LABELS } from "./fixplatz";
import type { Rhythmus } from "./rhythmus";

export type PlanSchueler = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rhythmus: Rhythmus;
  /** Dauer der Lektion in Minuten (fast immer 45). */
  lektionMinuten: number;
  /** Wochentage, an denen der Schüler kann. Leer = keine Einschränkung. */
  moeglicheTage?: number[];
  /**
   * Zeiten **je Wochentag**. Das ist der genaue Fall, und er hat Vorrang.
   *
   * Ohne diese Aufschlüsselung müsste man die Angaben zu einem einzigen
   * Fenster verrechnen, und das geht schief, sobald jemand an
   * verschiedenen Tagen verschieden kann: „Di ab 18:00" und „Fr bis 18:00"
   * ergäben zusammengezogen 18:00 bis 18:00, also gar nichts. Der Schüler
   * fiele lautlos aus dem Plan, obwohl er am Dienstag den ganzen Abend Zeit
   * hat.
   */
  fenster?: { wochentag: number; fruehestens: string; spaetestens: string }[];
  /** Frühester Beginn als "HH:MM", falls für alle Tage gleich. */
  fruehestens?: string | null;
  /** Spätestes Ende als "HH:MM", falls für alle Tage gleich. */
  spaetestens?: string | null;
};

export type Tagesfenster = {
  /** 0 = Sonntag … 6 = Samstag. */
  wochentag: number;
  /** "HH:MM" */
  beginn: string;
  /** "HH:MM" */
  ende: string;
  /**
   * Von wo der Abend startet, falls nicht von zuhause.
   *
   * An Tagen mit Hochschule kommt David aus Zürich, nicht aus Neftenbach.
   * Das ändert die ganze Reihenfolge: Von zuhause aus ist ein Schüler in
   * Neftenbach der naheliegende erste Halt und einer in Winterthur ein
   * Umweg — von Zürich HB aus genau umgekehrt.
   *
   * Der Heimweg bleibt davon unberührt: Am Ende fährt er nach Hause.
   */
  start?: Punkt | null;
  /** Nur für die Anzeige, z. B. „PHZH Lagerstrasse". */
  startName?: string | null;
};

export type PlanEingabe = {
  /** Ausgangspunkt: Wohnort/Studio. Jede Tagesroute startet und endet hier. */
  zuhause: Punkt;
  schueler: PlanSchueler[];
  fenster: Tagesfenster[];
  /** Mindestpuffer zwischen zwei Lektionen, zusätzlich zur Fahrzeit (Min.). */
  pufferMinuten: number;
  fahrzeit?: Fahrzeitfunktion;
};

/** Eine Position im Wochenplan: eine wiederkehrende Uhrzeit an einem Tag. */
export type Position = {
  /** Schüler in geraden Kalenderwochen. */
  geradeWoche: PlanSchueler | null;
  /** Schüler in ungeraden Kalenderwochen. Bei wöchentlich derselbe. */
  ungeradeWoche: PlanSchueler | null;
  /** Beginn als "HH:MM". */
  beginn: string;
  /** Ende als "HH:MM". */
  ende: string;
  /** Fahrzeit vom vorherigen Halt (bzw. von zuhause) in Sekunden. */
  anfahrtSekunden: number;
  /**
   * Start- und Zielpunkt dieser Teilstrecke. Nötig, damit sich die Fahrzeit
   * im Admin von Hand korrigieren lässt, Daves Ortskenntnis schlägt jede
   * Schätzung.
   */
  vonKoordinate: Punkt;
  nachKoordinate: Punkt;
};

export type Tagesplan = {
  wochentag: number;
  wochentagName: string;
  positionen: Position[];
  /** Gesamte Fahrzeit inkl. Rückweg, in Sekunden (Mittel beider Wochen). */
  fahrzeitSekunden: number;
  /** Rückfahrt nach Hause. */
  heimwegSekunden: number;
  /** Wie viel des Fensters genutzt ist, 0–1. */
  auslastung: number;
  /**
   * Von wo dieser Abend startet, falls nicht von zuhause. Für die Anzeige:
   * „Abfahrt ab PHZH Lagerstrasse" statt „Abfahrt zuhause".
   */
  startName?: string | null;
  /** Passt alles ins Fenster? */
  passt: boolean;
  /** Auffälligkeiten, die David sehen sollte. Z. B. unrentable Fahrten. */
  warnungen: string[];
};

export type NichtEingeplant = {
  schueler: PlanSchueler;
  grund: string;
};

export type Routenplan = {
  tage: Tagesplan[];
  nichtEingeplant: NichtEingeplant[];
  /** Fahrzeit pro Woche über alle Tage, in Sekunden. */
  fahrzeitProWoche: number;
  /** Anzahl Lektionen pro Woche (zweiwöchentliche zählen halb). */
  lektionenProWoche: number;
  /** Belegte Positionen insgesamt. */
  positionen: number;
  /** Fahrzeit je erteilte Lektion, die eigentliche Effizienzkennzahl. */
  fahrzeitProLektion: number;
};

// ── Zeit-Hilfsfunktionen ───────────────────────────────────

function minutenVon(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function alsZeit(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = Math.round(minuten % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Hebt einen Zeitpunkt auf das nächste Viertelstunden-Raster.
 *
 * Ohne das entstehen Anfangszeiten wie 17:09: rechnerisch korrekt (Ende der
 * vorherigen Lektion plus Fahrt plus Puffer), aber niemand vereinbart eine
 * Klavierstunde um 17:09. Die Buchungs-Engine arbeitet im selben Raster —
 * ein Plan, der Zeiten vorschlägt, die sich dort gar nicht buchen liessen,
 * wäre keiner.
 *
 * Die verlorenen Minuten sind der Preis für merkbare Zeiten und stecken im
 * Plan als etwas Luft zwischen den Lektionen.
 */
function aufRaster(minuten: number, raster = 15): number {
  return Math.ceil(minuten / raster) * raster;
}

/** Kann dieser Schüler an diesem Wochentag überhaupt? */
function tagErlaubt(s: PlanSchueler, wochentag: number): boolean {
  if (s.fenster && s.fenster.length > 0) {
    return s.fenster.some((f) => f.wochentag === wochentag);
  }
  if (!s.moeglicheTage || s.moeglicheTage.length === 0) return true;
  return s.moeglicheTage.includes(wochentag);
}

/**
 * Passt die Lektion in das persönliche Zeitfenster des Schülers?
 *
 * Tagesgenaue Angaben schlagen die pauschalen. Gibt es für den Tag mehrere
 * Fenster, genügt eines. Der Schüler kann ja in jedem davon.
 */
function zeitErlaubt(
  s: PlanSchueler,
  wochentag: number,
  beginnMin: number,
  endeMin: number
): boolean {
  const tagesFenster = s.fenster?.filter((f) => f.wochentag === wochentag);
  if (tagesFenster && tagesFenster.length > 0) {
    return tagesFenster.some(
      (f) =>
        beginnMin >= minutenVon(f.fruehestens) &&
        endeMin <= minutenVon(f.spaetestens)
    );
  }

  if (s.fruehestens && beginnMin < minutenVon(s.fruehestens)) return false;
  if (s.spaetestens && endeMin > minutenVon(s.spaetestens)) return false;
  return true;
}

/**
 * Frühestmöglicher Beginn, der die Zeiten aller Beteiligten achtet.
 *
 * Gibt es für den Tag mehrere Fenster, wird das erste genommen, das noch
 * erreichbar ist, sonst schöbe ein Schüler mit einem späten Zweitfenster den
 * ganzen Abend nach hinten.
 */
function spaetesterBeginn(
  schueler: PlanSchueler[],
  wochentag: number,
  frueheste: number
): number {
  let start = frueheste;
  for (const s of schueler) {
    const tagesFenster = s.fenster?.filter((f) => f.wochentag === wochentag);
    if (tagesFenster && tagesFenster.length > 0) {
      const erreichbar = tagesFenster
        .map((f) => minutenVon(f.fruehestens))
        .filter((m) => m >= start);
      const eigene = erreichbar.length > 0 ? Math.min(...erreichbar) : start;
      start = Math.max(start, eigene);
      continue;
    }
    if (s.fruehestens) start = Math.max(start, minutenVon(s.fruehestens));
  }
  return start;
}

// ── Schritt 1: geografische Gruppen ────────────────────────

/**
 * Peilung (Kompassrichtung) eines Punktes von zuhause aus, in Radiant.
 */
function peilung(zuhause: Punkt, ziel: Punkt): number {
  const toRad = (g: number) => (g * Math.PI) / 180;
  const dLng = toRad(ziel.lng - zuhause.lng);
  const lat1 = toRad(zuhause.lat);
  const lat2 = toRad(ziel.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const winkel = Math.atan2(y, x);
  return winkel < 0 ? winkel + 2 * Math.PI : winkel;
}

/**
 * Gruppiert nach **Fahrtrichtung** statt nach Nähe („Sweep“-Verfahren):
 * alle Ziele werden nach ihrer Kompassrichtung von zuhause aus sortiert und
 * der Kreis dann in zusammenhängende Sektoren geschnitten.
 *
 * Das ist für Hausbesuche das passendere Verfahren als k-Means. Beispiel:
 * Elgg liegt weit weg und hat keinen nahen Nachbarn, k-Means gibt ihm eine
 * eigene Gruppe und damit einen eigenen Abend mit einer Stunde Fahrt für eine
 * Lektion. Tatsächlich liegt Elgg aber in derselben Richtung wie
 * Wiesendangen und Rickenbach: man fährt ohnehin daran vorbei. Nach Richtung
 * gruppiert landen die drei am selben Abend, und aus einer Stunde Leerfahrt
 * wird eine Route.
 *
 * Der Startpunkt des Schnitts ist die grösste Lücke im Kreis, dort trennt
 * man am wenigsten zusammengehörige Ziele.
 */
export function gruppiereNachRichtung(
  zuhause: Punkt,
  ziele: PlanSchueler[],
  k: number
): PlanSchueler[][] {
  if (k <= 0) return [];
  if (ziele.length === 0) return [];
  if (ziele.length <= k) return ziele.map((z) => [z]);

  const mitWinkel = ziele
    .map((z) => ({ z, winkel: peilung(zuhause, z) }))
    .sort((a, b) => a.winkel - b.winkel);

  // Grösste Lücke im Kreis finden, dort beginnt der erste Sektor.
  let luecke = -1;
  let start = 0;
  for (let i = 0; i < mitWinkel.length; i++) {
    const naechster = mitWinkel[(i + 1) % mitWinkel.length].winkel;
    const dieser = mitWinkel[i].winkel;
    const abstand =
      i === mitWinkel.length - 1
        ? naechster + 2 * Math.PI - dieser
        : naechster - dieser;
    if (abstand > luecke) {
      luecke = abstand;
      start = (i + 1) % mitWinkel.length;
    }
  }

  const rotiert = [
    ...mitWinkel.slice(start),
    ...mitWinkel.slice(0, start),
  ].map((e) => e.z);

  // Gleichmässig in k zusammenhängende Sektoren schneiden.
  //
  // Wichtig: die Grössen exakt austarieren statt mit Math.ceil zu rechnen.
  // Bei 16 Zielen auf 5 Tage ergäbe ceil(16/5)=4 die Aufteilung 4-4-4-4-0,
  // ein leerer Tag als reines Rundungsartefakt. Richtig ist 4-3-3-3-3.
  const gruppen: PlanSchueler[][] = [];
  const basis = Math.floor(rotiert.length / k);
  const rest = rotiert.length % k;
  let pos = 0;
  for (let i = 0; i < k; i++) {
    const groesse = basis + (i < rest ? 1 : 0);
    gruppen.push(rotiert.slice(pos, pos + groesse));
    pos += groesse;
  }

  return gruppen.filter((g) => g.length > 0);
}

// ── Schritt 2: zweiwöchentliche Schüler paaren ─────────────

type Positionsbelegung = {
  gerade: PlanSchueler | null;
  ungerade: PlanSchueler | null;
};

/**
 * Grösster Abstand, bis zu dem zwei zweiwöchentliche Schüler eine Position
 * teilen dürfen (Luftlinie in Metern).
 *
 * Der Plan rechnet eine geteilte Position mit dem Mittelpunkt beider
 * Adressen. Das stimmt nur, solange die beiden nahe beieinander wohnen. Bei
 * 7 km Abstand liegt der Mittelpunkt dort, wo niemand wohnt, und die
 * tatsächliche Route sieht in geraden und ungeraden Wochen völlig anders aus
 * als geplant. Dann lieber zwei getrennte Positionen und eine ehrliche Zahl.
 */
export const MAX_PAAR_DISTANZ_M = 4000;

/**
 * Legt zweiwöchentliche Schüler paarweise auf gemeinsame Positionen.
 *
 * Gepaart wird nach Nähe: zwei Schüler, die nahe beieinander wohnen, kosten
 * an derselben Position fast dieselbe Fahrzeit, der Plan bleibt in beiden
 * Wochen stabil. Wer keinen nahen Partner hat, bekommt eine Position für
 * sich; die steht dann jede zweite Woche leer, aber der Plan stimmt.
 */
export function paareZweiwoechentliche(
  schueler: PlanSchueler[],
  maxDistanzM: number = MAX_PAAR_DISTANZ_M
): Positionsbelegung[] {
  const woechentlich = schueler.filter((s) => s.rhythmus === "woechentlich");
  const zweiwoechentlich = schueler.filter(
    (s) => s.rhythmus === "zweiwoechentlich"
  );

  const positionen: Positionsbelegung[] = woechentlich.map((s) => ({
    gerade: s,
    ungerade: s,
  }));

  const offen = [...zweiwoechentlich];
  while (offen.length > 0) {
    const a = offen.shift()!;
    let besterIndex = -1;
    let besteDistanz = Infinity;
    for (let i = 0; i < offen.length; i++) {
      const d = haversineMeter(a, offen[i]);
      if (d < besteDistanz) {
        besteDistanz = d;
        besterIndex = i;
      }
    }
    if (besterIndex >= 0 && besteDistanz <= maxDistanzM) {
      const b = offen.splice(besterIndex, 1)[0];
      positionen.push({ gerade: a, ungerade: b });
    } else {
      // Kein Partner in der Nähe (oder ungerade Anzahl): eigene Position.
      positionen.push({ gerade: a, ungerade: null });
    }
  }
  return positionen;
}

/** Repräsentativer Ort einer Position (Mittel beider Wochen). */
function positionsOrt(p: Positionsbelegung): Punkt {
  const punkte = [p.gerade, p.ungerade].filter(Boolean) as PlanSchueler[];
  return schwerpunkt(punkte);
}

// ── Schritt 3: Reihenfolge innerhalb eines Tages ───────────

/**
 * Bringt die Positionen eines Tages in eine fahrzeitgünstige Reihenfolge:
 * erst „nächster Nachbar“ ab zuhause, dann 2-opt-Verbesserung.
 *
 * 2-opt dreht Teilstücke der Route um und behält die Umkehrung, wenn sie
 * kürzer ist. Das räumt genau die Überkreuzungen auf, die „nächster Nachbar“
 * typischerweise am Ende der Tour hinterlässt.
 */
export function ordneRoute(
  zuhause: Punkt,
  orte: Punkt[],
  fahrzeit: Fahrzeitfunktion
): number[] {
  const n = orte.length;
  if (n <= 1) return orte.map((_, i) => i);

  // Nächster Nachbar
  const offen = new Set(orte.map((_, i) => i));
  const reihenfolge: number[] = [];
  let aktuell = zuhause;
  while (offen.size > 0) {
    let bester = -1;
    let besteZeit = Infinity;
    for (const i of offen) {
      const t = fahrzeit(aktuell, orte[i]);
      if (t < besteZeit) {
        besteZeit = t;
        bester = i;
      }
    }
    reihenfolge.push(bester);
    offen.delete(bester);
    aktuell = orte[bester];
  }

  const tourKosten = (r: number[]) => {
    let summe = fahrzeit(zuhause, orte[r[0]]);
    for (let i = 1; i < r.length; i++) summe += fahrzeit(orte[r[i - 1]], orte[r[i]]);
    summe += fahrzeit(orte[r[r.length - 1]], zuhause);
    return summe;
  };

  // 2-opt
  let verbessert = true;
  let beste = reihenfolge;
  let besteKosten = tourKosten(beste);
  let runden = 0;
  while (verbessert && runden < 50) {
    verbessert = false;
    runden++;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const kandidat = [
          ...beste.slice(0, i),
          ...beste.slice(i, j + 1).reverse(),
          ...beste.slice(j + 1),
        ];
        const kosten = tourKosten(kandidat);
        if (kosten < besteKosten - 1) {
          beste = kandidat;
          besteKosten = kosten;
          verbessert = true;
        }
      }
    }
  }
  return beste;
}

// ── Schritt 4: Uhrzeiten vergeben ──────────────────────────

type TagesErgebnis = {
  plan: Tagesplan;
  /** Positionen, die nicht mehr ins Fenster passten. */
  ueberzaehlig: Positionsbelegung[];
};

function baueTag(
  wochentag: number,
  fenster: Tagesfenster,
  positionen: Positionsbelegung[],
  zuhause: Punkt,
  pufferMinuten: number,
  fahrzeit: Fahrzeitfunktion
): TagesErgebnis {
  // Zwei verschiedene Punkte: von wo es losgeht und wohin es zurückgeht.
  // An Hochschultagen fallen sie auseinander.
  const start = fenster.start ?? zuhause;

  const orte = positionen.map(positionsOrt);
  const reihenfolge = ordneRoute(start, orte, fahrzeit);

  const beginnMin = minutenVon(fenster.beginn);
  const endeMin = minutenVon(fenster.ende);

  const gebaut: Position[] = [];
  const ueberzaehlig: Positionsbelegung[] = [];

  let uhr = beginnMin;
  let vorherigerOrt = start;
  let fahrzeitSumme = 0;
  let leerlaufMin = 0;

  for (const idx of reihenfolge) {
    const pos = positionen[idx];
    const ort = orte[idx];
    const anfahrt = fahrzeit(vorherigerOrt, ort);
    const anfahrtMin = anfahrt / 60;

    // Erster Termin: die Anfahrt zum ersten Halt passiert vor Fensterbeginn,
    // der Unterricht startet also pünktlich zum Fensterbeginn. Das gilt auch
    // an Hochschultagen — dort ist der Fensterbeginn so gesetzt, dass die
    // Fahrt von der Schule bereits darin steckt. Danach zählt Fahrzeit plus
    // Puffer zwischen den Lektionen, angehoben aufs Viertelstunden-Raster.
    const frueheste =
      gebaut.length === 0
        ? beginnMin
        : aufRaster(uhr + Math.ceil(anfahrtMin) + pufferMinuten);

    const dauer = Math.max(
      pos.gerade?.lektionMinuten ?? 45,
      pos.ungerade?.lektionMinuten ?? 45
    );

    const schuelerHier = [pos.gerade, pos.ungerade].filter(
      Boolean
    ) as PlanSchueler[];

    // Wer erst später kann, wird nicht verworfen, sondern später angesetzt.
    //
    // Vorher wurde starr zum frühestmöglichen Zeitpunkt geprüft: Wer ab 18:00
    // konnte, fiel an einem Abend ab 16:15 durch und landete unter „kein
    // Platz mehr", obwohl der ganze Abend frei war. Das Warten kostet
    // Leerzeit, deshalb steht es als Warnung im Tagesplan; es ist aber
    // allemal besser, als jemanden gar nicht einzuplanen.
    // Auch nach dem Warten auf ein späteres Schülerfenster aufs Raster:
    // Die Fenster aus dem Formular liegen zwar selbst auf Viertelstunden,
    // aber verlassen will sich der Plan darauf nicht.
    const start = aufRaster(
      spaetesterBeginn(schuelerHier, wochentag, frueheste)
    );
    const schluss = start + dauer;

    const zeitPasstAllen = schuelerHier.every((s) =>
      zeitErlaubt(s, wochentag, start, schluss)
    );

    if (schluss > endeMin || !zeitPasstAllen) {
      ueberzaehlig.push(pos);
      continue;
    }

    if (start > frueheste) leerlaufMin += start - frueheste;

    gebaut.push({
      geradeWoche: pos.gerade,
      ungeradeWoche: pos.ungerade,
      beginn: alsZeit(start),
      ende: alsZeit(schluss),
      anfahrtSekunden: anfahrt,
      vonKoordinate: { lat: vorherigerOrt.lat, lng: vorherigerOrt.lng },
      nachKoordinate: { lat: ort.lat, lng: ort.lng },
    });
    fahrzeitSumme += anfahrt;
    uhr = schluss;
    vorherigerOrt = ort;
  }

  const heimweg = gebaut.length > 0 ? fahrzeit(vorherigerOrt, zuhause) : 0;
  const genutzt = gebaut.length > 0 ? uhr - beginnMin : 0;
  const gesamtFahrzeit = fahrzeitSumme + heimweg;

  // Auffälligkeiten benennen, statt sie in Zahlen zu verstecken.
  const warnungen: string[] = [];
  const unterrichtsMinuten = gebaut.reduce(
    (s, p) => s + (minutenVon(p.ende) - minutenVon(p.beginn)),
    0
  );
  if (gebaut.length > 0 && gesamtFahrzeit / 60 > unterrichtsMinuten) {
    warnungen.push(
      `Mehr Fahrzeit (${Math.round(gesamtFahrzeit / 60)} Min.) als Unterricht (${unterrichtsMinuten} Min.), dieser Tag trägt sich nicht.`
    );
  }
  if (leerlaufMin >= 30) {
    warnungen.push(
      `${leerlaufMin} Min. Wartezeit, weil einzelne Schüler erst später können. Der Abend liesse sich dichter legen, wenn jemand früher kann.`
    );
  }
  if (gebaut.length === 1 && gesamtFahrzeit / 60 > 45) {
    const wer =
      gebaut[0].geradeWoche?.name ?? gebaut[0].ungeradeWoche?.name ?? "Schüler";
    warnungen.push(
      `Nur ${wer} an diesem Tag, dafür ${Math.round(gesamtFahrzeit / 60)} Min. Fahrt. Lohnt sich nur mit einem zweiten Schüler in der Nähe.`
    );
  }

  return {
    plan: {
      wochentag,
      wochentagName: WEEKDAY_LABELS[wochentag] ?? String(wochentag),
      positionen: gebaut,
      fahrzeitSekunden: gesamtFahrzeit,
      heimwegSekunden: heimweg,
      auslastung: endeMin > beginnMin ? genutzt / (endeMin - beginnMin) : 0,
      startName: fenster.startName ?? null,
      passt: ueberzaehlig.length === 0,
      warnungen,
    },
    ueberzaehlig,
  };
}

// ── Gesamtplan ─────────────────────────────────────────────

function lektionenProWocheVon(positionen: Position[]): number {
  let n = 0;
  for (const p of positionen) {
    if (p.geradeWoche && p.ungeradeWoche && p.geradeWoche.id === p.ungeradeWoche.id) {
      n += 1; // wöchentlich
    } else {
      if (p.geradeWoche) n += 0.5;
      if (p.ungeradeWoche) n += 0.5;
    }
  }
  return n;
}

/**
 * Baut den Wochenplan.
 *
 * Rückgabe ist ein **Vorschlag**, kein Fakt: nichts wird gebucht, nichts
 * verändert. Erst wenn der Plan überzeugt, werden daraus Fixplätze.
 */
export function planeRouten(eingabe: PlanEingabe): Routenplan {
  const fahrzeit = eingabe.fahrzeit ?? schaetzeFahrzeit;
  const tage = [...eingabe.fenster].sort((a, b) => a.wochentag - b.wochentag);

  if (tage.length === 0) {
    return {
      tage: [],
      nichtEingeplant: eingabe.schueler.map((s) => ({
        schueler: s,
        grund: "Es sind keine Unterrichtszeiten hinterlegt.",
      })),
      fahrzeitProWoche: 0,
      lektionenProWoche: 0,
      positionen: 0,
      fahrzeitProLektion: 0,
    };
  }

  const nichtEingeplant: NichtEingeplant[] = [];

  // Schüler ohne Koordinaten kann der Planer nicht verorten. Sichtbar melden,
  // nicht still weglassen, sonst fehlt jemand im Plan und niemand merkt es.
  const planbar: PlanSchueler[] = [];
  for (const s of eingabe.schueler) {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) {
      nichtEingeplant.push({
        schueler: s,
        grund: "Keine Koordinaten, Adresse fehlt oder ist nicht auffindbar.",
      });
      continue;
    }
    const passendeTage = tage.filter((t) => tagErlaubt(s, t.wochentag));
    if (passendeTage.length === 0) {
      nichtEingeplant.push({
        schueler: s,
        grund: "An keinem Unterrichtstag verfügbar.",
      });
      continue;
    }
    planbar.push(s);
  }

  // Schritt 1: Positionen bilden, und zwar **über alle Schüler hinweg**,
  // bevor irgendetwas auf Tage verteilt wird.
  //
  // Zuerst zu gruppieren und erst dann zu paaren wäre der naheliegende, aber
  // falsche Weg: zweiwöchentliche Schüler landen dann in verschiedenen
  // Tagesgruppen und finden keinen Partner mehr. Genau der Partner ist aber
  // der Kapazitätsgewinn, ohne ihn belegt jeder zweiwöchentliche Schüler
  // eine ganze Position und die halbe Zeit steht der Slot leer.
  const positionenGesamt = paareZweiwoechentliche(planbar);

  // Schritt 2: die **Positionen** geografisch gruppieren (nicht die Schüler),
  // damit ein Paar zusammenbleibt.
  const positionsOrte = positionenGesamt.map(positionsOrt);
  const stellvertreter: PlanSchueler[] = positionenGesamt.map((p, i) => {
    const mitglieder = [p.gerade, p.ungerade].filter(Boolean) as PlanSchueler[];
    // Ein Paar kann nur an einem Tag stattfinden, an dem beide können.
    const gemeinsameTage = mitglieder.reduce<number[] | null>((acc, s) => {
      if (!s.moeglicheTage || s.moeglicheTage.length === 0) return acc;
      if (acc === null) return [...s.moeglicheTage];
      return acc.filter((d) => s.moeglicheTage!.includes(d));
    }, null);
    return {
      id: `pos-${i}`,
      name: mitglieder.map((s) => s.name).join(" / "),
      lat: positionsOrte[i].lat,
      lng: positionsOrte[i].lng,
      rhythmus: "woechentlich",
      lektionMinuten: Math.max(...mitglieder.map((s) => s.lektionMinuten)),
      moeglicheTage: gemeinsameTage ?? undefined,
    };
  });

  const gruppen = gruppiereNachRichtung(
    eingabe.zuhause,
    stellvertreter,
    tage.length
  );

  // Schritt 3: Gruppen den Tagen zuordnen. Die grösste Gruppe zuerst, damit
  // sie den längsten freien Tag bekommt.
  const zuordnung = new Map<number, Positionsbelegung[]>();
  for (const t of tage) zuordnung.set(t.wochentag, []);

  const fensterLaenge = (t: Tagesfenster) =>
    minutenVon(t.ende) - minutenVon(t.beginn);
  const gruppenSortiert = [...gruppen]
    .filter((g) => g.length > 0)
    .sort((a, b) => b.length - a.length);

  const belegteTage = new Set<number>();
  for (const gruppe of gruppenSortiert) {
    const positionen = gruppe.map(
      (v) => positionenGesamt[Number(v.id.slice(4))]
    );
    const passendeTage = tage
      .filter((t) => gruppe.every((v) => tagErlaubt(v, t.wochentag)))
      .sort((a, b) => fensterLaenge(b) - fensterLaenge(a));
    const ziel =
      passendeTage.find((t) => !belegteTage.has(t.wochentag)) ??
      passendeTage[0] ??
      tage[0];
    belegteTage.add(ziel.wochentag);
    zuordnung.get(ziel.wochentag)!.push(...positionen);
  }

  // Schritt 4: je Tag Route ordnen und Uhrzeiten vergeben.
  const tagesplaene: Tagesplan[] = [];
  let ueberlauf: Positionsbelegung[] = [];

  for (const t of tage) {
    const positionen = zuordnung.get(t.wochentag) ?? [];
    const ergebnis = baueTag(
      t.wochentag,
      t,
      positionen,
      eingabe.zuhause,
      eingabe.pufferMinuten,
      fahrzeit
    );
    tagesplaene.push(ergebnis.plan);
    ueberlauf = ueberlauf.concat(ergebnis.ueberzaehlig);
  }

  // Schritt 5: Übriggebliebene auf Tage mit Luft nachsetzen.
  for (const pos of ueberlauf) {
    const betroffene = [pos.gerade, pos.ungerade].filter(
      Boolean
    ) as PlanSchueler[];
    let untergebracht = false;

    for (const t of tage) {
      if (!betroffene.every((s) => tagErlaubt(s, t.wochentag))) continue;
      const plan = tagesplaene.find((p) => p.wochentag === t.wochentag)!;
      const bestehend: Positionsbelegung[] = plan.positionen.map((p) => ({
        gerade: p.geradeWoche,
        ungerade: p.ungeradeWoche,
      }));
      const versuch = baueTag(
        t.wochentag,
        t,
        [...bestehend, pos],
        eingabe.zuhause,
        eingabe.pufferMinuten,
        fahrzeit
      );
      if (versuch.ueberzaehlig.length === 0) {
        const index = tagesplaene.findIndex((p) => p.wochentag === t.wochentag);
        tagesplaene[index] = versuch.plan;
        untergebracht = true;
        break;
      }
    }

    if (!untergebracht) {
      for (const s of betroffene) {
        nichtEingeplant.push({
          schueler: s,
          grund:
            "Kein Platz mehr in den Unterrichtsfenstern, Fenster erweitern oder Schüler auf Flex setzen.",
        });
      }
    }
  }

  // `passt` neu bestimmen: nach dem Nachsetzen ist ein Tag in Ordnung, wenn
  // alles, was jetzt auf ihm liegt, auch wirklich Platz hat. Das Flag aus dem
  // ersten Durchgang wäre veraltet und würde grundlos Alarm schlagen.
  for (let i = 0; i < tagesplaene.length; i++) {
    tagesplaene[i] = { ...tagesplaene[i], passt: true };
  }

  const fahrzeitProWoche = tagesplaene.reduce(
    (s, t) => s + t.fahrzeitSekunden,
    0
  );
  const lektionenProWoche = tagesplaene.reduce(
    (s, t) => s + lektionenProWocheVon(t.positionen),
    0
  );
  const positionen = tagesplaene.reduce((s, t) => s + t.positionen.length, 0);

  return {
    tage: tagesplaene,
    nichtEingeplant,
    fahrzeitProWoche,
    lektionenProWoche,
    positionen,
    fahrzeitProLektion:
      lektionenProWoche > 0 ? Math.round(fahrzeitProWoche / lektionenProWoche) : 0,
  };
}

// ── Vergleich: was bringt der Plan? ────────────────────────

export type Vergleich = {
  fahrzeitProWoche: number;
  fahrzeitProLektion: number;
  lektionenProWoche: number;
  /** Ersparnis gegenüber der Vergleichsrechnung, in Sekunden pro Woche. */
  ersparnisProWoche: number;
  /** Hochgerechnet auf ein Unterrichtsjahr (46 Wochen), in Stunden. */
  ersparnisStundenProJahr: number;
};

/** Unterrichtswochen pro Jahr, nach Abzug von Ferien und Absenzen. */
export const UNTERRICHTSWOCHEN = 46;

export type TagesanzahlVariante = {
  /** Wie viele Unterrichtstage diese Variante nutzt. */
  tage: number;
  wochentage: number[];
  fahrzeitProWoche: number;
  fahrzeitProLektion: number;
  lektionenProWoche: number;
  nichtEingeplant: number;
  /** Gebundene Zeit: Unterricht + Fahrt, pro Woche in Sekunden. */
  gebundeneZeitProWoche: number;
  warnungen: string[];
};

/**
 * Rechnet denselben Schülerstamm auf unterschiedlich viele Unterrichtstage
 * durch, von wenigen vollen Tagen bis zu allen Tagen dünn belegt.
 *
 * Der Grund, warum das die wichtigste Frage überhaupt ist: **jeder zusätzliche
 * Unterrichtstag kostet einen eigenen Hin- und Rückweg.** Vier volle Abende
 * brauchen weniger Fahrzeit als fünf halbleere, obwohl dieselben Lektionen
 * erteilt werden. Wer nach Umsatz pro Zeit fragt, muss hier hinschauen. Nicht
 * beim Lektionspreis.
 *
 * Die Varianten behalten immer die längsten Fenster (dort passen am meisten
 * Lektionen hin) und lassen die kurzen weg.
 */
export function vergleicheTagesanzahl(
  eingabe: PlanEingabe,
  minTage = 2
): TagesanzahlVariante[] {
  const nachLaenge = [...eingabe.fenster].sort(
    (a, b) =>
      minutenVon(b.ende) -
      minutenVon(b.beginn) -
      (minutenVon(a.ende) - minutenVon(a.beginn))
  );

  const varianten: TagesanzahlVariante[] = [];
  for (let n = Math.max(1, minTage); n <= nachLaenge.length; n++) {
    const fenster = nachLaenge
      .slice(0, n)
      .sort((a, b) => a.wochentag - b.wochentag);
    const plan = planeRouten({ ...eingabe, fenster });

    const genutzte = plan.tage.filter((t) => t.positionen.length > 0);
    const unterrichtSekunden = plan.tage.reduce(
      (s, t) =>
        s +
        t.positionen.reduce(
          (x, p) => x + (minutenVon(p.ende) - minutenVon(p.beginn)) * 60,
          0
        ),
      0
    );

    varianten.push({
      tage: genutzte.length,
      wochentage: genutzte.map((t) => t.wochentag),
      fahrzeitProWoche: plan.fahrzeitProWoche,
      fahrzeitProLektion: plan.fahrzeitProLektion,
      lektionenProWoche: plan.lektionenProWoche,
      nichtEingeplant: plan.nichtEingeplant.length,
      gebundeneZeitProWoche: plan.fahrzeitProWoche + unterrichtSekunden,
      warnungen: plan.tage.flatMap((t) =>
        t.warnungen.map((w) => `${t.wochentagName}: ${w}`)
      ),
    });
  }

  return varianten;
}

/**
 * Empfiehlt eine Variante: die wenigste Fahrzeit, sofern alle Schüler
 * untergebracht sind. Varianten, bei denen jemand hinausfällt, kommen nicht
 * in Frage, Kapazität geht vor Effizienz.
 */
export function empfohleneVariante(
  varianten: TagesanzahlVariante[]
): TagesanzahlVariante | null {
  const brauchbar = varianten.filter((v) => v.nichtEingeplant === 0);
  if (brauchbar.length === 0) return null;
  return brauchbar.reduce((best, v) =>
    v.fahrzeitProWoche < best.fahrzeitProWoche ? v : best
  );
}

/**
 * Stellt den optimierten Plan dem gegenüber, was ohne Planung entsteht.
 *
 * Die Vergleichsrechnung bildet das Flex-Modell nach: die Schüler verteilen
 * sich **ohne Rücksicht auf die Geografie** auf die Tage (hier alphabetisch,
 * so zufällig wie „wer zuerst bucht, kriegt den Slot“) und stehen innerhalb
 * des Tages in beliebiger Reihenfolge.
 *
 * Nur die Reihenfolge innerhalb eines Tages zu vergleichen wäre zu
 * wohlwollend: Der grössere Teil des Gewinns steckt in der Tageszuteilung
 *, dass Andelfingen und Henggart am selben Abend liegen und nicht an zwei
 * verschiedenen.
 */
export function vergleicheMitUnsortiert(
  plan: Routenplan,
  eingabe: PlanEingabe
): Vergleich {
  const fahrzeit = eingabe.fahrzeit ?? schaetzeFahrzeit;

  // Alle belegten Positionen einsammeln.
  const allePositionen = plan.tage.flatMap((t) => t.positionen);
  const tage = plan.tage.filter((t) => t.positionen.length > 0);
  if (tage.length === 0 || allePositionen.length === 0) {
    return {
      fahrzeitProWoche: plan.fahrzeitProWoche,
      fahrzeitProLektion: plan.fahrzeitProLektion,
      lektionenProWoche: plan.lektionenProWoche,
      ersparnisProWoche: 0,
      ersparnisStundenProJahr: 0,
    };
  }

  // Alphabetisch durchnummerieren und reihum auf die Tage verteilen, das
  // entspricht „jeder sucht sich selbst einen Termin“.
  const sortiert = [...allePositionen].sort((a, b) => {
    const na = a.geradeWoche?.name ?? a.ungeradeWoche?.name ?? "";
    const nb = b.geradeWoche?.name ?? b.ungeradeWoche?.name ?? "";
    return na.localeCompare(nb);
  });

  const proTag: Position[][] = tage.map(() => []);
  sortiert.forEach((p, i) => proTag[i % tage.length].push(p));

  let unsortiert = 0;
  for (const gruppe of proTag) {
    if (gruppe.length === 0) continue;
    const orte = gruppe.map((p) =>
      schwerpunkt(
        [p.geradeWoche, p.ungeradeWoche].filter(Boolean) as PlanSchueler[]
      )
    );
    let summe = fahrzeit(eingabe.zuhause, orte[0]);
    for (let i = 1; i < orte.length; i++) summe += fahrzeit(orte[i - 1], orte[i]);
    summe += fahrzeit(orte[orte.length - 1], eingabe.zuhause);
    unsortiert += summe;
  }

  const ersparnis = unsortiert - plan.fahrzeitProWoche;
  return {
    fahrzeitProWoche: plan.fahrzeitProWoche,
    fahrzeitProLektion: plan.fahrzeitProLektion,
    lektionenProWoche: plan.lektionenProWoche,
    ersparnisProWoche: ersparnis,
    ersparnisStundenProJahr:
      Math.round(((ersparnis * UNTERRICHTSWOCHEN) / 3600) * 10) / 10,
  };
}
