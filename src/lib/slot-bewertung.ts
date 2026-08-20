// ============================================================
// Freie Slots nach Routenkosten bewerten
//
// „Frei" ist nicht gleich „günstig". Ein Slot direkt nach einer bestehenden
// Lektion im Nachbardorf kostet fast nichts — derselbe freie Slot an einem
// sonst leeren Tag kostet einen kompletten Hin- und Rückweg. Wer beim
// Buchen und Verschieben nur „frei" sieht, wählt systematisch die teuren.
//
// Dieses Modul rechnet für jeden freien Slot aus, wie viel Fahrzeit er dem
// Tag tatsächlich hinzufügt, und ordnet ihn ein:
//   anschluss    – grenzt an eine bestehende Lektion, minimaler Umweg
//   zwischenhalt – am selben Tag gibt es Unterricht, aber mit Lücke
//   leerer_tag   – einziger Termin des Tages, ganzer Weg nur dafür
//
// Reine Funktionen. Die Slots kommen aus der Buchungs-Engine, die Termine
// und Koordinaten lädt der Aufrufer.
// ============================================================

import {
  schaetzeFahrzeit,
  type Fahrzeitfunktion,
  type Punkt,
} from "./geo";

export type SlotKategorie = "anschluss" | "zwischenhalt" | "leerer_tag";

export type BewerteterSlot = {
  beginn: string;
  ende: string;
  kategorie: SlotKategorie;
  /** Wie viel Fahrzeit dieser Slot dem Tag hinzufügt, in Sekunden. */
  zusatzfahrtSekunden: number;
  /** Ein Satz für die Anzeige, z. B. „direkt nach Marina". */
  begruendung: string;
};

export type TagesTermin = {
  start_at: string;
  end_at: string;
  lat: number;
  lng: number;
  /** Vorname für die Begründung („direkt nach Marina"). */
  name: string;
};

/** Lokaler Kalendertag in Zürich, als YYYY-MM-DD. */
function zuercherTag(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Fahrzeit einer Kette von Halten: zuhause → … → zuhause. */
function kettenFahrzeit(
  halte: Punkt[],
  zuhause: Punkt,
  fahrzeit: Fahrzeitfunktion
): number {
  if (halte.length === 0) return 0;
  let summe = fahrzeit(zuhause, halte[0]);
  for (let i = 1; i < halte.length; i++) {
    summe += fahrzeit(halte[i - 1], halte[i]);
  }
  summe += fahrzeit(halte[halte.length - 1], zuhause);
  return summe;
}

/** Minuten Abstand zwischen zwei ISO-Zeitpunkten. */
function minutenAbstand(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60000;
}

/**
 * Grenzt der Slot „direkt" an einen Termin? Eine halbe Stunde deckt Puffer
 * plus Fahrt zum Nachbarort ab; was weiter auseinanderliegt, ist eine echte
 * Lücke, in der David wartet.
 */
const ANSCHLUSS_MINUTEN = 30;

export function bewerteSlots(params: {
  slots: { beginn: string; ende: string }[];
  /** Gebuchte Termine im selben Zeitraum, alle Schüler. */
  termine: TagesTermin[];
  /** Wohnort des Schülers, für den gebucht wird. Ohne Koordinaten wird nur nach Lage im Tag eingeordnet. */
  schueler: Punkt | null;
  zuhause: Punkt;
  fahrzeit?: Fahrzeitfunktion;
}): BewerteterSlot[] {
  const fahrzeit = params.fahrzeit ?? schaetzeFahrzeit;

  // Termine nach Zürcher Kalendertag gruppieren, sortiert nach Beginn.
  const proTag = new Map<string, TagesTermin[]>();
  for (const t of params.termine) {
    const tag = zuercherTag(t.start_at);
    const liste = proTag.get(tag) ?? [];
    liste.push(t);
    proTag.set(tag, liste);
  }
  for (const liste of proTag.values()) {
    liste.sort((a, b) => a.start_at.localeCompare(b.start_at));
  }

  const bewertet: BewerteterSlot[] = params.slots.map((slot) => {
    const tag = zuercherTag(slot.beginn);
    const tagesTermine = proTag.get(tag) ?? [];

    if (tagesTermine.length === 0) {
      const zusatz = params.schueler
        ? fahrzeit(params.zuhause, params.schueler) +
          fahrzeit(params.schueler, params.zuhause)
        : 0;
      return {
        beginn: slot.beginn,
        ende: slot.ende,
        kategorie: "leerer_tag" as const,
        zusatzfahrtSekunden: zusatz,
        begruendung: "einziger Termin an diesem Tag — eigener Hin- und Rückweg",
      };
    }

    // Nachbarn im Tagesablauf finden.
    const vorher = [...tagesTermine]
      .reverse()
      .find((t) => t.end_at <= slot.beginn);
    const nachher = tagesTermine.find((t) => t.start_at >= slot.ende);

    const anVorher =
      vorher != null && minutenAbstand(vorher.end_at, slot.beginn) <= ANSCHLUSS_MINUTEN;
    const anNachher =
      nachher != null && minutenAbstand(slot.ende, nachher.start_at) <= ANSCHLUSS_MINUTEN;

    // Fahrzeit-Zuwachs: Tageskette mit und ohne den neuen Halt.
    let zusatz = 0;
    if (params.schueler) {
      const halteOhne = tagesTermine.map((t) => ({ lat: t.lat, lng: t.lng }));
      const halteMit: Punkt[] = [];
      let eingefuegt = false;
      for (const t of tagesTermine) {
        if (!eingefuegt && t.start_at >= slot.ende) {
          halteMit.push(params.schueler);
          eingefuegt = true;
        }
        halteMit.push({ lat: t.lat, lng: t.lng });
      }
      if (!eingefuegt) halteMit.push(params.schueler);

      zusatz =
        kettenFahrzeit(halteMit, params.zuhause, fahrzeit) -
        kettenFahrzeit(halteOhne, params.zuhause, fahrzeit);
    }

    if (anVorher || anNachher) {
      const nachbar = anVorher ? vorher! : nachher!;
      return {
        beginn: slot.beginn,
        ende: slot.ende,
        kategorie: "anschluss" as const,
        zusatzfahrtSekunden: Math.max(0, zusatz),
        begruendung: anVorher
          ? `direkt nach ${nachbar.name}`
          : `direkt vor ${nachbar.name}`,
      };
    }

    return {
      beginn: slot.beginn,
      ende: slot.ende,
      kategorie: "zwischenhalt" as const,
      zusatzfahrtSekunden: Math.max(0, zusatz),
      begruendung: "am selben Tag wie andere Lektionen, aber mit Lücke",
    };
  });

  // Günstigste zuerst: erst nach Kategorie (Anschluss vor Zwischenhalt vor
  // leerem Tag), innerhalb der Kategorie nach Fahrzeit-Zuwachs. Die
  // Kategorie zuerst, weil der Zuwachs ohne Schüler-Koordinaten 0 ist und
  // sonst ein leerer Tag fälschlich oben stünde.
  const rang: Record<SlotKategorie, number> = {
    anschluss: 0,
    zwischenhalt: 1,
    leerer_tag: 2,
  };
  bewertet.sort(
    (a, b) =>
      rang[a.kategorie] - rang[b.kategorie] ||
      a.zusatzfahrtSekunden - b.zusatzfahrtSekunden ||
      a.beginn.localeCompare(b.beginn)
  );

  return bewertet;
}
