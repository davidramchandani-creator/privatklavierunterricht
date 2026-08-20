// ============================================================
// iCal-Parser für den Apple-Kalender
//
// Nur so viel wie nötig: VEVENTs mit Start, Ende, Titel und einfachen
// Wiederholungen. Keine vollständige RFC-5545-Umsetzung — die brauchte
// niemand, und eine halbe wäre schlimmer als eine kleine ehrliche.
//
// Was bewusst unterstützt wird:
//   - Zeitzonen als UTC (Z) und als lokale Zeit mit TZID
//   - Ganztägige Termine (VALUE=DATE)
//   - RRULE mit FREQ DAILY/WEEKLY/MONTHLY, INTERVAL, COUNT, UNTIL, BYDAY
//   - EXDATE (einzelne Ausnahmen einer Serie)
//   - Gefaltete Zeilen (RFC 5545 erlaubt Umbruch nach 75 Zeichen)
//
// Was fehlt und warum es zu verschmerzen ist: BYMONTHDAY, BYSETPOS und
// verschobene Einzeltermine einer Serie (RECURRENCE-ID). Solche Termine
// werden lieber **ausgelassen als geraten** — ein falsch gesperrter Abend
// kostet Unterricht, ein nicht gesperrter kostet einen Anruf.
// ============================================================

export type IcalTermin = {
  uid: string;
  titel: string;
  /** Start als UTC-Instant. */
  start: Date;
  /** Ende als UTC-Instant. */
  ende: Date;
  ganztaegig: boolean;
};

/** Gefaltete Zeilen zusammenfügen: Folgezeile beginnt mit Space oder Tab. */
function entfalte(text: string): string[] {
  const zeilen = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const raus: string[] = [];
  for (const z of zeilen) {
    if ((z.startsWith(" ") || z.startsWith("\t")) && raus.length > 0) {
      raus[raus.length - 1] += z.slice(1);
    } else {
      raus.push(z);
    }
  }
  return raus;
}

type Feld = { name: string; params: Record<string, string>; wert: string };

function parseZeile(zeile: string): Feld | null {
  const doppel = zeile.indexOf(":");
  if (doppel < 0) return null;
  const kopf = zeile.slice(0, doppel);
  const wert = zeile.slice(doppel + 1);
  const teile = kopf.split(";");
  const name = teile[0].toUpperCase();
  const params: Record<string, string> = {};
  for (const p of teile.slice(1)) {
    const gleich = p.indexOf("=");
    if (gleich > 0) {
      params[p.slice(0, gleich).toUpperCase()] = p.slice(gleich + 1).replace(/^"|"$/g, "");
    }
  }
  return { name, params, wert };
}

/**
 * Ortszeit einer Zeitzone in einen UTC-Instant übersetzen.
 *
 * Ohne Bibliothek: Wir raten den Offset, prüfen ihn und korrigieren einmal.
 * Das genügt auch an Zeitumstellungstagen, weil der Fehler dort höchstens
 * eine Stunde beträgt und die Korrektur ihn auffängt.
 */
function alsUtc(
  j: number,
  m: number,
  t: number,
  h: number,
  min: number,
  tz: string
): Date {
  const raten = Date.UTC(j, m - 1, t, h, min);
  const offset = (kandidat: number): number => {
    const formatiert = new Intl.DateTimeFormat("sv-SE", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(kandidat));
    const [d, z] = formatiert.split(" ");
    const [jj, mm, tt] = d.split("-").map(Number);
    const [hh, mi] = z.split(":").map(Number);
    return Date.UTC(jj, mm - 1, tt, hh, mi) - kandidat;
  };
  const erste = raten - offset(raten);
  return new Date(erste - (offset(erste) - offset(raten)));
}

/** "20260820T173000Z" / "20260820T173000" / "20260820" → Date (UTC). */
function parseZeit(
  wert: string,
  params: Record<string, string>
): { zeitpunkt: Date; ganztaegig: boolean } | null {
  const roh = wert.trim();
  const datum = /^(\d{4})(\d{2})(\d{2})/.exec(roh);
  if (!datum) return null;
  const [, j, m, t] = datum.map(Number) as unknown as number[];

  if (params.VALUE === "DATE" || !roh.includes("T")) {
    return { zeitpunkt: new Date(Date.UTC(j, m - 1, t)), ganztaegig: true };
  }

  const zeit = /T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(roh);
  if (!zeit) return null;
  const h = Number(zeit[1]);
  const min = Number(zeit[2]);
  const istUtc = zeit[4] === "Z";

  if (istUtc) {
    return { zeitpunkt: new Date(Date.UTC(j, m - 1, t, h, min)), ganztaegig: false };
  }
  // Ohne Z gilt die TZID, und ohne TZID die Ortszeit — hier Zürich, weil
  // der Kalender einem Menschen in Zürich gehört.
  const tz = params.TZID || "Europe/Zurich";
  try {
    // alsUtc erwartet den Monat 1-basiert, so wie er im iCal steht.
    return { zeitpunkt: alsUtc(j, m, t, h, min, tz), ganztaegig: false };
  } catch {
    return { zeitpunkt: new Date(Date.UTC(j, m - 1, t, h, min)), ganztaegig: false };
  }
}

const WOCHENTAGE: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

/** Höchstzahl erzeugter Wiederholungen je Serie — Schutz vor Endlosschleifen. */
const MAX_WIEDERHOLUNGEN = 400;

/**
 * Wiederholungen einer Serie erzeugen, begrenzt auf ein Zeitfenster.
 *
 * Unbekannte FREQ-Werte liefern nur den Ersttermin zurück. Lieber eine
 * Sperre zu wenig als eine Woche zu Unrecht blockiert.
 */
function wiederhole(
  start: Date,
  rrule: string,
  bis: Date,
  ausnahmen: Set<number>
): Date[] {
  const regeln: Record<string, string> = {};
  for (const teil of rrule.split(";")) {
    const [k, v] = teil.split("=");
    if (k && v) regeln[k.toUpperCase()] = v;
  }

  const freq = (regeln.FREQ ?? "").toUpperCase();
  const interval = Math.max(1, Number(regeln.INTERVAL ?? 1));
  const count = regeln.COUNT ? Number(regeln.COUNT) : null;
  const until = regeln.UNTIL ? parseZeit(regeln.UNTIL, {})?.zeitpunkt ?? null : null;
  const byday = regeln.BYDAY
    ? regeln.BYDAY.split(",")
        .map((d) => WOCHENTAGE[d.replace(/^[-+]?\d+/, "").toUpperCase()])
        .filter((d) => d !== undefined)
    : [];

  const ende = until && until < bis ? until : bis;

  // Erst alle Termine erzeugen, die die Regel vorsieht, dann die Ausnahmen
  // abziehen. Die Reihenfolge ist nicht beliebig: Nach RFC 5545 begrenzt
  // COUNT die von der Regel erzeugte Menge, und EXDATE entfernt daraus.
  // Zöge man die Ausnahmen zuerst ab, würde die Serie um jede Ausnahme
  // **verlängert** — eine gestrichene Probe schöbe den Chor eine Woche
  // weiter, statt einfach auszufallen.
  const erzeugt: Date[] = [];
  const nimm = (d: Date) => {
    if (d > ende) return;
    erzeugt.push(new Date(d));
  };

  if (freq === "DAILY") {
    for (let i = 0; i < MAX_WIEDERHOLUNGEN; i++) {
      const d = new Date(start.getTime() + i * interval * 86400000);
      if (d > ende) break;
      nimm(d);
      if (count && erzeugt.length >= count) break;
    }
  } else if (freq === "WEEKLY") {
    const tage = byday.length > 0 ? byday : [start.getUTCDay()];
    // Woche für Woche durchgehen und die passenden Wochentage einsammeln.
    for (let w = 0; w < MAX_WIEDERHOLUNGEN; w++) {
      const wochenStart = new Date(
        start.getTime() + w * interval * 7 * 86400000
      );
      if (wochenStart > ende) break;
      for (const tag of tage) {
        const versatz = (tag - start.getUTCDay() + 7) % 7;
        const d = new Date(wochenStart.getTime() + versatz * 86400000);
        if (d < start || d > ende) continue;
        nimm(d);
      }
      if (count && erzeugt.length >= count) break;
    }
  } else if (freq === "MONTHLY") {
    for (let i = 0; i < MAX_WIEDERHOLUNGEN; i++) {
      const d = new Date(start);
      d.setUTCMonth(d.getUTCMonth() + i * interval);
      if (d > ende) break;
      nimm(d);
      if (count && erzeugt.length >= count) break;
    }
  } else {
    // Unbekannte oder fehlende Frequenz: nur der Ersttermin.
    nimm(start);
  }

  erzeugt.sort((a, b) => a.getTime() - b.getTime());
  const begrenzt = count ? erzeugt.slice(0, count) : erzeugt;
  return begrenzt.filter((d) => !ausnahmen.has(d.getTime()));
}

/**
 * iCal-Text in Termine übersetzen, begrenzt auf ein Zeitfenster.
 *
 * `von`/`bis` begrenzen, wie weit Serien aufgelöst werden. Ohne Grenze
 * würde eine Serie ohne UNTIL bis in alle Ewigkeit Zeilen erzeugen.
 */
export function parseIcal(
  text: string,
  von: Date,
  bis: Date
): IcalTermin[] {
  const zeilen = entfalte(text);
  const termine: IcalTermin[] = [];

  let inEvent = false;
  let uid = "";
  let titel = "";
  let start: { zeitpunkt: Date; ganztaegig: boolean } | null = null;
  let ende: { zeitpunkt: Date; ganztaegig: boolean } | null = null;
  let rrule = "";
  let dauerMs = 0;
  let ausnahmen = new Set<number>();
  let transparent = false;
  let abgesagt = false;
  let hatRecurrenceId = false;

  const zuruecksetzen = () => {
    uid = "";
    titel = "";
    start = null;
    ende = null;
    rrule = "";
    dauerMs = 0;
    ausnahmen = new Set();
    transparent = false;
    abgesagt = false;
    hatRecurrenceId = false;
  };

  for (const zeile of zeilen) {
    if (zeile.startsWith("BEGIN:VEVENT")) {
      inEvent = true;
      zuruecksetzen();
      continue;
    }
    if (zeile.startsWith("END:VEVENT")) {
      inEvent = false;
      if (!start) continue;
      // Abgesagte Termine sperren nichts, und „frei" markierte auch nicht:
      // Wer einen Termin als verfügbar markiert, will nicht blockiert sein.
      if (abgesagt || transparent) continue;
      // Verschobene Einzeltermine einer Serie könnten wir nicht korrekt
      // aus der Serie herausrechnen — lieber auslassen als raten.
      if (hatRecurrenceId) continue;

      const laenge =
        dauerMs > 0
          ? dauerMs
          : ende
            ? ende.zeitpunkt.getTime() - start.zeitpunkt.getTime()
            : start.ganztaegig
              ? 86400000
              : 3600000;

      const starts = rrule
        ? wiederhole(start.zeitpunkt, rrule, bis, ausnahmen)
        : [start.zeitpunkt];

      for (const s of starts) {
        if (s.getTime() + laenge < von.getTime()) continue;
        if (s > bis) continue;
        termine.push({
          uid: uid || `${s.getTime()}`,
          titel: titel || "Privat",
          start: s,
          ende: new Date(s.getTime() + laenge),
          ganztaegig: start.ganztaegig,
        });
      }
      continue;
    }
    if (!inEvent) continue;

    const feld = parseZeile(zeile);
    if (!feld) continue;

    switch (feld.name) {
      case "UID":
        uid = feld.wert.trim();
        break;
      case "SUMMARY":
        titel = feld.wert.replace(/\\,/g, ",").replace(/\\n/gi, " ").trim();
        break;
      case "DTSTART":
        start = parseZeit(feld.wert, feld.params);
        break;
      case "DTEND":
        ende = parseZeit(feld.wert, feld.params);
        break;
      case "DURATION": {
        // ISO-8601-Dauer, z. B. PT1H30M oder P1D.
        const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(feld.wert.trim());
        if (m) {
          dauerMs =
            (Number(m[1] ?? 0) * 86400 +
              Number(m[2] ?? 0) * 3600 +
              Number(m[3] ?? 0) * 60) *
            1000;
        }
        break;
      }
      case "RRULE":
        rrule = feld.wert.trim();
        break;
      case "EXDATE":
        for (const teil of feld.wert.split(",")) {
          const a = parseZeit(teil, feld.params);
          if (a) ausnahmen.add(a.zeitpunkt.getTime());
        }
        break;
      case "TRANSP":
        transparent = feld.wert.trim().toUpperCase() === "TRANSPARENT";
        break;
      case "STATUS":
        abgesagt = feld.wert.trim().toUpperCase() === "CANCELLED";
        break;
      case "RECURRENCE-ID":
        hatRecurrenceId = true;
        break;
    }
  }

  return termine;
}

/** webcal:// ist http(s) mit anderem Namen. Apple gibt so einen Link aus. */
export function normalisiereIcalUrl(url: string): string {
  const sauber = url.trim();
  if (sauber.startsWith("webcal://")) return "https://" + sauber.slice(9);
  return sauber;
}
