// ============================================================
// Abo-Modell — Laufzeit statt Lektionspaket
//
// Der Schüler kauft eine Periode (Halbjahr oder Jahr) und zahlt monatlich.
// Wie viele Lektionen darin liegen, ergibt sich aus seinem Rhythmus und der
// Ferienlage — und wird beim Kauf **für seinen konkreten Fixplatz exakt
// ausgerechnet**, nicht pauschal versprochen.
//
// Warum exakt und nicht pauschal: In einem Quartal liegen je nach Jahreszeit
// 8 bis 11 wöchentliche Lektionen. Eine runde Zahl auf die Website zu
// schreiben wäre in der Hälfte der Fälle falsch — mal zu Lasten des Schülers,
// mal zu deinen.
//
// Was das nebenbei vereinfacht: Schulferien sind in der Lektionszahl bereits
// berücksichtigt. Sie lösen deshalb **keine** Laufzeitverlängerung mehr aus.
// Die Ausfall-Kaskade greift nur noch bei einzelnen Absagen.
//
// Reine Funktionen — DB-Zugriff liegt in abo-server.ts.
// ============================================================

import { INTERVAL_DAYS, type Rhythmus } from "./rhythmus";
import { roundRappen } from "./subscription";

export type AboVariante = "halbjahr" | "jahr";

export const ABO_LAUFZEIT_MONATE: Record<AboVariante, number> = {
  halbjahr: 6,
  jahr: 12,
};

export const ABO_LABELS: Record<AboVariante, string> = {
  halbjahr: "Halbjahresabo",
  jahr: "Jahresabo",
};

/**
 * Ein unterrichtsfreier Zeitraum (Schulferien, Feiertagswochen).
 * Beide Grenzen zählen mit.
 */
export type Ferienzeitraum = {
  bezeichnung: string;
  start: string; // YYYY-MM-DD
  ende: string; // YYYY-MM-DD
};

function alsTag(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ausTag(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Liegt der Tag in einem der Ferienzeiträume? */
export function istFerientag(tag: string, ferien: Ferienzeitraum[]): boolean {
  return ferien.some((f) => tag >= f.start && tag <= f.ende);
}

/** Letzter Tag der Periode: Start + n Monate, minus einen Tag. */
export function periodenEnde(start: string, monate: number): string {
  const [y, m, d] = start.split("-").map(Number);
  const gesamt = y * 12 + (m - 1) + monate;
  const zy = Math.floor(gesamt / 12);
  const zm = (gesamt % 12) + 1;
  const letzterImMonat = new Date(Date.UTC(zy, zm, 0)).getUTCDate();
  const zd = Math.min(d, letzterImMonat);
  const ende = new Date(Date.UTC(zy, zm - 1, zd) - 86400000);
  return alsTag(ende);
}

export type AboTermine = {
  /** Alle Unterrichtstage der Periode (ISO), Ferien bereits ausgenommen. */
  termine: string[];
  /** Tage, die wegen Ferien ausfallen – für die Anzeige „fällt aus wegen …“. */
  ferientage: { tag: string; grund: string }[];
  anzahl: number;
};

/**
 * Zählt die tatsächlichen Unterrichtstermine einer Abo-Periode.
 *
 * Gerechnet wird über den konkreten Wochentag des Fixplatzes, nicht über
 * „Wochen im Zeitraum“. Ein Schüler mit Dienstagstermin verliert die
 * Sportferien anders als einer mit Freitagstermin — der Unterschied ist
 * klein, aber er soll bei jedem stimmen.
 */
export function berechneAboTermine(params: {
  /** Erster möglicher Unterrichtstag (ISO). */
  start: string;
  /** Letzter Tag der Periode (ISO), einschliesslich. */
  ende: string;
  /** 0 = Sonntag … 6 = Samstag. */
  weekday: number;
  rhythmus: Rhythmus;
  ferien: Ferienzeitraum[];
}): AboTermine {
  const abstand = INTERVAL_DAYS[params.rhythmus];
  const termine: string[] = [];
  const ferientage: { tag: string; grund: string }[] = [];

  // Ersten passenden Wochentag ab Periodenstart finden.
  const d = ausTag(params.start);
  while (d.getUTCDay() !== params.weekday) {
    d.setUTCDate(d.getUTCDate() + 1);
  }

  const ende = ausTag(params.ende);
  while (d <= ende) {
    const tag = alsTag(d);
    const ferien = params.ferien.find((f) => tag >= f.start && tag <= f.ende);
    if (ferien) {
      ferientage.push({ tag, grund: ferien.bezeichnung });
    } else {
      termine.push(tag);
    }
    d.setUTCDate(d.getUTCDate() + abstand);
  }

  return { termine, ferientage, anzahl: termine.length };
}

export type AboAngebot = {
  variante: AboVariante;
  rhythmus: Rhythmus;
  laufzeitMonate: number;
  periodeStart: string;
  periodeEnde: string;
  /** Exakte Lektionszahl für diesen Fixplatz in dieser Periode. */
  lektionen: number;
  preisProLektion: number;
  gesamtpreis: number;
  monatsbetrag: number;
  /** Die konkreten Unterrichtstage. */
  termine: string[];
  /** Was wegen Ferien ausfällt – bereits eingerechnet. */
  ferientage: { tag: string; grund: string }[];
};

/**
 * Baut ein vollständiges Abo-Angebot für einen konkreten Fixplatz.
 *
 * Der Monatsbetrag ist über die ganze Laufzeit gleich, unabhängig davon, wie
 * viele Lektionen in einen einzelnen Monat fallen. Im Dezember sind es wegen
 * der Weihnachtsferien vielleicht zwei, im März fünf — der Betrag bleibt
 * derselbe. Das ist der Sinn eines Abos: eine verlässliche Zahl auf beiden
 * Seiten, statt einer Abrechnung, die jeden Monat anders aussieht.
 */
export function baueAboAngebot(params: {
  variante: AboVariante;
  rhythmus: Rhythmus;
  weekday: number;
  periodeStart: string;
  preisProLektion: number;
  ferien: Ferienzeitraum[];
}): AboAngebot {
  const laufzeitMonate = ABO_LAUFZEIT_MONATE[params.variante];
  const ende = periodenEnde(params.periodeStart, laufzeitMonate);

  const { termine, ferientage, anzahl } = berechneAboTermine({
    start: params.periodeStart,
    ende,
    weekday: params.weekday,
    rhythmus: params.rhythmus,
    ferien: params.ferien,
  });

  const gesamtpreis = roundRappen(anzahl * params.preisProLektion);
  const monatsbetrag = roundRappen(gesamtpreis / laufzeitMonate);

  return {
    variante: params.variante,
    rhythmus: params.rhythmus,
    laufzeitMonate,
    periodeStart: params.periodeStart,
    periodeEnde: ende,
    lektionen: anzahl,
    preisProLektion: params.preisProLektion,
    gesamtpreis,
    monatsbetrag,
    termine,
    ferientage,
  };
}

export type Monatsrate = {
  sequenz: number;
  betrag: number;
  faellig: string;
};

/**
 * Die Monatsraten einer Abo-Periode.
 *
 * Alle Beträge gleich, die letzte nimmt den Rundungsrest auf, damit die
 * Summe exakt dem Gesamtpreis entspricht. Fällig jeweils am Monatstag des
 * Periodenstarts.
 */
export function baueMonatsraten(
  gesamtpreis: number,
  laufzeitMonate: number,
  periodeStart: string
): Monatsrate[] {
  const gesamt = roundRappen(gesamtpreis);
  const nominal = roundRappen(gesamt / laufzeitMonate);
  const raten: Monatsrate[] = [];
  let verteilt = 0;

  for (let i = 0; i < laufzeitMonate; i++) {
    const istLetzte = i === laufzeitMonate - 1;
    const betrag = istLetzte ? roundRappen(gesamt - verteilt) : nominal;
    verteilt = roundRappen(verteilt + betrag);

    // Fälligkeit: erster Monat sofort, danach monatlich.
    const [y, m, d] = periodeStart.split("-").map(Number);
    const gesamtMonate = y * 12 + (m - 1) + i;
    const zy = Math.floor(gesamtMonate / 12);
    const zm = (gesamtMonate % 12) + 1;
    const letzterImMonat = new Date(Date.UTC(zy, zm, 0)).getUTCDate();
    const zd = Math.min(d, letzterImMonat);

    raten.push({
      sequenz: i + 1,
      betrag,
      faellig: `${zy}-${String(zm).padStart(2, "0")}-${String(zd).padStart(2, "0")}`,
    });
  }

  return raten;
}

/**
 * Kündigungsfrist vor Ablauf der Periode, in Tagen.
 * Danach verlängert sich das Abo automatisch um dieselbe Laufzeit.
 */
export const ABO_KUENDIGUNGSFRIST_TAGE = 30;

/** Letzter Tag, an dem noch fristgerecht gekündigt werden kann. */
export function kuendigungsfrist(periodeEnde: string): string {
  const d = ausTag(periodeEnde);
  d.setUTCDate(d.getUTCDate() - ABO_KUENDIGUNGSFRIST_TAGE);
  return alsTag(d);
}

export function istKuendbar(periodeEnde: string, heute: string): boolean {
  return heute <= kuendigungsfrist(periodeEnde);
}
