// ============================================================
// Optimierungs-Vorschläge für die Verfügbarkeit
//
// Beantwortet die Frage, die der Routenplaner selbst nicht stellt: Was
// müsste David an seinen eigenen Fenstern ändern, damit mehr Schüler
// hineinpassen oder dieselben Schüler weniger Fahrzeit kosten?
//
// Verfahren: stumpfes Durchprobieren. Jede Kandidaten-Änderung (Fenster
// vorne/hinten verlängern, Tag streichen, Tag öffnen) wird als kompletter
// Plan durchgerechnet und mit dem Ist-Zustand verglichen. Das ist bewusst
// keine Analyse der Engpässe — bei 20 Schülern und einem Dutzend Kandidaten
// ist Durchrechnen billiger als klug sein, und es kann nicht durch eine
// falsche Vereinfachung danebenliegen.
//
// Reine Funktionen, keine DB. Die Daten kommen aus routing-server.
// ============================================================

import {
  planeRouten,
  type PlanEingabe,
  type Tagesfenster,
} from "./routing";
import { WEEKDAY_LABELS } from "./fixplatz";

export type OptimierungsArt =
  | "fenster_vorne"
  | "fenster_hinten"
  | "tag_streichen"
  | "tag_oeffnen";

export type Kennzahlen = {
  eingeplant: number;
  nichtEingeplant: number;
  fahrzeitProWoche: number;
  tage: number;
};

export type Optimierung = {
  art: OptimierungsArt;
  wochentag: number;
  /** Ein Satz, den man ohne die Zahlen versteht. */
  beschreibung: string;
  /** Das geänderte Fenster, falls die Art eines hat. */
  beginn?: string;
  ende?: string;
  vorher: Kennzahlen;
  nachher: Kennzahlen;
  /** Schüler, die durch die Änderung neu hineinpassen. */
  neuEingeplant: string[];
};

function minuten(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function zeit(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDauerMin(sekunden: number): string {
  const min = Math.round(sekunden / 60);
  if (min < 60) return `${min} Min.`;
  return `${Math.floor(min / 60)} h ${min % 60} Min.`;
}

function kennzahlen(eingabe: PlanEingabe): {
  zahlen: Kennzahlen;
  eingeplantIds: Set<string>;
} {
  const plan = planeRouten(eingabe);
  const ids = new Set<string>();
  for (const t of plan.tage) {
    for (const p of t.positionen) {
      if (p.geradeWoche) ids.add(p.geradeWoche.id);
      if (p.ungeradeWoche) ids.add(p.ungeradeWoche.id);
    }
  }
  return {
    zahlen: {
      eingeplant: ids.size,
      nichtEingeplant: plan.nichtEingeplant.length,
      fahrzeitProWoche: plan.fahrzeitProWoche,
      tage: plan.tage.filter((t) => t.positionen.length > 0).length,
    },
    eingeplantIds: ids,
  };
}

/** Früher als 13:00 oder später als 21:30 wird nicht vorgeschlagen. */
const FRUEHESTER_BEGINN = 13 * 60;
const SPAETESTES_ENDE = 21 * 60 + 30;

/** Standardfenster für den Vorschlag, einen ganz neuen Tag zu öffnen. */
const NEUER_TAG_BEGINN = "16:00";
const NEUER_TAG_ENDE = "20:30";

/** Unter 10 Minuten Ersparnis pro Woche lohnt kein Umbau. */
const MIN_ERSPARNIS_SEKUNDEN = 10 * 60;

/**
 * Rechnet Änderungs-Kandidaten an der Verfügbarkeit durch und liefert die,
 * die etwas bringen: mehr untergebrachte Schüler, weniger Fahrzeit oder
 * weniger Unterrichtstage.
 *
 * Auch wenn heute schon alle untergebracht sind, lohnt der Blick — und erst
 * recht, wenn nicht: Für jeden herausgefallenen Schüler steht dann da,
 * welche Änderung ihn hineinholen würde. Genau das kann man von Hand kaum
 * sehen, weil jede Fensteränderung die ganze Route umwirft.
 */
export function schlageOptimierungen(eingabe: PlanEingabe): Optimierung[] {
  if (eingabe.schueler.length === 0) return [];

  const basis = kennzahlen(eingabe);
  const vorschlaege: Optimierung[] = [];

  const pruefe = (
    art: OptimierungsArt,
    wochentag: number,
    fenster: Tagesfenster[],
    beschreibe: (o: {
      neu: string[];
      ersparnis: number;
      tageWeniger: number;
    }) => string,
    geaendert?: { beginn: string; ende: string }
  ) => {
    const variante = kennzahlen({ ...eingabe, fenster });

    const neu = [...variante.eingeplantIds]
      .filter((id) => !basis.eingeplantIds.has(id))
      .map(
        (id) => eingabe.schueler.find((s) => s.id === id)?.name ?? "Unbekannt"
      );
    const verloren = [...basis.eingeplantIds].filter(
      (id) => !variante.eingeplantIds.has(id)
    );
    // Wer jemanden hinauswirft, ist kein Vorschlag. Möglichst alle
    // unterbringen geht vor jeder Fahrzeit-Ersparnis.
    if (verloren.length > 0) return;

    const ersparnis =
      basis.zahlen.fahrzeitProWoche - variante.zahlen.fahrzeitProWoche;
    const tageWeniger = basis.zahlen.tage - variante.zahlen.tage;

    const bringtSchueler = neu.length > 0;
    const bringtZeit = ersparnis >= MIN_ERSPARNIS_SEKUNDEN;
    const bringtTage = tageWeniger > 0 && ersparnis > 0;
    if (!bringtSchueler && !bringtZeit && !bringtTage) return;

    vorschlaege.push({
      art,
      wochentag,
      beschreibung: beschreibe({ neu, ersparnis, tageWeniger }),
      beginn: geaendert?.beginn,
      ende: geaendert?.ende,
      vorher: basis.zahlen,
      nachher: variante.zahlen,
      neuEingeplant: neu,
    });
  };

  const tagName = (w: number) => WEEKDAY_LABELS[w] ?? `Tag ${w}`;

  const nutzenSatz = (o: {
    neu: string[];
    ersparnis: number;
    tageWeniger: number;
  }): string => {
    const teile: string[] = [];
    if (o.neu.length > 0) {
      teile.push(
        o.neu.length === 1
          ? `${o.neu[0]} passt dann hinein`
          : `${o.neu.join(", ")} passen dann hinein`
      );
    }
    if (o.tageWeniger > 0) {
      teile.push(
        o.tageWeniger === 1
          ? "ein Unterrichtstag fällt weg"
          : `${o.tageWeniger} Unterrichtstage fallen weg`
      );
    }
    if (o.ersparnis >= MIN_ERSPARNIS_SEKUNDEN) {
      teile.push(`spart ${formatDauerMin(o.ersparnis)} Fahrt pro Woche`);
    }
    return teile.join("; ");
  };

  // 1. Bestehende Fenster verlängern, vorne und hinten, in zwei Stufen.
  //    45 Minuten sind eine Lektion, 90 zwei — kleinere Schritte bringen
  //    wegen des Rasters nichts.
  for (const f of eingabe.fenster) {
    for (const schritt of [45, 90]) {
      const neuerBeginn = minuten(f.beginn) - schritt;
      if (neuerBeginn >= FRUEHESTER_BEGINN) {
        const geaendert = { ...f, beginn: zeit(neuerBeginn) };
        pruefe(
          "fenster_vorne",
          f.wochentag,
          eingabe.fenster.map((x) => (x === f ? geaendert : x)),
          (o) =>
            `${tagName(f.wochentag)} schon ab ${zeit(neuerBeginn)} statt ${
              f.beginn
            }: ${nutzenSatz(o)}.`,
          { beginn: geaendert.beginn, ende: geaendert.ende }
        );
      }

      const neuesEnde = minuten(f.ende) + schritt;
      if (neuesEnde <= SPAETESTES_ENDE) {
        const geaendert = { ...f, ende: zeit(neuesEnde) };
        pruefe(
          "fenster_hinten",
          f.wochentag,
          eingabe.fenster.map((x) => (x === f ? geaendert : x)),
          (o) =>
            `${tagName(f.wochentag)} bis ${zeit(neuesEnde)} statt ${
              f.ende
            }: ${nutzenSatz(o)}.`,
          { beginn: geaendert.beginn, ende: geaendert.ende }
        );
      }
    }
  }

  // 2. Einen Tag ganz streichen. Bringt nur etwas, wenn trotzdem alle
  //    unterkommen — das prüft `pruefe` ohnehin.
  //
  //    Zusätzlich die Kombination „streichen und dafür einen anderen Tag
  //    verlängern": Der häufigste echte Fall ist, dass der gestrichene Tag
  //    nur deshalb nötig war, weil woanders eine Dreiviertelstunde fehlt.
  //    Einzeln durchprobiert findet man das nie — das Streichen allein
  //    wirft jemanden raus, das Verlängern allein ändert nichts.
  if (eingabe.fenster.length > 1) {
    for (const f of eingabe.fenster) {
      const ohne = eingabe.fenster.filter((x) => x !== f);
      pruefe(
        "tag_streichen",
        f.wochentag,
        ohne,
        (o) => `${tagName(f.wochentag)} ganz freinehmen: ${nutzenSatz(o)}.`
      );

      for (const anderes of ohne) {
        for (const schritt of [45, 90]) {
          const neuesEnde = minuten(anderes.ende) + schritt;
          if (neuesEnde <= SPAETESTES_ENDE) {
            pruefe(
              "tag_streichen",
              f.wochentag,
              ohne.map((x) =>
                x === anderes ? { ...x, ende: zeit(neuesEnde) } : x
              ),
              (o) =>
                `${tagName(f.wochentag)} ganz freinehmen und dafür ${tagName(
                  anderes.wochentag
                )} bis ${zeit(neuesEnde)} statt ${anderes.ende}: ${nutzenSatz(o)}.`
            );
          }

          const neuerBeginn = minuten(anderes.beginn) - schritt;
          if (neuerBeginn >= FRUEHESTER_BEGINN) {
            pruefe(
              "tag_streichen",
              f.wochentag,
              ohne.map((x) =>
                x === anderes ? { ...x, beginn: zeit(neuerBeginn) } : x
              ),
              (o) =>
                `${tagName(f.wochentag)} ganz freinehmen und dafür ${tagName(
                  anderes.wochentag
                )} schon ab ${zeit(neuerBeginn)} statt ${anderes.beginn}: ${nutzenSatz(o)}.`
            );
          }
        }
      }
    }
  }

  // 3. Einen neuen Wochentag öffnen (Mo–Fr). Spekulativ, denn ob David an
  //    dem Tag überhaupt kann, weiss nur er — darum steht es als Frage da,
  //    nicht als Anweisung.
  const belegt = new Set(eingabe.fenster.map((f) => f.wochentag));
  for (let w = 1; w <= 5; w++) {
    if (belegt.has(w)) continue;
    pruefe(
      "tag_oeffnen",
      w,
      [
        ...eingabe.fenster,
        { wochentag: w, beginn: NEUER_TAG_BEGINN, ende: NEUER_TAG_ENDE },
      ].sort((a, b) => a.wochentag - b.wochentag),
      (o) =>
        `Falls du ${tagName(w)} ${NEUER_TAG_BEGINN}–${NEUER_TAG_ENDE} könntest: ${nutzenSatz(
          o
        )}.`,
      { beginn: NEUER_TAG_BEGINN, ende: NEUER_TAG_ENDE }
    );
  }

  // Sortierung: erst wer Schüler hineinholt, dann nach Fahrzeit-Ersparnis.
  // Ein Vorschlag, der jemanden unterbringt, schlägt jede Viertelstunde.
  vorschlaege.sort((a, b) => {
    if (a.neuEingeplant.length !== b.neuEingeplant.length) {
      return b.neuEingeplant.length - a.neuEingeplant.length;
    }
    return (
      a.nachher.fahrzeitProWoche - b.nachher.fahrzeitProWoche
    );
  });

  // Pro Art und Tag nur den besten Vorschlag: „Montag ab 15:30" und
  // „Montag ab 14:45" nebeneinander wären Rauschen, der bessere genügt.
  const gesehen = new Set<string>();
  const gefiltert = vorschlaege.filter((v) => {
    const key = `${v.art}:${v.wochentag}`;
    if (gesehen.has(key)) return false;
    gesehen.add(key);
    return true;
  });

  return gefiltert.slice(0, 6);
}
