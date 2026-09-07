import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  baueFeed,
  falte,
  icsText,
  icsZeit,
  neuerToken,
  type FeedTermin,
} from "./kalender-feed";

const termin = (p: Partial<FeedTermin> = {}): FeedTermin => ({
  id: "11111111-2222-3333-4444-555555555555",
  beginn: "2026-09-14T15:15:00.000Z",
  ende: "2026-09-14T16:00:00.000Z",
  status: "booked",
  name: "Marina Bollman",
  adresse: "Sattleracherstrasse 19, 8413 Neftenbach",
  hausbesuch: true,
  ...p,
});

const STEMPEL = new Date("2026-09-01T06:00:00.000Z");

/**
 * Ein minimaler iCalendar-Leser: faltet Zeilen zurück und liefert je
 * VEVENT die Felder. Kein vollständiger Parser, aber genau die Prüfung,
 * die eine Kalender-App als Erstes macht.
 */
function lies(feed: string): Record<string, string>[] {
  expect(feed.endsWith("\r\n")).toBe(true);
  const entfaltet = feed.replace(/\r\n[ \t]/g, "");
  const zeilen = entfaltet.split("\r\n").filter(Boolean);
  const events: Record<string, string>[] = [];
  let aktuell: Record<string, string> | null = null;
  for (const z of zeilen) {
    if (z === "BEGIN:VEVENT") aktuell = {};
    else if (z === "END:VEVENT") {
      events.push(aktuell!);
      aktuell = null;
    } else if (aktuell) {
      const i = z.indexOf(":");
      const schluessel = z.slice(0, i).split(";")[0];
      // Alarme mehrfach: nur zählen.
      if (schluessel === "BEGIN" || schluessel === "END") {
        aktuell.alarme = String(Number(aktuell.alarme ?? 0) + (z === "BEGIN:VALARM" ? 1 : 0));
        continue;
      }
      if (!(schluessel in aktuell)) aktuell[schluessel] = z.slice(i + 1);
    }
  }
  return events;
}

describe("Zeit und Text", () => {
  it("schreibt Zeiten in UTC im iCalendar-Format", () => {
    expect(icsZeit("2026-09-14T15:15:00.000Z")).toBe("20260914T151500Z");
  });

  it("maskiert Komma, Strichpunkt und Zeilenumbruch", () => {
    // Ohne Maskierung zerreisst „Strasse 5, 8413 Ort" die Ortsangabe.
    expect(icsText("Sattleracherstrasse 59, 8413 Neftenbach")).toBe(
      "Sattleracherstrasse 59\\, 8413 Neftenbach"
    );
    expect(icsText("a;b\nc")).toBe("a\\;b\\nc");
  });
});

describe("Zeilenfaltung", () => {
  it("lässt kurze Zeilen in Ruhe", () => {
    expect(falte("SUMMARY:Klavierunterricht")).toBe("SUMMARY:Klavierunterricht");
  });

  it("faltet lange Zeilen bei 75 Byte mit führendem Leerzeichen", () => {
    // Apple zeigt bei Verstössen keinen Fehler, sondern einen leeren
    // Kalender. Das ist die Regel, die man nicht ohne Standard kennt.
    const lang = "DESCRIPTION:" + "x".repeat(200);
    const g = falte(lang);
    const teile = g.split("\r\n");
    expect(teile.length).toBeGreaterThan(2);
    for (const [i, t] of teile.entries()) {
      expect(Buffer.from(t, "utf8").length).toBeLessThanOrEqual(75);
      if (i > 0) expect(t.startsWith(" ")).toBe(true);
    }
    // Zurückgefaltet ist es wieder das Original.
    expect(g.replace(/\r\n /g, "")).toBe(lang);
  });

  it("schneidet nie mitten in ein ä", () => {
    // Umlaute sind zwei Byte. Ein Schnitt dazwischen ergibt ein kaputtes
    // Zeichen, und die App verwirft die Zeile.
    const lang = "SUMMARY:" + "ä".repeat(100);
    const g = falte(lang);
    for (const t of g.split("\r\n")) {
      expect(Buffer.from(t, "utf8").length).toBeLessThanOrEqual(75);
      expect(t.includes("�")).toBe(false);
    }
    expect(g.replace(/\r\n /g, "")).toBe(lang);
  });
});

describe("Schülersicht", () => {
  const feed = baueFeed([termin()], "schueler", STEMPEL);
  const [e] = lies(feed);

  it("ist ein gültiger, veröffentlichter Kalender", () => {
    expect(feed.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(feed).toContain("METHOD:PUBLISH");
    expect(feed).toContain("X-WR-CALNAME:Klavierunterricht");
  });

  it("nennt keinen Namen, nur Klavierunterricht", () => {
    // Der Schüler soll im eigenen Kalender keinen fremden Namen sehen,
    // und auch nicht den eigenen: Das ist sein Kalender.
    expect(e.SUMMARY).toBe("Klavierunterricht");
    expect(feed).not.toContain("Bollman");
  });

  it("hat die eigene Adresse als Ort", () => {
    expect(e.LOCATION).toBe("Sattleracherstrasse 19\\, 8413 Neftenbach");
  });

  it("erinnert am Vorabend und eine Stunde vorher", () => {
    expect(e.alarme).toBe("2");
    expect(feed).toContain("TRIGGER:-P1D");
    expect(feed).toContain("TRIGGER:-PT1H");
  });

  it("verweist aufs Portal fürs Absagen", () => {
    expect(e.DESCRIPTION).toContain("24 Stunden");
    expect(e.DESCRIPTION).toContain("/schueler/portal");
  });

  it("die UID ist stabil je Termin", () => {
    // Daran erkennt die App beim nächsten Abruf denselben Termin. Eine
    // wechselnde UID legte bei jeder Verschiebung einen zweiten daneben.
    const a = lies(baueFeed([termin()], "schueler", STEMPEL))[0].UID;
    const b = lies(
      baueFeed([termin({ beginn: "2026-09-21T15:15:00.000Z" })], "schueler", STEMPEL)
    )[0].UID;
    expect(a).toBe(b);
    expect(a).toContain("@privatklavierunterricht.ch");
  });

  it("zweimal erzeugt ist zweimal derselbe Text", () => {
    expect(baueFeed([termin()], "schueler", STEMPEL)).toBe(
      baueFeed([termin()], "schueler", STEMPEL)
    );
  });
});

describe("Abgesagte Termine", () => {
  it("bleiben drin, durchgestrichen, ohne Erinnerung", () => {
    // Fehlt ein Termin einfach, weiss der Schüler nicht, ob abgesagt oder
    // verschoben. STATUS:CANCELLED zeigt ihn durchgestrichen.
    const feed = baueFeed([termin({ status: "cancelled" })], "schueler", STEMPEL);
    const [e] = lies(feed);
    expect(e.STATUS).toBe("CANCELLED");
    expect(e.SUMMARY).toContain("Abgesagt");
    expect(e.alarme ?? "0").toBe("0");
  });
});

describe("Adminsicht", () => {
  const feed = baueFeed(
    [termin(), termin({ id: "b", name: "Simon Thurnheer", hausbesuch: false, adresse: null })],
    "admin",
    STEMPEL
  );
  const [marina, simon] = lies(feed);

  it("nennt den Schüler im Titel", () => {
    expect(marina.SUMMARY).toBe("Marina Bollman");
  });

  it("markiert, wer zu David kommt", () => {
    expect(simon.SUMMARY).toBe("Bei mir: Simon Thurnheer");
    expect(simon.LOCATION).toBeUndefined();
  });

  it("erinnert 30 Minuten vorher", () => {
    expect(feed).toContain("TRIGGER:-PT30M");
    expect(marina.alarme).toBe("1");
  });

  it("heisst anders als der Schülerkalender", () => {
    expect(feed).toContain("X-WR-CALNAME:Klavierunterricht (alle)");
  });
});

describe("Token", () => {
  it("ist lang, zufällig und URL-tauglich", () => {
    const a = neuerToken();
    const b = neuerToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("Verdrahtung", () => {
  const wurzel = process.cwd();
  const route = readFileSync(
    join(wurzel, "src", "app", "api", "kalender", "[token]", "route.ts"),
    "utf8"
  );
  const server = readFileSync(join(wurzel, "src", "lib", "kalender-feed-server.ts"), "utf8");
  const middleware = readFileSync(join(wurzel, "src", "middleware.ts"), "utf8");
  const portal = readFileSync(join(wurzel, "src", "app", "schueler", "portal", "page.tsx"), "utf8");
  const einstellungen = readFileSync(
    join(wurzel, "src", "app", "admin", "einstellungen", "page.tsx"),
    "utf8"
  );

  it("die Route liegt nicht hinter dem Login", () => {
    // Kalender-Apps können sich nirgends anmelden.
    expect(middleware).not.toContain('"/api/:path*"');
    expect(middleware).not.toContain('"/api/kalender');
  });

  it("liefert text/calendar und verbietet Zwischenspeichern", () => {
    expect(route).toContain("text/calendar");
    expect(route).toContain("no-store");
  });

  it("unbekannte Token bekommen 404, keine Auskunft", () => {
    expect(route).toMatch(/status:\s*404/);
  });

  it("der Admin-Feed lässt den Testschüler aus", () => {
    expect(server).toContain('eq("profiles.ist_test", false)');
  });

  it("ein deaktivierter Schüler hat keinen Kalender mehr", () => {
    expect(server).toContain("profil.aktiv === false");
  });

  it("der Knopf ist im Portal und in den Einstellungen", () => {
    expect(portal).toContain("<KalenderAbo");
    expect(einstellungen).toContain("<KalenderAbo");
  });
});
