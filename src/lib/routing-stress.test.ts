import { describe, expect, it } from "vitest";
import {
  planeRouten,
  type PlanSchueler,
  type Tagesfenster,
} from "./routing";

/**
 * Der Stresstest, der den Planer ehrlich gemacht hat.
 *
 * Vierhundert deterministische Zufalls-Konstellationen, jede komplett
 * durchgeplant und gegen zwei Invarianten geprüft:
 *
 *   1. Jede platzierte Lektion ist gültig: im Unterrichtsfenster, im
 *      Fenster jedes beteiligten Schülers, ohne Überlappung.
 *   2. Kein offensichtliches Loch: Wer draussen bleibt, passt in den
 *      fertigen Plan auch wirklich nirgends hinein. Das ist die Sorte
 *      Fehler, die ein Mensch mit einem Blick sieht — „warum steht der
 *      nicht einfach am Donnerstag um 18:15?" — und die das Vertrauen ins
 *      Werkzeug zerstört.
 *
 * Beim ersten Lauf fielen 505 Verstösse an. Die Ursachen sind einzeln
 * behoben (siehe routing.ts: Slot-Prüfung der Paarung, tagesgenaue
 * Fenster in zeitErlaubt, Mitglieder- statt Stellvertreter-Prüfung,
 * Dringlichkeits-Durchgang in baueTag, Lückenfüller, Verdrängungszug,
 * Paar-Auflösung). Dieser Test hält den Zustand: Wer am Planer schraubt
 * und eine der Rettungsstufen bricht, sieht es hier, nicht erst David im
 * Admin.
 *
 * Fahrzeit ist konstant null, damit die Invarianten reine Intervall-Logik
 * bleiben — mit echten Fahrzeiten wäre „da wäre noch Platz" nicht mehr
 * eindeutig entscheidbar.
 */

let seed = 1;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};
const viertel = (min: number, max: number) => {
  const lo = Math.ceil(min / 15);
  const hi = Math.floor(max / 15);
  return (lo + Math.floor(rnd() * (hi - lo + 1))) * 15;
};
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const minuten = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

function konstellation(lauf: number): {
  tage: Tagesfenster[];
  schueler: PlanSchueler[];
} {
  seed = lauf * 7919 + 17;
  const tage: Tagesfenster[] = [];
  const anzahlTage = 2 + Math.floor(rnd() * 3);
  const wts = [1, 2, 3, 4, 5].sort(() => rnd() - 0.5).slice(0, anzahlTage);
  for (const wt of wts) {
    const von = viertel(13 * 60, 18 * 60);
    const bis = Math.min(viertel(von + 90, von + 450), 21 * 60 + 30);
    if (bis - von >= 45) {
      tage.push({ wochentag: wt, beginn: hhmm(von), ende: hhmm(bis) });
    }
  }
  const schueler: PlanSchueler[] = [];
  const n = 3 + Math.floor(rnd() * 12);
  for (let i = 0; i < n; i++) {
    const fenster: NonNullable<PlanSchueler["fenster"]> = [];
    const eigeneTage = [...tage]
      .sort(() => rnd() - 0.5)
      .slice(0, 1 + Math.floor(rnd() * Math.max(tage.length, 1)));
    for (const t of eigeneTage) {
      const von = viertel(15 * 60, 20 * 60);
      const bis = Math.min(viertel(von + 45, von + 240), 21 * 60 + 30);
      if (bis > von) {
        fenster.push({
          wochentag: t.wochentag,
          fruehestens: hhmm(von),
          spaetestens: hhmm(bis),
        });
      }
    }
    if (fenster.length === 0) continue;
    schueler.push({
      id: `s${i}`,
      name: `S${i}`,
      lat: 47.5 + rnd() * 0.08,
      lng: 8.6 + rnd() * 0.15,
      rhythmus: rnd() < 0.4 ? "zweiwoechentlich" : "woechentlich",
      lektionMinuten: 45,
      moeglicheTage: [...new Set(fenster.map((f) => f.wochentag))],
      fenster,
    });
  }
  return { tage, schueler };
}

describe("Stresstest: 400 Zufalls-Konstellationen", () => {
  it("platziert nur Gültiges und lässt kein offensichtliches Loch", () => {
    const verstoesse: string[] = [];

    for (let lauf = 0; lauf < 400; lauf++) {
      const { tage, schueler } = konstellation(lauf);
      if (tage.length === 0 || schueler.length === 0) continue;

      const plan = planeRouten({
        zuhause: { lat: 47.53, lng: 8.67 },
        schueler,
        fenster: tage,
        pufferMinuten: 0,
        fahrzeit: () => 0,
      });

      for (const t of plan.tage) {
        const tf = tage.find((x) => x.wochentag === t.wochentag)!;
        const belegt = t.positionen
          .map((p) => ({ von: minuten(p.beginn), bis: minuten(p.ende) }))
          .sort((a, b) => a.von - b.von);

        for (let i = 1; i < belegt.length; i++) {
          if (belegt[i].von < belegt[i - 1].bis) {
            verstoesse.push(`Lauf ${lauf}: Überlappung am ${t.wochentagName}`);
          }
        }

        for (const p of t.positionen) {
          const von = minuten(p.beginn);
          const bis = minuten(p.ende);
          if (von < minuten(tf.beginn) || bis > minuten(tf.ende)) {
            verstoesse.push(
              `Lauf ${lauf}: ${p.beginn} ausserhalb des Tagesfensters`
            );
          }
          for (const m of [p.geradeWoche, p.ungeradeWoche]) {
            if (!m) continue;
            const eigene = m.fenster!.filter(
              (f) => f.wochentag === t.wochentag
            );
            const ok = eigene.some(
              (f) =>
                von >= minuten(f.fruehestens) && bis <= minuten(f.spaetestens)
            );
            if (!ok) {
              verstoesse.push(
                `Lauf ${lauf}: ${m.name} um ${p.beginn} am ${t.wochentagName} ausserhalb seiner Fenster`
              );
            }
          }
        }
      }

      for (const { schueler: s } of plan.nichtEingeplant) {
        for (const t of plan.tage) {
          const tf = tage.find((x) => x.wochentag === t.wochentag);
          if (!tf) continue;
          const belegt = t.positionen.map((p) => ({
            von: minuten(p.beginn),
            bis: minuten(p.ende),
          }));
          for (const f of (s.fenster ?? []).filter(
            (x) => x.wochentag === t.wochentag
          )) {
            const von = Math.max(minuten(tf.beginn), minuten(f.fruehestens));
            const bis = Math.min(minuten(tf.ende), minuten(f.spaetestens));
            for (
              let start = Math.ceil(von / 15) * 15;
              start + 45 <= bis;
              start += 15
            ) {
              const frei = !belegt.some(
                (b) => start < b.bis && b.von < start + 45
              );
              if (frei) {
                verstoesse.push(
                  `Lauf ${lauf}: ${s.name} draussen, obwohl ${t.wochentagName} ${hhmm(start)} frei wäre`
                );
                start = bis; // ein Fund pro Tag genügt
              }
            }
          }
        }
      }
    }

    expect(verstoesse, verstoesse.slice(0, 5).join("\n")).toEqual([]);
  });
});
