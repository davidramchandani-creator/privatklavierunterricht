import { describe, it, expect } from "vitest";
import {
  RUHEZEIT_TAGE,
  darfHinweisZeigen,
  istIos,
  istStandalone,
  leseZeitstempel,
} from "./app-install";

const TAG = 24 * 60 * 60 * 1000;
const JETZT = Date.parse("2026-08-14T10:00:00Z");

function basis(aenderung: Partial<Parameters<typeof darfHinweisZeigen>[0]> = {}) {
  return darfHinweisZeigen({
    istMobil: true,
    standalone: false,
    bereitsInstalliert: false,
    weggeklicktAm: null,
    jetzt: JETZT,
    ...aenderung,
  });
}

describe("darfHinweisZeigen", () => {
  it("zeigt den Hinweis auf einem frischen Handy", () => {
    expect(basis()).toBe(true);
  });

  it("schweigt am Schreibtisch", () => {
    expect(basis({ istMobil: false })).toBe(false);
  });

  it("schweigt, wenn die App bereits läuft", () => {
    // Der wichtigste Fall: Wer installiert hat, soll nie wieder gefragt
    // werden, dass er installieren soll.
    expect(basis({ standalone: true })).toBe(false);
  });

  it("schweigt nach einer erfolgreichen Installation", () => {
    expect(basis({ bereitsInstalliert: true })).toBe(false);
  });

  it("schweigt innerhalb der Ruhezeit", () => {
    expect(basis({ weggeklicktAm: JETZT - 3 * TAG })).toBe(false);
    expect(basis({ weggeklicktAm: JETZT - (RUHEZEIT_TAGE * TAG - 1000) })).toBe(
      false,
    );
  });

  it("fragt nach der Ruhezeit erneut", () => {
    expect(basis({ weggeklicktAm: JETZT - (RUHEZEIT_TAGE + 1) * TAG })).toBe(
      true,
    );
  });

  it("schweigt bei einem Zeitstempel aus der Zukunft", () => {
    expect(basis({ weggeklicktAm: JETZT + 5 * TAG })).toBe(false);
  });
});

describe("istStandalone", () => {
  it("erkennt Android über display-mode", () => {
    expect(istStandalone(true, undefined)).toBe(true);
  });

  it("erkennt iOS über navigator.standalone", () => {
    expect(istStandalone(false, true)).toBe(true);
  });

  it("meldet den normalen Browser als nicht standalone", () => {
    expect(istStandalone(false, false)).toBe(false);
    expect(istStandalone(false, undefined)).toBe(false);
  });
});

describe("istIos", () => {
  const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const IPAD =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  const ANDROID =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

  it("erkennt das iPhone", () => {
    expect(istIos(IPHONE, 5)).toBe(true);
  });

  it("erkennt das iPad, das sich als Mac ausgibt", () => {
    // Seit iPadOS 13 ist die Kennung nicht mehr von einem Mac zu
    // unterscheiden. Nur der Touchscreen verrät es.
    expect(istIos(IPAD, 5)).toBe(true);
  });

  it("hält einen echten Mac nicht für ein iPad", () => {
    expect(istIos(IPAD, 0)).toBe(false);
  });

  it("erkennt Android nicht als iOS", () => {
    expect(istIos(ANDROID, 5)).toBe(false);
  });
});

describe("leseZeitstempel", () => {
  it("liest eine gespeicherte Zahl", () => {
    expect(leseZeitstempel(String(JETZT))).toBe(JETZT);
  });

  it("verwirft Unsinn statt daran zu scheitern", () => {
    expect(leseZeitstempel(null)).toBe(null);
    expect(leseZeitstempel("")).toBe(null);
    expect(leseZeitstempel("gestern")).toBe(null);
    expect(leseZeitstempel("-5")).toBe(null);
  });
});
