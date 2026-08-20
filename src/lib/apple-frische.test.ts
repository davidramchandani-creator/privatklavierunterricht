import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { stelleAppleKalenderSicher, SOFORT } from "./apple-kalender";

/**
 * Wie oft wirklich abgerufen wird.
 *
 * Die übrigen Apple-Tests prüfen den Quelltext auf bestimmte Stellen; hier
 * läuft die Funktion tatsächlich, gegen einen erfundenen Kalenderserver.
 * Das ist der Unterschied zwischen „die Bündelung ist eingebaut" und „die
 * Bündelung funktioniert".
 *
 * Die vier Eigenschaften, auf die es ankommt:
 *   - Eine Serienprüfung darf nicht zehn Abrufe auslösen
 *   - Innerhalb der Frist wird gar nicht abgerufen (sonst bei jedem Klick)
 *   - Vor dem echten Buchen wird immer abgerufen, egal wie frisch
 *   - Ist iCloud weg, geht es trotzdem weiter
 */

let abrufe = 0;

const KALENDER = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:x@test
SUMMARY:Privat
DTSTART:20260915T140000Z
DTEND:20260915T150000Z
END:VEVENT
END:VCALENDAR`;

const echtesFetch = globalThis.fetch;

const fakeFetch = async () => {
  abrufe++;
  // Kurze Verzögerung, damit sich gleichzeitige Aufrufe überhaupt
  // überlappen können — ohne sie wäre der Bündelungstest wertlos.
  await new Promise((r) => setTimeout(r, 30));
  return { ok: true, status: 200, text: async () => KALENDER } as unknown as Response;
};

/** Minimaler Supabase-Ersatz: genug für Einstellung lesen und schreiben. */
function fakeAdmin(zuletztAbgerufen: string | null) {
  let gespeichert: Record<string, unknown> = {
    url: "https://beispiel.test/kalender.ics",
    titelUebernehmen: true,
    zuletztAbgerufen,
  };
  const kette = (tabelle: string) => ({
    select: () => kette(tabelle),
    eq: () => kette(tabelle),
    gte: () => kette(tabelle),
    lte: () => kette(tabelle),
    maybeSingle: async () =>
      tabelle === "app_settings" ? { data: { value: gespeichert } } : { data: null },
    delete: () => ({
      eq: () => ({ gte: () => ({ lte: () => ({ select: async () => ({ data: [] }) }) }) }),
    }),
    insert: async () => ({ error: null }),
    upsert: async (row: { value: Record<string, unknown> }) => {
      gespeichert = row.value;
      return { error: null };
    },
  });
  return { from: (t: string) => kette(t) } as never;
}

beforeEach(() => {
  abrufe = 0;
  globalThis.fetch = fakeFetch as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = echtesFetch;
});

describe("Wie oft der Kalender geholt wird", () => {
  it("bündelt zehn gleichzeitige Aufrufe zu einem Abruf", async () => {
    // Eine Serie über zehn Termine prüft zehnmal die Verfügbarkeit. Ohne
    // Bündelung wären das zehn Abrufe bei iCloud, alle mit demselben
    // Ergebnis — und zehnmal die Wartezeit.
    const admin = fakeAdmin(null);
    await Promise.all(
      Array.from({ length: 10 }, () => stelleAppleKalenderSicher(admin, 60))
    );
    expect(abrufe).toBe(1);
  });

  it("holt innerhalb der Frist gar nicht", async () => {
    const admin = fakeAdmin(new Date().toISOString());
    await stelleAppleKalenderSicher(admin, 60);
    expect(abrufe).toBe(0);
  });

  it("holt nach Ablauf der Frist wieder", async () => {
    const admin = fakeAdmin(new Date(Date.now() - 5 * 60_000).toISOString());
    await stelleAppleKalenderSicher(admin, 60);
    expect(abrufe).toBe(1);
  });

  it("holt vor dem Buchen immer, auch bei ganz frischem Stand", async () => {
    // Beim Anschauen einer Slot-Liste ist eine Minute Verzug egal. Beim
    // Buchen entsteht der Schaden, darum dort ohne Puffer.
    const admin = fakeAdmin(new Date().toISOString());
    await stelleAppleKalenderSicher(admin, SOFORT);
    expect(abrufe).toBe(1);
  });

  it("lässt eine Buchung nicht scheitern, wenn iCloud weg ist", async () => {
    // Sonst hiesse eine Apple-Störung: niemand kann mehr buchen.
    globalThis.fetch = (async () => {
      throw new Error("iCloud nicht erreichbar");
    }) as unknown as typeof fetch;
    const admin = fakeAdmin(null);
    await expect(
      stelleAppleKalenderSicher(admin, SOFORT)
    ).resolves.toBeUndefined();
  });

  it("tut nichts, wenn gar kein Kalender hinterlegt ist", async () => {
    const ohne = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      }),
    } as never;
    await stelleAppleKalenderSicher(ohne, SOFORT);
    expect(abrufe).toBe(0);
  });
});
