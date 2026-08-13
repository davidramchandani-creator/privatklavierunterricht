// ============================================================
// Zuteilung, Schüler auf Termine legen, die sie auch können
//
// Der Unterschied zum Routenplaner in routing.ts: Dort wurde eine Route
// gebaut und die Uhrzeiten fielen dabei heraus. Hier ist die Verfügbarkeit
// des Schülers eine **harte Nebenbedingung**, ein Termin, den er nicht
// kann, ist keine Lösung, egal wie gut er in die Route passt.
//
// Warum das der bessere Ablauf ist: Wählt jeder Schüler selbst zuerst einen
// freien Platz, bekommt der Schnellste den besten Slot und die Route ist,
// was übrig bleibt. Werden dagegen erst alle Verfügbarkeiten gesammelt und
// dann einmal zugeteilt, kann ein Schüler dorthin gelegt werden, wo er in
// die Route passt und kann.
//
// Verfahren: Greedy nach Knappheit, danach lokale Verbesserung durch
// Tauschen. Kein exakter Optimierer, bei 15–25 Schülern und harten
// Zeitfenstern ist das Problem NP-schwer, und eine gute Lösung in einer
// Sekunde ist mehr wert als die beste in zehn Minuten.
//
// Reine Funktionen, DB-Zugriff liegt in zuteilung-server.ts.
// ============================================================

import { haversineMeter, schaetzeFahrzeit, type Fahrzeitfunktion, type Punkt } from "./geo";
import { WEEKDAY_LABELS } from "./fixplatz";
import type { Rhythmus } from "./rhythmus";
import type { Tagesfenster } from "./routing";

/** Ein Zeitfenster, in dem ein Schüler kann. */
export type Verfuegbarkeit = {
  /** 0 = Sonntag … 6 = Samstag. */
  wochentag: number;
  /** "HH:MM", frühester Beginn. */
  fruehestens: string;
  /** "HH:MM", spätestes Ende. */
  spaetestens: string;
  /** 1 = geht zur Not, 2 = passt, 3 = am liebsten. */
  praeferenz: number;
};

export type ZuteilSchueler = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rhythmus: Rhythmus;
  lektionMinuten: number;
  verfuegbarkeiten: Verfuegbarkeit[];
  /** Bisheriger Fixplatz, falls vorhanden. Wird bevorzugt beibehalten. */
  bisher?: { wochentag: number; zeit: string } | null;
};

export type Zuteilung = {
  schuelerId: string;
  name: string;
  wochentag: number;
  /** "HH:MM" */
  beginn: string;
  /** Bei zweiwöchentlichem Rhythmus: 0 = gerade KW, 1 = ungerade. */
  paritaet: 0 | 1 | null;
  /** Welche Präferenz erfüllt wurde (1–3). */
  praeferenz: number;
  /** Anfahrt vom vorherigen Halt in Sekunden. */
  anfahrtSekunden: number;
  /** Hatte der Schüler diesen Platz schon vorher? */
  unveraendert: boolean;
};

export type NichtZugeteilt = {
  schueler: ZuteilSchueler;
  grund: string;
};

export type Zuteilungsergebnis = {
  zuteilungen: Zuteilung[];
  nichtZugeteilt: NichtZugeteilt[];
  fahrzeitProWoche: number;
  /** Wie viele Schüler ihren Wunschtermin (Präferenz 3) bekommen haben. */
  wunschErfuellt: number;
  /** Wie viele ihren bisherigen Platz behalten. */
  unveraendert: number;
};

// ── Zeit-Helfer ────────────────────────────────────────────

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
 * Kandidatenplätze: jede Kombination aus Wochentag und Startzeit, die
 * sowohl im Unterrichtsfenster liegt als auch in einem Zeitfenster des
 * Schülers. Das Raster von 15 Minuten entspricht der Buchungs-Engine.
 */
export function moeglichePlaetze(
  s: ZuteilSchueler,
  fenster: Tagesfenster[],
  rasterMinuten = 15
): { wochentag: number; beginn: string; praeferenz: number }[] {
  const ergebnis: { wochentag: number; beginn: string; praeferenz: number }[] = [];

  for (const f of fenster) {
    const passende = s.verfuegbarkeiten.filter((v) => v.wochentag === f.wochentag);
    if (passende.length === 0) continue;

    const fensterVon = minutenVon(f.beginn);
    const fensterBis = minutenVon(f.ende);

    for (const v of passende) {
      const von = Math.max(fensterVon, minutenVon(v.fruehestens));
      const bis = Math.min(fensterBis, minutenVon(v.spaetestens));

      for (let m = von; m + s.lektionMinuten <= bis; m += rasterMinuten) {
        ergebnis.push({
          wochentag: f.wochentag,
          beginn: alsZeit(m),
          praeferenz: v.praeferenz,
        });
      }
    }
  }

  // Doppelte entfernen (überlappende Fenster), höchste Präferenz gewinnt.
  const beste = new Map<string, { wochentag: number; beginn: string; praeferenz: number }>();
  for (const p of ergebnis) {
    const key = `${p.wochentag}-${p.beginn}`;
    const vorhanden = beste.get(key);
    if (!vorhanden || p.praeferenz > vorhanden.praeferenz) beste.set(key, p);
  }
  return [...beste.values()];
}

// ── Belegung eines Tages ───────────────────────────────────

type Belegung = {
  schueler: ZuteilSchueler;
  beginnMin: number;
  endeMin: number;
  paritaet: 0 | 1 | null;
  praeferenz: number;
};

/**
 * Kollidiert ein Platz mit einer bestehenden Belegung?
 *
 * Zwei zweiwöchentliche Schüler mit **verschiedener** Wochenparität dürfen
 * sich überlappen, sie kommen in verschiedenen Wochen. Genau das ist der
 * Kapazitätsgewinn, den das Modell hergibt.
 */
function kollidiert(
  a: { beginnMin: number; endeMin: number; paritaet: 0 | 1 | null },
  b: Belegung,
  pufferMinuten: number
): boolean {
  if (a.paritaet !== null && b.paritaet !== null && a.paritaet !== b.paritaet) {
    return false;
  }
  return (
    a.beginnMin < b.endeMin + pufferMinuten &&
    b.beginnMin < a.endeMin + pufferMinuten
  );
}

/** Fahrzeit einer Tagesroute inklusive Hin- und Rückweg. */
function tagesFahrzeit(
  belegungen: Belegung[],
  zuhause: Punkt,
  fahrzeit: Fahrzeitfunktion
): number {
  if (belegungen.length === 0) return 0;
  const sortiert = [...belegungen].sort((a, b) => a.beginnMin - b.beginnMin);
  let summe = fahrzeit(zuhause, sortiert[0].schueler);
  for (let i = 1; i < sortiert.length; i++) {
    summe += fahrzeit(sortiert[i - 1].schueler, sortiert[i].schueler);
  }
  summe += fahrzeit(sortiert[sortiert.length - 1].schueler, zuhause);
  return summe;
}

// ── Hauptverfahren ─────────────────────────────────────────

export type ZuteilEingabe = {
  zuhause: Punkt;
  schueler: ZuteilSchueler[];
  fenster: Tagesfenster[];
  pufferMinuten: number;
  fahrzeit?: Fahrzeitfunktion;
  /**
   * Wie stark ein bestehender Fixplatz bevorzugt wird, in Sekunden
   * "Rabatt" auf die Fahrzeit. Umzüge im Stundenplan sind für Schüler
   * lästig; ohne diesen Bonus würde der Planer jedes Mal alles umwerfen,
   * um zwei Minuten Fahrzeit zu sparen.
   */
  bonusBestehend?: number;
  /**
   * Wie stark eine Wunschzeit (Präferenz 3) bevorzugt wird, in Sekunden.
   * Wirkt nur, wenn die Fahrzeit ähnlich ist.
   */
  bonusPraeferenz?: number;
};

const STANDARD_BONUS_BESTEHEND = 600; // 10 Minuten
const STANDARD_BONUS_PRAEFERENZ = 180; // 3 Minuten pro Stufe

/**
 * Teilt alle Schüler zu.
 *
 * Reihenfolge: wer die wenigsten Möglichkeiten hat, kommt zuerst dran.
 * Ein Schüler, der nur dienstags um 17:00 kann, muss diesen Platz bekommen.
 * wird er nach hinten geschoben, ist der Platz weg und er fällt heraus.
 * Wer flexibel ist, findet dagegen fast immer noch etwas.
 */
export function teileZu(eingabe: ZuteilEingabe): Zuteilungsergebnis {
  const fahrzeit = eingabe.fahrzeit ?? schaetzeFahrzeit;
  const puffer = eingabe.pufferMinuten;
  const bonusBestehend = eingabe.bonusBestehend ?? STANDARD_BONUS_BESTEHEND;
  const bonusPraeferenz = eingabe.bonusPraeferenz ?? STANDARD_BONUS_PRAEFERENZ;

  const belegung = new Map<number, Belegung[]>();
  for (const f of eingabe.fenster) belegung.set(f.wochentag, []);

  const nichtZugeteilt: NichtZugeteilt[] = [];

  // Kandidaten je Schüler vorberechnen und nach Knappheit sortieren.
  const mitPlaetzen = eingabe.schueler.map((s) => ({
    s,
    plaetze: moeglichePlaetze(s, eingabe.fenster),
  }));

  for (const e of mitPlaetzen) {
    if (!Number.isFinite(e.s.lat) || !Number.isFinite(e.s.lng)) {
      nichtZugeteilt.push({
        schueler: e.s,
        grund: "Keine Koordinaten, Adresse fehlt oder ist nicht auffindbar.",
      });
    } else if (e.s.verfuegbarkeiten.length === 0) {
      nichtZugeteilt.push({
        schueler: e.s,
        grund: "Keine Verfügbarkeit angegeben.",
      });
    } else if (e.plaetze.length === 0) {
      nichtZugeteilt.push({
        schueler: e.s,
        grund:
          "Die angegebenen Zeiten liegen ausserhalb der Unterrichtszeiten.",
      });
    }
  }

  const planbar = mitPlaetzen
    .filter(
      (e) =>
        Number.isFinite(e.s.lat) &&
        Number.isFinite(e.s.lng) &&
        e.plaetze.length > 0
    )
    .sort((a, b) => a.plaetze.length - b.plaetze.length);

  for (const { s, plaetze } of planbar) {
    let bester: {
      wochentag: number;
      beginnMin: number;
      paritaet: 0 | 1 | null;
      praeferenz: number;
      kosten: number;
      anfahrt: number;
    } | null = null;

    for (const p of plaetze) {
      const beginnMin = minutenVon(p.beginn);
      const endeMin = beginnMin + s.lektionMinuten;
      const tag = belegung.get(p.wochentag) ?? [];

      // Zweiwöchentliche Schüler können sich einen Platz teilen. Beide
      // Paritäten durchprobieren; wöchentliche haben keine.
      const paritaeten: Array<0 | 1 | null> =
        s.rhythmus === "zweiwoechentlich" ? [0, 1] : [null];

      for (const paritaet of paritaeten) {
        const kandidat = { beginnMin, endeMin, paritaet };
        if (tag.some((b) => kollidiert(kandidat, b, puffer))) continue;

        // Kosten = Fahrzeit-Zuwachs des Tages, abzüglich Boni.
        const vorher = tagesFahrzeit(tag, eingabe.zuhause, fahrzeit);
        const nachher = tagesFahrzeit(
          [...tag, { schueler: s, beginnMin, endeMin, paritaet, praeferenz: p.praeferenz }],
          eingabe.zuhause,
          fahrzeit
        );
        const zuwachs = nachher - vorher;

        const istBestehend =
          s.bisher != null &&
          s.bisher.wochentag === p.wochentag &&
          s.bisher.zeit.slice(0, 5) === p.beginn;

        const kosten =
          zuwachs -
          (istBestehend ? bonusBestehend : 0) -
          (p.praeferenz - 1) * bonusPraeferenz;

        if (!bester || kosten < bester.kosten) {
          bester = {
            wochentag: p.wochentag,
            beginnMin,
            paritaet,
            praeferenz: p.praeferenz,
            kosten,
            anfahrt: zuwachs,
          };
        }
      }
    }

    if (!bester) {
      nichtZugeteilt.push({
        schueler: s,
        grund:
          "Alle Zeiten, die dieser Schüler angegeben hat, sind bereits belegt.",
      });
      continue;
    }

    belegung.get(bester.wochentag)!.push({
      schueler: s,
      beginnMin: bester.beginnMin,
      endeMin: bester.beginnMin + s.lektionMinuten,
      paritaet: bester.paritaet,
      praeferenz: bester.praeferenz,
    });
  }

  // ── Verbesserung durch Tauschen ──────────────────────────
  //
  // Der Greedy-Durchgang setzt jeden Schüler auf den Platz, der im Moment
  // seiner Zuteilung am günstigsten ist. Das ist nicht dasselbe wie global
  // günstig: Wer früh dran ist, besetzt einen Platz, der später jemandem
  // besser gepasst hätte. Ergebnis sind Routen, die der Uhr folgen statt der
  // Geografie, am selben Abend erst nach Bülach, dann quer nach Elgg.
  //
  // Hier wird das aufgeräumt: Paare tauschen ihre Zeiten, wenn beide den
  // Platz des anderen können und die Gesamtfahrzeit dadurch sinkt.
  verbessereDurchTausch(belegung, eingabe, fahrzeit, puffer);

  // Ergebnis zusammenstellen, je Tag nach Uhrzeit sortiert.
  const zuteilungen: Zuteilung[] = [];
  let fahrzeitGesamt = 0;

  for (const [wochentag, tag] of belegung) {
    if (tag.length === 0) continue;
    const sortiert = [...tag].sort((a, b) => a.beginnMin - b.beginnMin);
    fahrzeitGesamt += tagesFahrzeit(sortiert, eingabe.zuhause, fahrzeit);

    let vorherigerOrt: Punkt = eingabe.zuhause;
    for (const b of sortiert) {
      const anfahrt = fahrzeit(vorherigerOrt, b.schueler);
      const unveraendert =
        b.schueler.bisher != null &&
        b.schueler.bisher.wochentag === wochentag &&
        b.schueler.bisher.zeit.slice(0, 5) === alsZeit(b.beginnMin);

      zuteilungen.push({
        schuelerId: b.schueler.id,
        name: b.schueler.name,
        wochentag,
        beginn: alsZeit(b.beginnMin),
        paritaet: b.paritaet,
        praeferenz: b.praeferenz,
        anfahrtSekunden: anfahrt,
        unveraendert,
      });
      vorherigerOrt = b.schueler;
    }
  }

  zuteilungen.sort(
    (a, b) => a.wochentag - b.wochentag || a.beginn.localeCompare(b.beginn)
  );

  return {
    zuteilungen,
    nichtZugeteilt,
    fahrzeitProWoche: Math.round(fahrzeitGesamt),
    wunschErfuellt: zuteilungen.filter((z) => z.praeferenz >= 3).length,
    unveraendert: zuteilungen.filter((z) => z.unveraendert).length,
  };
}

/**
 * Kann dieser Schüler zu dieser Zeit an diesem Tag? Prüft gegen seine
 * angegebenen Fenster und gibt die erfüllte Präferenz zurück (0 = kann nicht).
 */
function praeferenzFuer(
  s: ZuteilSchueler,
  wochentag: number,
  beginnMin: number,
  endeMin: number
): number {
  let beste = 0;
  for (const v of s.verfuegbarkeiten) {
    if (v.wochentag !== wochentag) continue;
    if (beginnMin < minutenVon(v.fruehestens)) continue;
    if (endeMin > minutenVon(v.spaetestens)) continue;
    if (v.praeferenz > beste) beste = v.praeferenz;
  }
  return beste;
}

/**
 * Verbessert die Zuteilung, indem Paare ihre Plätze tauschen.
 *
 * Getauscht wird nur, wenn **beide** Schüler den Platz des anderen können
 * und die Gesamtfahrzeit sinkt. Läuft, bis keine Verbesserung mehr gefunden
 * wird oder die Rundengrenze erreicht ist, ohne Grenze könnte das bei
 * ungünstigen Daten lange laufen, und ein guter Plan in einer Sekunde ist
 * mehr wert als der beste in zehn Minuten.
 */
function verbessereDurchTausch(
  belegung: Map<number, Belegung[]>,
  eingabe: ZuteilEingabe,
  fahrzeit: Fahrzeitfunktion,
  puffer: number,
  maxRunden = 30
): void {
  const tage = [...belegung.keys()];

  const gesamt = () =>
    tage.reduce(
      (s, t) => s + tagesFahrzeit(belegung.get(t) ?? [], eingabe.zuhause, fahrzeit),
      0
    );

  for (let runde = 0; runde < maxRunden; runde++) {
    let verbessert = false;

    for (const tagA of tage) {
      for (const tagB of tage) {
        const listeA = belegung.get(tagA)!;
        const listeB = belegung.get(tagB)!;

        for (let i = 0; i < listeA.length; i++) {
          for (let j = 0; j < listeB.length; j++) {
            if (tagA === tagB && i === j) continue;

            const a = listeA[i];
            const b = listeB[j];

            // Können beide den Platz des anderen?
            const praefA = praeferenzFuer(
              a.schueler,
              tagB,
              b.beginnMin,
              b.beginnMin + a.schueler.lektionMinuten
            );
            const praefB = praeferenzFuer(
              b.schueler,
              tagA,
              a.beginnMin,
              a.beginnMin + b.schueler.lektionMinuten
            );
            if (praefA === 0 || praefB === 0) continue;

            const vorher = gesamt();

            // Tauschen
            const neuA: Belegung = {
              schueler: a.schueler,
              beginnMin: b.beginnMin,
              endeMin: b.beginnMin + a.schueler.lektionMinuten,
              paritaet: a.paritaet,
              praeferenz: praefA,
            };
            const neuB: Belegung = {
              schueler: b.schueler,
              beginnMin: a.beginnMin,
              endeMin: a.beginnMin + b.schueler.lektionMinuten,
              paritaet: b.paritaet,
              praeferenz: praefB,
            };
            listeA[i] = neuB;
            listeB[j] = neuA;

            // Kollidiert der Tausch mit jemand anderem?
            const kaputt =
              listeA.some(
                (x, k) => k !== i && kollidiert(listeA[i], x, puffer)
              ) ||
              listeB.some(
                (x, k) => k !== j && kollidiert(listeB[j], x, puffer)
              );

            if (kaputt || gesamt() >= vorher) {
              // Zurücknehmen
              listeA[i] = a;
              listeB[j] = b;
            } else {
              verbessert = true;
            }
          }
        }
      }
    }

    if (!verbessert) break;
  }
}

// ── Einzelnen Schüler nachträglich einpassen ───────────────

export type BestehenderTermin = {
  schuelerId: string;
  name: string;
  lat: number;
  lng: number;
  wochentag: number;
  /** "HH:MM" */
  beginn: string;
  lektionMinuten: number;
  paritaet: 0 | 1 | null;
};

export type Einpassung = {
  wochentag: number;
  /** "HH:MM" */
  beginn: string;
  paritaet: 0 | 1 | null;
  praeferenz: number;
  /** Zusätzliche Fahrzeit dieses Tages in Sekunden. */
  zusatzSekunden: number;
  /** Zwischen wem der Termin liegt, für die Anzeige. */
  davor: string | null;
  danach: string | null;
  /**
   * Füllt der Termin eine bestehende Lücke, ohne die Route zu verlängern?
   * Das ist der Idealfall: man fährt ohnehin vorbei.
   */
  aufDemWeg: boolean;
};

/**
 * Findet die besten Plätze für einen einzelnen Schüler im **laufenden** Plan.
 *
 * Anders als `teileZu` wird hier nichts umgestellt: Die bestehenden Termine
 * bleiben, wo sie sind. Gesucht wird nur, wo der Neue am wenigsten kostet.
 *
 * Das ist der Alltagsfall, mitten in der Periode meldet sich jemand an, und
 * die Frage ist nicht „wie sähe der perfekte Plan aus“, sondern „wo passt er
 * rein, ohne dass ich alle anderen umbuchen muss“.
 *
 * Der Idealfall ist ein Platz **auf dem Weg**: zwischen zwei Terminen, an
 * denen man ohnehin vorbeifährt. Dann kostet der neue Schüler fast nichts
 * an zusätzlicher Fahrzeit. Solche Plätze werden eigens markiert.
 */
export function findeEinpassung(params: {
  zuhause: Punkt;
  neuer: ZuteilSchueler;
  bestehend: BestehenderTermin[];
  fenster: Tagesfenster[];
  pufferMinuten: number;
  fahrzeit?: Fahrzeitfunktion;
  /** Wie viele Vorschläge zurückgegeben werden. */
  maxVorschlaege?: number;
  /** Ab wie vielen Sekunden Zusatzfahrzeit ein Platz nicht mehr „auf dem Weg“ ist. */
  aufDemWegGrenze?: number;
}): Einpassung[] {
  const fahrzeit = params.fahrzeit ?? schaetzeFahrzeit;
  const puffer = params.pufferMinuten;
  const grenze = params.aufDemWegGrenze ?? 300; // 5 Minuten

  if (!Number.isFinite(params.neuer.lat) || !Number.isFinite(params.neuer.lng)) {
    return [];
  }

  // Bestehende Termine je Tag, in Routenreihenfolge (nach Uhrzeit).
  const proTag = new Map<number, Belegung[]>();
  for (const f of params.fenster) proTag.set(f.wochentag, []);
  for (const t of params.bestehend) {
    const liste = proTag.get(t.wochentag);
    if (!liste) continue;
    liste.push({
      schueler: {
        id: t.schuelerId,
        name: t.name,
        lat: t.lat,
        lng: t.lng,
        rhythmus: t.paritaet === null ? "woechentlich" : "zweiwoechentlich",
        lektionMinuten: t.lektionMinuten,
        verfuegbarkeiten: [],
      },
      beginnMin: minutenVon(t.beginn),
      endeMin: minutenVon(t.beginn) + t.lektionMinuten,
      paritaet: t.paritaet,
      praeferenz: 2,
    });
  }
  for (const liste of proTag.values()) {
    liste.sort((a, b) => a.beginnMin - b.beginnMin);
  }

  const kandidaten: Einpassung[] = [];

  for (const p of moeglichePlaetze(params.neuer, params.fenster)) {
    const beginnMin = minutenVon(p.beginn);
    const endeMin = beginnMin + params.neuer.lektionMinuten;
    const tag = proTag.get(p.wochentag) ?? [];

    const paritaeten: Array<0 | 1 | null> =
      params.neuer.rhythmus === "zweiwoechentlich" ? [0, 1] : [null];

    for (const paritaet of paritaeten) {
      const kandidat = { beginnMin, endeMin, paritaet };
      if (tag.some((b) => kollidiert(kandidat, b, puffer))) continue;

      const vorher = tagesFahrzeit(tag, params.zuhause, fahrzeit);
      const nachher = tagesFahrzeit(
        [
          ...tag,
          {
            schueler: params.neuer,
            beginnMin,
            endeMin,
            paritaet,
            praeferenz: p.praeferenz,
          },
        ],
        params.zuhause,
        fahrzeit
      );
      const zusatz = Math.round(nachher - vorher);

      // Wer kommt direkt davor und danach? Für die Anzeige, damit sichtbar
      // wird, warum ein Platz günstig ist.
      const davor = [...tag]
        .filter((b) => b.endeMin <= beginnMin)
        .sort((a, b) => b.beginnMin - a.beginnMin)[0];
      const danach = [...tag]
        .filter((b) => b.beginnMin >= endeMin)
        .sort((a, b) => a.beginnMin - b.beginnMin)[0];

      kandidaten.push({
        wochentag: p.wochentag,
        beginn: p.beginn,
        paritaet,
        praeferenz: p.praeferenz,
        zusatzSekunden: zusatz,
        davor: davor?.schueler.name ?? null,
        danach: danach?.schueler.name ?? null,
        aufDemWeg: zusatz <= grenze,
      });
    }
  }

  // Wenig Zusatzfahrzeit zuerst, bei Gleichstand die lieber gesehene Zeit.
  kandidaten.sort(
    (a, b) => a.zusatzSekunden - b.zusatzSekunden || b.praeferenz - a.praeferenz
  );

  // Pro Tag höchstens zwei Vorschläge, damit die Liste über die Woche streut
  // statt fünfmal denselben Abend anzubieten.
  const proTagZahl = new Map<number, number>();
  const gefiltert = kandidaten.filter((k) => {
    const n = (proTagZahl.get(k.wochentag) ?? 0) + 1;
    if (n > 2) return false;
    proTagZahl.set(k.wochentag, n);
    return true;
  });

  return gefiltert.slice(0, params.maxVorschlaege ?? 8);
}

/** Lesbare Beschreibung einer Zuteilung. */
export function beschreibeZuteilung(z: Zuteilung): string {
  const tag = WEEKDAY_LABELS[z.wochentag] ?? String(z.wochentag);
  if (z.paritaet === null) return `Jeden ${tag} um ${z.beginn}`;
  const woche = z.paritaet === 0 ? "gerade Wochen" : "ungerade Wochen";
  return `Jeden zweiten ${tag} um ${z.beginn} (${woche})`;
}

/**
 * Wie weit wohnen zwei zugeteilte Nachbarn auseinander? Für die Anzeige,
 * damit auffällt, wenn zwei aufeinanderfolgende Termine quer durch die
 * Gegend führen.
 */
export function abstandMeter(a: Punkt, b: Punkt): number {
  return Math.round(haversineMeter(a, b));
}
