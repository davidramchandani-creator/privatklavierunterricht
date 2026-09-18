import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  findeKonflikt,
  istAenderbar,
  normalisiere,
  routenplanZuZuteilungen,
  ueberschneidet,
  type ZuteilungEintrag,
} from "./zuteilung-uebernahme";
import type { PlanSchueler, Routenplan } from "./routing";

const s = (id: string, rhythmus: PlanSchueler["rhythmus"] = "woechentlich"): PlanSchueler => ({
  id,
  name: id.toUpperCase(),
  lat: 47.5,
  lng: 8.6,
  rhythmus,
  lektionMinuten: 45,
});

function plan(tage: Routenplan["tage"]): Routenplan {
  return {
    tage,
    nichtEingeplant: [],
    fahrzeitProWoche: 0,
    lektionenProWoche: 0,
    positionen: 0,
    fahrzeitProLektion: 0,
  };
}

const pos = (
  gerade: PlanSchueler | null,
  ungerade: PlanSchueler | null,
  beginn: string
) => ({
  geradeWoche: gerade,
  ungeradeWoche: ungerade,
  beginn,
  ende: "00:00",
  anfahrtSekunden: 0,
  vonKoordinate: { lat: 0, lng: 0 },
  nachKoordinate: { lat: 0, lng: 0 },
});

const tag = (wochentag: number, positionen: ReturnType<typeof pos>[]) => ({
  wochentag,
  wochentagName: "",
  positionen,
  fahrzeitSekunden: 0,
  heimwegSekunden: 0,
  auslastung: 0,
  passt: true,
  warnungen: [],
});

describe("Vom Routenplan zur Zuteilung", () => {
  it("ein wöchentlicher Schüler wird ein Eintrag ohne Parität", () => {
    const a = s("a");
    const z = routenplanZuZuteilungen(plan([tag(4, [pos(a, a, "17:00")])]));
    expect(z).toHaveLength(1);
    expect(z[0]).toMatchObject({
      schuelerId: "a",
      wochentag: 4,
      beginn: "17:00",
      paritaet: null,
      rhythmus: "woechentlich",
      status: "offen",
    });
  });

  it("ein geteilter Platz wird zu zwei Einträgen mit verschiedener Parität", () => {
    // Justine und Maurice teilen sich den Donnerstag 18:00. Das muss als
    // zwei Einträge ankommen, damit jeder einzeln freigegeben werden kann.
    const j = s("justine", "zweiwoechentlich");
    const m = s("maurice", "zweiwoechentlich");
    const z = routenplanZuZuteilungen(plan([tag(4, [pos(j, m, "18:00")])]));
    expect(z).toHaveLength(2);
    expect(z.find((x) => x.schuelerId === "justine")?.paritaet).toBe(0);
    expect(z.find((x) => x.schuelerId === "maurice")?.paritaet).toBe(1);
    expect(z.every((x) => x.beginn === "18:00" && x.rhythmus === "zweiwoechentlich")).toBe(true);
  });

  it("eine halb leere Position gibt einen Eintrag, die andere Hälfte bleibt frei", () => {
    const m = s("marina", "zweiwoechentlich");
    const z = routenplanZuZuteilungen(plan([tag(1, [pos(null, m, "17:15")])]));
    expect(z).toHaveLength(1);
    expect(z[0].paritaet).toBe(1);
  });

  it("alles beginnt als offen, nie als freigegeben", () => {
    // Freigegeben ist ein Zustand, der nur durch Davids Klick entsteht.
    const z = routenplanZuZuteilungen(
      plan([tag(1, [pos(s("a"), s("a"), "17:00"), pos(s("b", "zweiwoechentlich"), null, "18:00")])])
    );
    expect(z.every((x) => x.status === "offen" && x.freigegebenAm === null)).toBe(true);
  });
});

describe("Ältere Pläne", () => {
  it("bekommen Status und Rhythmus nachgetragen", () => {
    // Runden, die vor dem Umbau gerechnet wurden, haben die neuen Felder
    // nicht. Sie dürfen deswegen nicht kaputtgehen.
    const alt = {
      schuelerId: "x",
      name: "X",
      wochentag: 1,
      beginn: "17:00",
      paritaet: 1 as const,
      praeferenz: 2,
      anfahrtSekunden: 0,
      unveraendert: false,
    };
    const n = normalisiere(alt);
    expect(n.status).toBe("offen");
    expect(n.rhythmus).toBe("zweiwoechentlich");
  });
});

describe("Überschneidung", () => {
  const e = (wochentag: number, beginn: string, paritaet: 0 | 1 | null) => ({
    wochentag,
    beginn,
    paritaet,
  });

  it("gerade und ungerade zur selben Zeit ist kein Konflikt", () => {
    // Das ist der geteilte Platz, um den es überhaupt geht.
    expect(ueberschneidet(e(4, "18:00", 0), e(4, "18:00", 1))).toBe(false);
  });

  it("wöchentlich kollidiert mit beiden Wochen", () => {
    expect(ueberschneidet(e(4, "18:00", null), e(4, "18:00", 0))).toBe(true);
    expect(ueberschneidet(e(4, "18:00", null), e(4, "18:00", 1))).toBe(true);
  });

  it("verschiedene Tage kollidieren nie", () => {
    expect(ueberschneidet(e(1, "18:00", null), e(4, "18:00", null))).toBe(false);
  });

  it("der Puffer zählt mit", () => {
    // 17:00 bis 17:45 plus 15 Puffer reicht bis 18:00. 18:00 ist also frei,
    // 17:45 nicht.
    expect(ueberschneidet(e(4, "17:00", null), e(4, "18:00", null), 45, 15)).toBe(false);
    expect(ueberschneidet(e(4, "17:00", null), e(4, "17:45", null), 45, 15)).toBe(true);
  });

  it("nennt den Namen dessen, mit dem es sich beisst", () => {
    const uebrige: ZuteilungEintrag[] = [
      {
        ...normalisiere({
          schuelerId: "angela",
          name: "Angela",
          wochentag: 4,
          beginn: "16:00",
          paritaet: null,
          praeferenz: 2,
          anfahrtSekunden: 0,
          unveraendert: false,
        }),
      },
    ];
    expect(
      findeKonflikt({ schuelerId: "simon", wochentag: 4, beginn: "16:15", paritaet: null }, uebrige, 15)
    ).toBe("Angela");
    expect(
      findeKonflikt({ schuelerId: "simon", wochentag: 4, beginn: "17:00", paritaet: null }, uebrige, 15)
    ).toBeNull();
  });

  it("prüft nicht gegen sich selbst", () => {
    const ich = normalisiere({
      schuelerId: "a",
      name: "A",
      wochentag: 4,
      beginn: "17:00",
      paritaet: null,
      praeferenz: 2,
      anfahrtSekunden: 0,
      unveraendert: false,
    });
    expect(findeKonflikt({ ...ich, beginn: "17:15" }, [ich], 15)).toBeNull();
  });
});

describe("Was sich noch ändern lässt", () => {
  it("freigegebene Einträge nicht mehr", () => {
    // Dann existieren Abo, Termine und eine Mail mit genau diesem Termin.
    const basis = normalisiere({
      schuelerId: "a",
      name: "A",
      wochentag: 1,
      beginn: "17:00",
      paritaet: null,
      praeferenz: 2,
      anfahrtSekunden: 0,
      unveraendert: false,
    });
    expect(istAenderbar({ ...basis, status: "offen" })).toBe(true);
    expect(istAenderbar({ ...basis, status: "reserviert" })).toBe(true);
    expect(istAenderbar({ ...basis, status: "freigegeben" })).toBe(false);
  });
});

describe("Verdrahtung", () => {
  const wurzel = process.cwd();
  const freigabe = readFileSync(join(wurzel, "src", "lib", "freigabe-server.ts"), "utf8");
  const routingServer = readFileSync(join(wurzel, "src", "lib", "routing-server.ts"), "utf8");
  const werkbank = readFileSync(
    join(wurzel, "src", "app", "admin", "planung", "_components", "ZuteilungWerkbank.tsx"),
    "utf8"
  );
  const board = readFileSync(
    join(wurzel, "src", "app", "admin", "routenplanung", "_components", "RoutenplanerBoard.tsx"),
    "utf8"
  );

  it("ohne Abo wird nur reserviert, nichts angelegt, nichts verschickt", () => {
    // Martinas Fall. Die Reihenfolge im Code ist die Zusicherung: Der
    // Zweig für ohne_abo kommt vor jedem Aufruf, der etwas anlegt.
    const reserviert = freigabe.indexOf('art === "ohne_abo"');
    const abo = freigabe.indexOf("wendeUmstellungAn(admin");
    const serie = freigabe.indexOf("bookFixplatzSeries(admin");
    expect(reserviert).toBeGreaterThan(-1);
    expect(reserviert).toBeLessThan(abo);
    expect(reserviert).toBeLessThan(serie);
    // Und in diesem Zweig steht kein Mailversand.
    const zweig = freigabe.slice(reserviert, abo);
    expect(zweig).not.toContain("sendEmailNow");
  });

  it("Externe bekommen keine Mail", () => {
    const extern = freigabe.indexOf('art === "extern"');
    const naechster = freigabe.indexOf('art === "umstellung"');
    const zweig = freigabe.slice(extern, naechster);
    expect(zweig).toContain("setzeExternenTermin");
    expect(zweig).not.toContain("sendEmailNow");
  });

  it("die Freigabe gilt für genau einen Schüler", () => {
    // wendeUmstellungAn nimmt eine Liste. Hier darf nur ein Eintrag drin
    // sein, sonst ginge beim Klick auf einen Namen die Mail an alle.
    expect(freigabe).toMatch(/zuteilungen:\s*\[z\]/);
  });

  it("freigegebene Einträge überleben ein erneutes Übernehmen", () => {
    // Sonst würde ein Klick im Routenplaner einen verschickten Vertrag
    // still durch einen neuen Vorschlag ersetzen.
    expect(freigabe).toMatch(/status === "freigegeben"/);
    expect(freigabe).toContain("schonDa.has(z.schuelerId)");
  });

  it("reservierte Plätze hält der Routenplaner fest", () => {
    // Der Schüler „kann" dann nur noch genau dieses eine Fenster.
    expect(routingServer).toContain("ladeFestgehaltene");
    expect(routingServer).toMatch(/moeglicheTage:\s*\[fix\.wochentag\]/);
  });

  it("die Werkbank fragt vor jeder Freigabe nach", () => {
    // Eine Freigabe ist unumkehrbar und schickt eine Vertragsmail.
    expect(werkbank).toContain("window.confirm");
    expect(werkbank).toContain("lässt sich nicht rückgängig machen");
  });

  it("der Routenplaner hat den Übernehmen-Knopf", () => {
    expect(board).toContain("routenplanUebernehmen");
    expect(board).toContain("Als Zuteilung übernehmen");
  });
});

describe("Keine Freigabe mit Lücken", () => {
  // Flurina, 7. September 2026: Eine Admin-Abwesenheit bis Silvester stand
  // im Weg, 8 von 20 Terminen wurden gebucht, die Vertragsmail ging mit 8
  // Terminen raus. Seither: Erst rechnen, dann schreiben, dann mailen.
  const wurzel = process.cwd();
  const ohneKommentare = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const umstellung = ohneKommentare(
    readFileSync(join(wurzel, "src", "lib", "umstellung-server.ts"), "utf8")
  );
  const freigabe = ohneKommentare(
    readFileSync(join(wurzel, "src", "lib", "freigabe-server.ts"), "utf8")
  );
  const fixplatz = ohneKommentare(
    readFileSync(join(wurzel, "src", "lib", "fixplatz-server.ts"), "utf8")
  );

  it("beim neuen Abo wird geplant, bevor irgendetwas geschrieben wird", () => {
    const anfang = umstellung.indexOf("async function legeAboAn");
    const probe = umstellung.indexOf("planeFixplatzSerie(admin", anfang);
    const absage = umstellung.indexOf('.update({ status: "cancelled" })', anfang);
    const anlegen = umstellung.indexOf('.from("packages")\n    .insert(', anfang);
    expect(probe).toBeGreaterThan(anfang);
    expect(probe).toBeLessThan(absage);
    expect(probe).toBeLessThan(anlegen);
  });

  it("bei Lücken kommt ein Fehler mit Grund, und nichts geht raus", () => {
    const anfang = umstellung.indexOf("async function legeAboAn");
    const probe = umstellung.indexOf("planeFixplatzSerie(admin", anfang);
    const zweig = umstellung.slice(probe, probe + 900);
    expect(zweig).toContain("probe.offen.length > 0");
    expect(zweig).toContain("erklaereBlockade");
    expect(zweig).toContain("Nichts angelegt, keine Mail.");
  });

  it("beim bestehenden Abo ebenso, vor dem Absagen der alten Serie", () => {
    const anfang = freigabe.indexOf("Kein aktives Abo gefunden");
    const probe = freigabe.indexOf("planeFixplatzSerie(admin", anfang);
    const absage = freigabe.indexOf('.update({ status: "cancelled" })', anfang);
    const serie = freigabe.indexOf("bookFixplatzSeries(admin", anfang);
    const mail = freigabe.indexOf("sendEmailNow", anfang);
    expect(probe).toBeGreaterThan(anfang);
    expect(probe).toBeLessThan(absage);
    expect(probe).toBeLessThan(serie);
    expect(probe).toBeLessThan(mail);
  });

  it("Planen und Buchen sind derselbe Code", () => {
    // Sonst könnte die Vorprüfung ja sagen und das Buchen nein.
    const anfang = fixplatz.indexOf("async function bookFixplatzSeries");
    expect(fixplatz.indexOf("planeFixplatzSerie(admin", anfang)).toBeGreaterThan(anfang);
  });

  it("zweiwöchentlich weicht nur in der eigenen Woche aus", () => {
    // Die Folgewoche gehört dem Partner auf demselben Platz.
    const anfang = fixplatz.indexOf("ausweichKandidaten(");
    const filter = fixplatz.slice(anfang, anfang + 500);
    expect(filter).toContain('wunsch.rhythmus !== "zweiwoechentlich"');
    expect(filter).toContain("inDerselbenWoche(s.start, slot.start)");
  });

  it("die Erklärung nennt die Abwesenheit beim Namen", () => {
    expect(fixplatz).toContain("Deine Abwesenheit „${data.title}");
  });

  it("das Nachbuchen bucht nur, was fehlt, und nie über die Lektionenzahl hinaus", () => {
    const anfang = freigabe.indexOf("async function fuelleSerieAuf");
    const ende = freigabe.indexOf("async function gebeFrei", anfang);
    const fn = freigabe.slice(anfang, ende);
    expect(fn).toContain("!belegt.has(t.start.getTime())");
    expect(fn).toContain("belegt.size + neue.length > lessons");
    // Eigene Termine zählen nicht als Kollision, sonst wichen sie aus.
    expect(fn).toMatch(/ohneTermine:\s*\(vorhandene \?\? \[\]\)\.map/);
    // Lücken stoppen das Nachbuchen, mit Grund.
    expect(fn.indexOf("plan.offen.length > 0")).toBeLessThan(fn.indexOf('.insert('));
    // Erinnerungen und Google wie beim ersten Buchen, und keine Mail.
    expect(fn).toContain("scheduleLessonReminders");
    expect(fn).toContain("syncAppointmentToCalendar");
    expect(fn).not.toContain("sendEmailNow");
  });

  it("legt nur Ausweichtermine zurück, die der Plan nicht mehr braucht, und nur künftige", () => {
    // Daniels 14.9. war durch „START STUDIUM" gesperrt, wich auf den 21.9.
    // aus. Nach dem Löschen des Blocks gehört er zurück. Was ein Schüler
    // selbst verschoben hat, trägt die Notiz nicht und bleibt.
    const anfang = freigabe.indexOf("async function fuelleSerieAuf");
    const ende = freigabe.indexOf("async function gebeFrei", anfang);
    const fn = freigabe.slice(anfang, ende);
    const filter = fn.slice(fn.indexOf("const ueberfluessig"), fn.indexOf("for (const t of ueberfluessig)"));
    expect(filter).toContain('t.status === "booked"');
    expect(filter).toContain("new Date(t.start_at).getTime() > jetzt");
    expect(filter).toContain('startsWith("Ausweichtermin für ")');
    expect(filter).toContain("!sollZeiten.has(new Date(t.start_at).getTime())");
    // Beim Absagen: Erinnerung weg, Google weg.
    const absage = fn.slice(fn.indexOf("for (const t of ueberfluessig)"), fn.indexOf("const belegt"));
    expect(absage).toContain('status: "cancelled"');
    expect(absage).toContain("cancelLessonReminders");
    expect(absage).toContain("syncAppointmentToCalendar");
  });
});

describe("PDF auf Vercel", () => {
  // pdfkit liest Helvetica.afm zur Laufzeit von der Platte. Gebündelt fehlt
  // die Datei, und die Abo-Bestätigung endet mit ENOENT, live gesehen am
  // 7. September 2026.
  const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

  it("pdfkit bleibt ungebündelt und die Schriftdateien reisen mit", () => {
    expect(config).toMatch(/serverExternalPackages:\s*\[[^\]]*"pdfkit"/);
    expect(config).toMatch(/"\/api\/\*\*":\s*\["\.\/node_modules\/pdfkit\/js\/data\/\*\*"\]/);
    expect(config).toMatch(/"\/admin\/\*\*":\s*\["\.\/node_modules\/pdfkit\/js\/data\/\*\*"\]/);
  });
});

describe("Die Serie beginnt frühestens mit dem Abo", () => {
  // Emilie, 18. September 2026: Abo ab 1. Oktober, Serie ab 21. September.
  const freigabe = readFileSync(join(process.cwd(), "src", "lib", "freigabe-server.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const anfang = freigabe.indexOf("Kein aktives Abo gefunden");
  const zweig = freigabe.slice(anfang, freigabe.indexOf("async function setzeStatus", anfang));

  it("rechnet ab dem späteren von heute und Abo-Start", () => {
    expect(zweig).toContain("Math.max(Date.now()");
    expect(zweig).toContain("serienStart(aboStart)");
    expect((zweig.match(/now: serieAb/g) ?? []).length).toBe(2);
  });
});
