import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serienStart } from "./umstellung-server";

/**
 * Die Serie muss am Stichtag beginnen dürfen, nicht einen Tag später.
 *
 * `bookFixplatzSeries` verlangt 24 Stunden Vorlauf ab dem übergebenen
 * Zeitpunkt. Wird dort versehentlich der Stichtag selbst übergeben, rutscht
 * die erste Lektion eine ganze Woche nach hinten, weil der nächste passende
 * Wochentag erst dann wieder kommt. Das fiele niemandem auf, ausser dem
 * Schüler, der eine Woche zu spät anfängt und trotzdem ab dem Stichtag zahlt.
 */
describe("serienStart", () => {
  it("liegt genau 24 Stunden vor dem Stichtag", () => {
    const start = serienStart("2026-09-14");
    expect(start.toISOString()).toBe("2026-09-13T00:00:00.000Z");
  });

  it("erlaubt damit einen Termin am Stichtag selbst", () => {
    // Die Regel in firstSeriesStart lautet: frühestens = now + 24h.
    const start = serienStart("2026-09-14");
    const fruehestens = start.getTime() + 24 * 3600 * 1000;
    expect(fruehestens).toBe(Date.parse("2026-09-14T00:00:00.000Z"));
  });

  it("verschiebt nichts über Monatsgrenzen hinweg", () => {
    expect(serienStart("2026-10-01").toISOString()).toBe(
      "2026-09-30T00:00:00.000Z"
    );
  });
});

/**
 * Der zugesicherte Preis muss halten.
 *
 * Beim Ausfüllen kennt der Schüler seinen Wochentag noch nicht; gerechnet
 * wird über den ungünstigsten seiner angegebenen Tage. Würde beim Anwenden
 * mit dem tatsächlich zugeteilten Tag neu gerechnet, stünde auf der Rechnung
 * unter Umständen eine Lektion und ein Monatsbetrag mehr als in dem, was er
 * bestätigt hat.
 *
 * Das ist eine Zusicherung an den Schüler und lässt sich nicht als Zahl
 * prüfen, ohne die halbe Datenbank nachzubauen. Geprüft wird deshalb, dass
 * die Stelle im Code steht, die sie herstellt: der Preis kommt aus
 * `baueVorschauOhneTermin` mit den **angegebenen Tagen**, nicht aus einer
 * Rechnung über den zugeteilten Wochentag.
 */
describe("Preiszusicherung beim Anwenden", () => {
  const quelle = readFileSync(
    join(process.cwd(), "src", "lib", "umstellung-server.ts"),
    "utf8"
  );

  it("rechnet den Preis über die angegebenen Tage, nicht über den zugeteilten", () => {
    expect(quelle).toContain("baueVorschauOhneTermin");

    // Der Block, der das Paket anlegt, muss die zugesicherten Werte nehmen.
    const insert = quelle.slice(quelle.indexOf(".insert({"));
    expect(insert).toContain("total_price: zugesichert.gesamtpreis");
    expect(insert).toContain("price_per_lesson: zugesichert.preisProLektion");
    expect(insert).toContain("abo_lektionen: zugesichert.lektionen");
    expect(insert).toContain("monatsbetrag: zugesichert.monatsbetrag");
  });

  it("bucht nur die zugesicherte Lektionszahl", () => {
    expect(quelle).toContain("lessons: zugesichert.lektionen");
  });

  it("legt ohne Wahl kein Abo an", () => {
    // Wer nicht geantwortet hat, darf nicht stillschweigend ein Abo bekommen.
    expect(quelle).toContain("Hat kein Abo gewählt.");
    expect(quelle).toMatch(/if \(!wahl\?\.abo_variante \|\| !wahl\?\.abo_rhythmus\)/);
  });

  it("beendet das alte Paket, bevor das neue entsteht", () => {
    const altPos = quelle.indexOf('status: "expired"');
    const neuPos = quelle.indexOf(".insert({");
    expect(altPos).toBeGreaterThan(-1);
    expect(neuPos).toBeGreaterThan(-1);
    expect(altPos).toBeLessThan(neuPos);
  });
});

/**
 * Die Umstellungsrunde muss allen sichtbar sein.
 *
 * Eine gewöhnliche Runde wird Schülern ohne Fixplatz absichtlich nicht
 * gezeigt. Bei der Umstellung hat definitionsgemäss niemand einen, und ohne
 * Ausnahme sähe kein einziger Schüler das Formular. Der Fehler wäre
 * lautlos: keine Meldung, keine Antworten, eine leere Runde.
 */
describe("Sichtbarkeit im Portal", () => {
  const quelle = readFileSync(
    join(process.cwd(), "src", "app", "schueler", "portal", "actions.ts"),
    "utf8"
  );

  it("nimmt Umstellungsrunden vom Fixplatz-Filter aus", () => {
    expect(quelle).toContain('.art !== "umstellung"');
  });

  it("zeigt Testrunden nur Testschülern und echte nur echten", () => {
    // Ohne diese Grenze sähe ein echter Schüler das Formular eines
    // Probelaufs und antwortete in eine Runde, die ihn nie umstellen wird.
    expect(quelle).toContain(
      '(profil?.ist_test === true) !== allgemeinPassend.nurTest'
    );
  });
});

/**
 * Stufe 3 der Ausfall-Kaskade muss beim Abo eine Lektion anhängen.
 *
 * Die alte Umsetzung verlängerte die Laufzeit um eine Woche. Beim
 * Lektionspaket war das eine echte Kompensation: Der Schüler buchte selbst
 * und holte die Lektion in der gewonnenen Zeit nach.
 *
 * Beim Fixplatz-Abo ist es keine. Die Terminserie steht fest, der Schüler
 * bucht nichts, und eine längere Laufzeit erzeugt keinen einzigen Termin.
 * Er hätte bezahlt und nichts bekommen — und weil das Paket formal
 * „verlängert" wurde, sähe es nach Wiedergutmachung aus.
 *
 * Geprüft wird die Reihenfolge im Code, weil der eigentliche Ablauf ohne
 * Datenbank nicht nachzustellen ist.
 */
describe("Ausfall beim Fixplatz-Abo", () => {
  const quelle = readFileSync(
    join(process.cwd(), "src", "lib", "ausfall.ts"),
    "utf8"
  );

  it("versucht zuerst anzuhängen, bevor die Laufzeit wächst", () => {
    const anhaengen = quelle.indexOf("haengeLektionAn");
    const verlaengern = quelle.indexOf("gutschriftTage(pkg.rhythmus)");
    expect(anhaengen).toBeGreaterThan(-1);
    expect(verlaengern).toBeGreaterThan(-1);
    expect(anhaengen).toBeLessThan(verlaengern);
  });

  it("meldet den Nachholtermin als gebuchten Ersatz, nicht als Gutschrift", () => {
    expect(quelle).toContain('status: "ersatz_gebucht"');
    expect(quelle).toContain("ersatz_appointment_id");
  });

  it("schickt eine eigene Mail mit dem neuen Termin", () => {
    expect(quelle).toContain("ausfall_nachgeholt");
  });

  it("behält die Laufzeitverlängerung als Rückfallebene", () => {
    // Flex-Abos und alte Pakete haben keinen Fixplatz, an den sich etwas
    // anhängen liesse. Für sie muss die bisherige Regel bestehen bleiben.
    expect(quelle).toContain('status: "gutschrift"');
  });
});

/**
 * Die Nachholstunde muss auf dem Fixplatz landen.
 *
 * War der zuletzt gebuchte Termin ein Ausweichtermin an einem anderen
 * Wochentag, ergäbe blosses Weiterzählen ab diesem Datum eine Nachholstunde
 * am falschen Tag — und die nächste ginge wieder von der falschen aus.
 */
describe("Nachholtermin rastet auf den Fixplatz ein", () => {
  it("bestimmt den ersten Kandidaten über firstSeriesStart", () => {
    const quelle = readFileSync(
      join(process.cwd(), "src", "lib", "fixplatz-server.ts"),
      "utf8"
    );
    const fn = quelle.slice(quelle.indexOf("export async function haengeLektionAn"));
    expect(fn).toContain("firstSeriesStart(wunsch, ab, paritaet, 0)");
    // Und die Parität muss mitgegeben werden, sonst landet ein
    // zweiwöchentlicher Schüler in der falschen Kalenderwoche.
    expect(fn).toContain("fixplatz_week_parity");
  });
});

/**
 * Inaktive Schüler bleiben überall aussen vor.
 *
 * „Inaktiv" heisst: unterrichtet nicht mehr, soll aber im System bleiben —
 * wegen der Historie, der alten Rechnungen und weil vielleicht jemand
 * zurückkommt. Genau deshalb ist es gefährlich: Die Zeile steht noch da und
 * wird von jeder Abfrage gefunden, die nicht ausdrücklich filtert.
 *
 * Die Folgen wären unterschiedlich unangenehm. Eine Mail an jemanden, der
 * längst aufgehört hat, ist peinlich. Ein blockierter Platz im Stundenplan
 * fällt monatelang nicht auf. Ein „hat nicht geantwortet" in der Liste macht
 * die Liste wertlos, weil dort dauerhaft jemand steht, der nie antworten
 * wird.
 *
 * Der Test liest die Quellen und verlangt, dass jede Abfrage auf `profiles`
 * in diesen Pfaden nach `aktiv` filtert.
 */
describe("Inaktive Schüler", () => {
  const dateien = [
    ["src", "lib", "planung-server.ts"],
    ["src", "lib", "routing-server.ts"],
    ["src", "app", "admin", "planung", "actions.ts"],
  ];

  it("werden in keiner Sammelabfrage mitgezählt", () => {
    const suender: string[] = [];

    for (const teile of dateien) {
      const pfad = join(process.cwd(), ...teile);
      const quelle = readFileSync(pfad, "utf8");

      // Jede Abfrage, die alle Schüler holt, erkennt man an role = student.
      // Sie muss im selben Aufruf auch aktiv prüfen.
      const stellen = quelle.split('.eq("role", "student")');
      for (let i = 1; i < stellen.length; i++) {
        // Der Filter steht direkt daneben, innerhalb weniger Zeilen.
        const umfeld =
          stellen[i - 1].slice(-400) + '.eq("role", "student")' + stellen[i].slice(0, 400);
        if (!umfeld.includes('.eq("aktiv", true)')) {
          suender.push(`${teile.join("/")}: Abfrage ${i} ohne aktiv-Filter`);
        }
      }
    }

    expect(suender, `Ohne aktiv-Filter:\n${suender.join("\n")}`).toEqual([]);
  });

  it("belegen keinen Platz im bestehenden Stundenplan", () => {
    // ladeBestehendenPlan geht über packages und verbindet profiles. Der
    // Filter muss deshalb auf der verbundenen Tabelle stehen.
    const quelle = readFileSync(
      join(process.cwd(), "src", "lib", "planung-server.ts"),
      "utf8"
    );
    const fn = quelle.slice(
      quelle.indexOf("export async function ladeBestehendenPlan")
    );
    expect(fn.slice(0, 1500)).toContain('.eq("profiles.aktiv", true)');
  });
});

/**
 * Der Stichtag schneidet, nicht der Anwenden-Klick.
 *
 * Zwischen Anwenden (kurz nach der Frist) und Abo-Start können Wochen
 * liegen, und in denen läuft das alte Paket weiter — so verspricht es die
 * Info-Mail. Die erste Fassung beendete das alte Paket im Moment des Klicks
 * und sagte auch die Termine vor dem Stichtag ab: Wer am 22.08. anwendete,
 * nahm den Schülern drei Wochen bezahlten Unterricht weg, ohne Meldung.
 */
describe("Übergang am Stichtag", () => {
  const quelle = readFileSync(
    join(process.cwd(), "src", "lib", "umstellung-server.ts"),
    "utf8"
  );

  it("sagt vom alten Paket nur Termine ab dem Stichtag ab", () => {
    // gte(stichtag), nicht gt(jetzt): Was vor dem Stichtag liegt, findet statt.
    expect(quelle).toContain('.gte("start_at", stichtagIso)');
    expect(quelle).not.toContain('.gt("start_at", new Date().toISOString())');
  });

  it("legt das Abo als geplant an, wenn der Start in der Zukunft liegt", () => {
    expect(quelle).toContain('status: sofort ? "active" : "scheduled"');
  });

  it("beendet das alte Paket nur bei sofortigem Start gleich mit", () => {
    const block = quelle.slice(
      quelle.indexOf("for (const alt of alte ?? [])"),
      quelle.indexOf("const { data: pkg, error }")
    );
    expect(block).toContain("if (sofort)");
    expect(block).toContain('update({ status: "expired" })');
    // Im Warte-Fall wird nur die Verlängerung abgestellt.
    expect(block).toContain("auto_renew: false");
  });

  it("aktiviert am Stichtag in der richtigen Reihenfolge", () => {
    const fn = quelle.slice(
      quelle.indexOf("export async function aktiviereGeplanteAbos")
    );
    const altBeenden = fn.indexOf('update({ status: "expired" })');
    const neuAktivieren = fn.indexOf('update({ status: "active" })');
    // Erst das alte beenden, dann das neue aktivieren. Andersherum bricht
    // der Eindeutigkeits-Index den Wechsel ab und das Abo bliebe für immer
    // geplant, ohne dass es jemand merkt.
    expect(altBeenden).toBeGreaterThan(-1);
    expect(neuAktivieren).toBeGreaterThan(-1);
    expect(altBeenden).toBeLessThan(neuAktivieren);
  });

  it("hängt am Cron, nicht an einem Knopf", () => {
    const jobs = readFileSync(
      join(process.cwd(), "src", "lib", "subscription-jobs.ts"),
      "utf8"
    );
    // Vor der Ratenfakturierung, damit die erste Abo-Rate am Stichtag
    // selbst gestellt werden kann.
    const aktivierung = jobs.indexOf("aktiviereGeplanteAbos(admin)");
    const fakturierung = jobs.indexOf("invoiceDueInstalments(admin, today)");
    expect(aktivierung).toBeGreaterThan(-1);
    expect(aktivierung).toBeLessThan(fakturierung);
  });
});
