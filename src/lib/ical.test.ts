import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalisiereIcalUrl, parseIcal } from "./ical";
import { alsBloecke } from "./apple-kalender";

/**
 * Der Parser entscheidet, welche Abende gesperrt sind. Zwei Fehlerarten mit
 * sehr unterschiedlichen Folgen:
 *
 *   - Ein Termin wird übersehen → ein Schüler landet auf Davids Zahnarzt.
 *   - Ein Termin wird zu breit gelesen → ein Abend ist grundlos zu.
 *
 * Beides ist schlecht, das erste schlimmer. Wo der Standard mehrdeutig ist,
 * lässt der Parser lieber aus, statt zu raten — diese Tests halten fest,
 * wo genau das gilt.
 */

const von = new Date("2026-08-01T00:00:00Z");
const bis = new Date("2026-12-31T00:00:00Z");

function kalender(inhalt: string): string {
  return `BEGIN:VCALENDAR\nVERSION:2.0\n${inhalt}\nEND:VCALENDAR`;
}

describe("Einzeltermine", () => {
  it("liest Start, Ende und Titel", () => {
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:abc-1",
          "SUMMARY:Zahnarzt",
          "DTSTART:20260915T140000Z",
          "DTEND:20260915T150000Z",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t).toHaveLength(1);
    expect(t[0].titel).toBe("Zahnarzt");
    expect(t[0].start.toISOString()).toBe("2026-09-15T14:00:00.000Z");
    expect(t[0].ende.toISOString()).toBe("2026-09-15T15:00:00.000Z");
  });

  it("versteht gefaltete Zeilen", () => {
    // RFC 5545 bricht nach 75 Zeichen um; die Folgezeile beginnt mit Space.
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:abc-2",
          "SUMMARY:Ein sehr langer Termintitel der umgebrochen",
          "  wurde",
          "DTSTART:20260915T140000Z",
          "DTEND:20260915T150000Z",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t[0].titel).toBe("Ein sehr langer Termintitel der umgebrochen wurde");
  });

  it("rechnet Ortszeit mit TZID in UTC um", () => {
    // 15.9.2026 ist Sommerzeit: Zürich = UTC+2.
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:abc-3",
          "DTSTART;TZID=Europe/Zurich:20260915T170000",
          "DTEND;TZID=Europe/Zurich:20260915T180000",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t[0].start.toISOString()).toBe("2026-09-15T15:00:00.000Z");
  });

  it("nimmt DURATION, wenn kein DTEND da ist", () => {
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:abc-4",
          "DTSTART:20260915T140000Z",
          "DURATION:PT1H30M",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t[0].ende.toISOString()).toBe("2026-09-15T15:30:00.000Z");
  });
});

describe("Was nicht sperren soll", () => {
  it("überspringt abgesagte Termine", () => {
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:abc-5",
          "STATUS:CANCELLED",
          "DTSTART:20260915T140000Z",
          "DTEND:20260915T150000Z",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t).toHaveLength(0);
  });

  it("überspringt als frei markierte Termine", () => {
    // TRANSP:TRANSPARENT heisst „zeigt mich als verfügbar". Wer das setzt,
    // will nicht blockiert werden.
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:abc-6",
          "TRANSP:TRANSPARENT",
          "DTSTART:20260915T140000Z",
          "DTEND:20260915T150000Z",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t).toHaveLength(0);
  });

  it("überspringt verschobene Einzeltermine einer Serie", () => {
    // RECURRENCE-ID liesse sich nicht sauber aus der Serie herausrechnen.
    // Auslassen ist ehrlicher als raten.
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:abc-7",
          "RECURRENCE-ID:20260915T140000Z",
          "DTSTART:20260916T140000Z",
          "DTEND:20260916T150000Z",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t).toHaveLength(0);
  });
});

describe("Serien", () => {
  it("löst wöchentliche Wiederholung mit COUNT auf", () => {
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:serie-1",
          "SUMMARY:Chor",
          "DTSTART:20260907T190000Z",
          "DTEND:20260907T210000Z",
          "RRULE:FREQ=WEEKLY;COUNT=4",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t).toHaveLength(4);
    expect(t[0].start.toISOString()).toBe("2026-09-07T19:00:00.000Z");
    expect(t[3].start.toISOString()).toBe("2026-09-28T19:00:00.000Z");
  });

  it("beachtet UNTIL", () => {
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:serie-2",
          "DTSTART:20260907T190000Z",
          "DTEND:20260907T210000Z",
          "RRULE:FREQ=WEEKLY;UNTIL=20260921T235959Z",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t).toHaveLength(3);
  });

  it("lässt EXDATE-Termine aus", () => {
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:serie-3",
          "DTSTART:20260907T190000Z",
          "DTEND:20260907T210000Z",
          "RRULE:FREQ=WEEKLY;COUNT=4",
          "EXDATE:20260914T190000Z",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t).toHaveLength(3);
    expect(
      t.some((x) => x.start.toISOString() === "2026-09-14T19:00:00.000Z")
    ).toBe(false);
  });

  it("versteht INTERVAL", () => {
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:serie-4",
          "DTSTART:20260907T190000Z",
          "DTEND:20260907T210000Z",
          "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=3",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t.map((x) => x.start.toISOString())).toEqual([
      "2026-09-07T19:00:00.000Z",
      "2026-09-21T19:00:00.000Z",
      "2026-10-05T19:00:00.000Z",
    ]);
  });

  it("läuft bei einer endlosen Serie nicht davon", () => {
    // Ohne COUNT und UNTIL: Es muss am Zeitfenster enden, nicht endlos.
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:serie-5",
          "DTSTART:20260907T190000Z",
          "DTEND:20260907T210000Z",
          "RRULE:FREQ=WEEKLY",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t.length).toBeGreaterThan(10);
    expect(t.length).toBeLessThan(30);
    expect(t[t.length - 1].start <= bis).toBe(true);
  });

  it("gibt bei unbekannter Frequenz nur den Ersttermin", () => {
    const t = parseIcal(
      kalender(
        [
          "BEGIN:VEVENT",
          "UID:serie-6",
          "DTSTART:20260907T190000Z",
          "DTEND:20260907T210000Z",
          "RRULE:FREQ=SECONDLY",
          "END:VEVENT",
        ].join("\n")
      ),
      von,
      bis
    );
    expect(t).toHaveLength(1);
  });
});

describe("In Sperrzeiten übersetzen", () => {
  it("teilt Termine über Mitternacht auf", () => {
    // Ein Block „22:00–01:00" wäre für jede Kollisionsprüfung ein leeres
    // Intervall — die Sperre verpuffte lautlos.
    const bloecke = alsBloecke(
      {
        uid: "nacht",
        titel: "Konzert",
        start: new Date("2026-09-15T20:00:00Z"), // 22:00 Zürich
        ende: new Date("2026-09-15T23:00:00Z"), // 01:00 Zürich am 16.
        ganztaegig: false,
      },
      "Konzert"
    );
    expect(bloecke).toHaveLength(2);
    expect(bloecke[0].date).toBe("2026-09-15");
    expect(bloecke[0].end_time).toBe("23:59");
    expect(bloecke[1].date).toBe("2026-09-16");
    expect(bloecke[1].start_time).toBe("00:00");
  });

  it("sperrt ganztägige Termine komplett", () => {
    const bloecke = alsBloecke(
      {
        uid: "ferien",
        titel: "Ferien",
        start: new Date("2026-09-15T00:00:00Z"),
        ende: new Date("2026-09-18T00:00:00Z"),
        ganztaegig: true,
      },
      "Ferien"
    );
    expect(bloecke).toHaveLength(3);
    expect(bloecke.every((b) => b.start_time === "00:00")).toBe(true);
  });

  it("wirft Termine ohne Dauer weg", () => {
    const bloecke = alsBloecke(
      {
        uid: "leer",
        titel: "Erinnerung",
        start: new Date("2026-09-15T14:00:00Z"),
        ende: new Date("2026-09-15T14:00:00Z"),
        ganztaegig: false,
      },
      "Erinnerung"
    );
    expect(bloecke).toHaveLength(0);
  });
});

describe("Link-Format", () => {
  it("macht aus webcal ein https", () => {
    expect(normalisiereIcalUrl("webcal://p01.icloud.com/x.ics")).toBe(
      "https://p01.icloud.com/x.ics"
    );
    expect(normalisiereIcalUrl(" https://a.ch/b.ics ")).toBe("https://a.ch/b.ics");
  });
});

describe("Verdrahtung", () => {
  it("schreibt in time_blocks, wo alle schon nachschauen", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const quelle = readFileSync(
      join(process.cwd(), "src", "lib", "apple-kalender.ts"),
      "utf8"
    );
    // Eine eigene Tabelle müsste an Buchung, Routenplanung und Zuteilung
    // je einzeln eingehängt werden — die eine vergessene Stelle wäre der
    // Fehler, den man erst merkt, wenn jemand vor verschlossener Tür steht.
    expect(quelle).toContain('from("time_blocks")');
    // Und Davids handgemachte Blöcke dürfen dabei nie mitgelöscht werden.
    expect(quelle).toContain('.eq("quelle", "apple")');
  });

  it("hängt am täglichen Cron", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const jobs = readFileSync(
      join(process.cwd(), "src", "lib", "subscription-jobs.ts"),
      "utf8"
    );
    expect(jobs).toContain("gleicheAppleKalenderAb(admin)");
  });
});

/**
 * Ein täglicher Abgleich genügt nicht: Wer morgens einen Termin einträgt,
 * erwartet, dass nachmittags niemand mehr auf diese Zeit gebucht werden
 * kann. Apple bietet kein Push, es muss also geholt werden.
 *
 * Seit dem Performance-Audit aber nicht mehr überall gleich. Der Abruf
 * hing im Ladepfad jeder Seite, die freie Zeiten zeigt — bei wenig Verkehr
 * praktisch bei jedem Aufruf, mit bis zu sechs Sekunden vor dem ersten
 * Byte. Jetzt:
 *
 *   Buchen     → wird gewartet. Hier entsteht der Schaden.
 *   Anschauen  → nach der Antwort nachladen, der nächste Aufruf ist frisch.
 *
 * Die Trennung ist der Kern und darum hier festgenagelt: Wer sie
 * versehentlich aufhebt, macht entweder die Startseite wieder langsam
 * oder das Buchen unsicher.
 */
describe("Frisch genug beim Buchen, schnell genug beim Anschauen", () => {
  const server = readFileSync(
    join(process.cwd(), "src", "lib", "apple-kalender.ts"),
    "utf8"
  );
  const booking = readFileSync(
    join(process.cwd(), "src", "lib", "booking-server.ts"),
    "utf8"
  );
  const fn = booking.slice(
    booking.indexOf("export async function loadAvailabilityContext")
  );

  it("wartet beim echten Buchen auf den Abruf", () => {
    // Die eine Stelle, durch die alle Buchungswege laufen. In die einzelnen
    // Aufrufer eingebaut wäre es ein Dutzend Stellen, und die eine
    // vergessene wäre die, die jemanden auf einen privaten Eintrag setzt.
    expect(fn).toContain("await stelleAppleKalenderSicher(admin, SOFORT)");
    // Und zwar bevor die Sperrzeiten gelesen werden, sonst wirkt es erst
    // beim nächsten Mal.
    const abruf = fn.indexOf("await stelleAppleKalenderSicher");
    const abfrage = fn.indexOf('.from("time_blocks")');
    expect(abruf).toBeGreaterThan(-1);
    expect(abruf).toBeLessThan(abfrage);
  });

  it("blockiert den Lesepfad nicht", () => {
    // Der Abruf im Nicht-Buchen-Zweig darf nicht erwartet werden.
    const leseZweig = fn.slice(fn.indexOf("} else if"), fn.indexOf('.from("time_blocks")'));
    expect(leseZweig).toContain("after(");
    expect(leseZweig).not.toContain("await stelleAppleKalenderSicher");
  });

  it("prüft die Frische, ohne dafür abzurufen", () => {
    // Sonst wäre nichts gewonnen: Die Prüfung selbst dürfte nicht schon
    // den langsamen Weg gehen.
    expect(server).toContain("export async function appleKalenderVeraltet");
    const pruef = server.slice(
      server.indexOf("export async function appleKalenderVeraltet"),
      server.indexOf("export async function stelleAppleKalenderSicher")
    );
    expect(pruef).not.toContain("gleicheAppleKalenderAb");
  });

  it("lässt einen fehlenden Request-Kontext nicht durchschlagen", () => {
    // `after` wirft ausserhalb einer Anfrage (Cron, Skript). Das darf die
    // Slot-Berechnung nicht mitreissen.
    const leseZweig = fn.slice(fn.indexOf("} else if"), fn.indexOf('.from("time_blocks")'));
    expect(leseZweig).toContain("catch");
  });

  it("bündelt gleichzeitige Abrufe", () => {
    // Eine Serienprüfung über zehn Termine darf nicht zehn HTTP-Abrufe
    // auslösen, die alle dasselbe holen.
    expect(server).toContain("laufenderAbruf");
  });

  it("lässt eine Buchung nicht an iCloud scheitern", () => {
    // Ist der Kalender langsam oder weg, wird mit den bekannten Sperren
    // weitergerechnet. Alles andere hiesse: Apple hat eine Störung, also
    // kann niemand mehr buchen.
    const fn = server.slice(
      server.indexOf("export async function stelleAppleKalenderSicher")
    );
    expect(fn).toContain("catch");
    expect(fn).toContain("zeitlimitMs");
  });

  it("holt vor dem echten Buchen zwingend neu", () => {
    // Beim Anschauen einer Slot-Liste ist eine Minute Verzug egal, beim
    // Buchen entsteht der Schaden. Darum dort ohne Puffer.
    expect(server).toContain("export const SOFORT = 0");
    const serien = readFileSync(
      join(process.cwd(), "src", "lib", "series-booking.ts"),
      "utf8"
    );
    expect(serien).toContain("kalenderJetzt: true");
  });

  it("läuft zusätzlich als eigener, täglicher Cron", () => {
    const vercel = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8")
    ) as { crons: { path: string; schedule: string }[] };
    const job = vercel.crons.find((c) => c.path.includes("apple-kalender"));
    expect(job).toBeDefined();
  });

  it("kein Cron läuft öfter als täglich — sonst deployt Vercel gar nicht mehr", () => {
    // Bitter gelernt: Der Hobby-Plan erlaubt nur tägliche Crons. Ein
    // 15-Minuten-Takt hier drin hat nicht etwa nur den Cron gedrosselt,
    // sondern JEDES Deployment kommentarlos verhindert — kein Build, kein
    // Log, kein Fehler auf GitHub. Die Seite blieb still auf dem alten
    // Stand, während alle Commits sauber auf main lagen. Die Häufigkeit
    // ist auch verzichtbar: Das Holen vor jeder Slot-Berechnung
    // (stelleAppleKalenderSicher) trägt die eigentliche Frische.
    const vercel = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8")
    ) as { crons: { path: string; schedule: string }[] };
    for (const cron of vercel.crons) {
      // Täglich heisst: feste Minute, feste Stunde, keine Schrägstriche,
      // keine Listen — das Muster "M H * * *" mit reinen Zahlen.
      expect(
        cron.schedule,
        `${cron.path} läuft öfter als täglich (${cron.schedule})`
      ).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
    }
  });
});
