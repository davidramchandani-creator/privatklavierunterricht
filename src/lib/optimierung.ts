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
  gemeinsamerSlot,
  MAX_PAAR_DISTANZ_M,
  planeRouten,
  type PlanEingabe,
  type PlanSchueler,
  type Tagesfenster,
} from "./routing";
import { haversineMeter } from "./geo";
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
  /**
   * Belegte Plätze im Wochenplan. Weniger Plätze bei gleich vielen
   * Schülern heisst: Zweiwöchentliche teilen sich einen — und ein Slot
   * wird frei für den nächsten Schüler.
   */
  plaetze: number;
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
      plaetze: plan.positionen,
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

// ── Was-wäre-wenn auf Schülerseite ─────────────────────────

export type SchuelerAnfrage = {
  schuelerId: string;
  name: string;
  wochentag: number;
  /** Die Frage, die David dem Schüler stellen müsste — fertig formuliert. */
  frage: string;
  /** Was passiert, wenn die Antwort Ja ist. */
  wirkung: string;
  vorher: Kennzahlen;
  nachher: Kennzahlen;
  neuEingeplant: string[];
};

/**
 * Für jeden Schüler, der nicht in den Plan passt: Welche Frage an ihn
 * würde das ändern?
 *
 * Das Gegenstück zu `schlageOptimierungen`. Dort ändert David seine
 * eigenen Fenster, hier fragt er einen Schüler nach mehr Spielraum. Beides
 * kann man von Hand kaum überblicken, weil jede Änderung die ganze Route
 * umwirft — darum auch hier: stumpf durchrechnen statt klug raten.
 *
 * Durchgespielt wird je Unterrichtstag die grosszügigste Annahme — der
 * Schüler könnte dort das ganze Fenster. Bringt schon das nichts, bringt
 * auch keine halbe Stunde mehr etwas, und die Frage erübrigt sich. Bringt
 * es etwas, steht die Wirkung dabei, und David entscheidet, ob ihm das
 * die Nachfrage wert ist.
 */
export function schlageSchuelerAnfragen(
  eingabe: PlanEingabe
): SchuelerAnfrage[] {
  if (eingabe.schueler.length === 0 || eingabe.fenster.length === 0) return [];

  const basis = kennzahlen(eingabe);
  const plan = planeRouten(eingabe);
  const draussen = new Set(plan.nichtEingeplant.map((n) => n.schueler.id));

  const nameVon = new Map(eingabe.schueler.map((s) => [s.id, s.name]));
  const ergebnisse: SchuelerAnfrage[] = [];

  for (const s of eingabe.schueler) {
    if (!draussen.has(s.id)) continue;

    for (const t of eingabe.fenster) {
      // Annahme: An diesem Tag ginge das ganze Unterrichtsfenster.
      const geaendert: PlanSchueler = {
        ...s,
        moeglicheTage: [
          ...new Set([...(s.moeglicheTage ?? []), t.wochentag]),
        ],
        fenster: [
          ...(s.fenster ?? []).filter((f) => f.wochentag !== t.wochentag),
          {
            wochentag: t.wochentag,
            fruehestens: t.beginn,
            spaetestens: t.ende,
          },
        ],
      };

      const nach = kennzahlen({
        ...eingabe,
        schueler: eingabe.schueler.map((x) => (x.id === s.id ? geaendert : x)),
      });

      // Nur vorschlagen, wenn der Gefragte selbst hineinkommt und
      // niemand anders dafür hinausfällt.
      if (!nach.eingeplantIds.has(s.id)) continue;
      if (nach.zahlen.eingeplant <= basis.zahlen.eingeplant) continue;

      const neu = [...nach.eingeplantIds]
        .filter((id) => !basis.eingeplantIds.has(id))
        .map((id) => nameVon.get(id) ?? id);

      const tag = WEEKDAY_LABELS[t.wochentag] ?? String(t.wochentag);
      ergebnisse.push({
        schuelerId: s.id,
        name: s.name,
        wochentag: t.wochentag,
        frage: `Frag ${s.name}, ob es am ${tag} zwischen ${t.beginn} und ${t.ende} ginge.`,
        wirkung:
          neu.length > 1
            ? `Dann passen ${neu.join(" und ")} in den Plan.`
            : `Dann passt ${s.name} in den Plan.`,
        vorher: basis.zahlen,
        nachher: nach.zahlen,
        neuEingeplant: neu,
      });
    }
  }

  // ── Zweite Sorte: Fragen, die einen Platz freimachen ──────
  //
  // Auch wenn alle untergebracht sind, kann eine kleine Nachfrage viel
  // wert sein: Zwei Zweiwöchentliche, die sich um Minuten verpassen,
  // belegen zwei Plätze statt einen. Der echte Fall: Marina bis 18:00,
  // Justine ab 17:30 — der geteilte Montagsplatz scheitert um eine
  // Viertelstunde, und ohne diesen Hinweis sieht David nur das Ergebnis
  // („zwei getrennte Plätze"), nicht die um 15 Minuten verpasste
  // Gelegenheit.
  //
  // Für jedes solche Beinahe-Paar wird durchgerechnet: Was passiert, wenn
  // einer von beiden an einem Tag mehr Spielraum hätte? Frei wird ein
  // Platz nur, wenn der Planer die beiden dann tatsächlich zusammenlegt —
  // darum zählt die Wirkung über `plaetze`, nicht über die Annahme.
  const zweiwoechentliche = eingabe.schueler.filter(
    (s) => s.rhythmus === "zweiwoechentlich"
  );
  const teiltSchon = new Set<string>();
  for (const t of plan.tage) {
    for (const p of t.positionen) {
      if (
        p.geradeWoche &&
        p.ungeradeWoche &&
        p.geradeWoche.id !== p.ungeradeWoche.id
      ) {
        teiltSchon.add(p.geradeWoche.id);
        teiltSchon.add(p.ungeradeWoche.id);
      }
    }
  }

  for (let i = 0; i < zweiwoechentliche.length; i++) {
    for (let j = i + 1; j < zweiwoechentliche.length; j++) {
      const a = zweiwoechentliche[i];
      const b = zweiwoechentliche[j];
      if (teiltSchon.has(a.id) || teiltSchon.has(b.id)) continue;
      if (draussen.has(a.id) || draussen.has(b.id)) continue;
      if (haversineMeter(a, b) > MAX_PAAR_DISTANZ_M) continue;
      // Geht es schon heute zusammen, ist es kein Frage-Thema — dann hat
      // der Planer anders entschieden, vermutlich wegen der Fahrzeit.
      if (eingabe.fenster.some((t) => gemeinsamerSlot(a, b, t))) continue;

      for (const t of eingabe.fenster) {
        for (const [wer, anderer] of [
          [a, b],
          [b, a],
        ] as const) {
          const geaendert: PlanSchueler = {
            ...wer,
            moeglicheTage: [
              ...new Set([...(wer.moeglicheTage ?? []), t.wochentag]),
            ],
            fenster: [
              ...(wer.fenster ?? []).filter((f) => f.wochentag !== t.wochentag),
              { wochentag: t.wochentag, fruehestens: t.beginn, spaetestens: t.ende },
            ],
          };
          // Die Frage lohnt nur, wenn sie das Paar überhaupt möglich macht.
          if (!gemeinsamerSlot(geaendert, anderer, t)) continue;

          const nach = kennzahlen({
            ...eingabe,
            schueler: eingabe.schueler.map((x) =>
              x.id === wer.id ? geaendert : x
            ),
          });
          if (nach.zahlen.eingeplant < basis.zahlen.eingeplant) continue;
          const frei = basis.zahlen.plaetze - nach.zahlen.plaetze;
          if (frei <= 0) continue;

          const tag = WEEKDAY_LABELS[t.wochentag] ?? String(t.wochentag);
          ergebnisse.push({
            schuelerId: wer.id,
            name: wer.name,
            wochentag: t.wochentag,
            frage: `Frag ${wer.name}, ob es am ${tag} zwischen ${t.beginn} und ${t.ende} ginge.`,
            wirkung: `Dann teilen sich ${a.name} und ${b.name} einen Platz im Wechsel — ${
              frei === 1 ? "ein Slot wird frei" : `${frei} Slots werden frei`
            }.`,
            vorher: basis.zahlen,
            nachher: nach.zahlen,
            neuEingeplant: [],
          });
        }
      }
    }
  }

  // Beste zuerst: mehr Untergebrachte, dann weniger Fahrzeit. Pro Schüler
  // höchstens zwei Tage — die Frage „kannst du irgendwann irgendwo?" stellt
  // David besser selbst.
  ergebnisse.sort((a, b) => {
    if (a.nachher.eingeplant !== b.nachher.eingeplant) {
      return b.nachher.eingeplant - a.nachher.eingeplant;
    }
    if (a.nachher.plaetze !== b.nachher.plaetze) {
      return a.nachher.plaetze - b.nachher.plaetze;
    }
    return a.nachher.fahrzeitProWoche - b.nachher.fahrzeitProWoche;
  });
  const proSchueler = new Map<string, number>();
  const gefiltert = ergebnisse.filter((e) => {
    const n = proSchueler.get(e.schuelerId) ?? 0;
    if (n >= 2) return false;
    proSchueler.set(e.schuelerId, n + 1);
    return true;
  });

  return gefiltert.slice(0, 6);
}
