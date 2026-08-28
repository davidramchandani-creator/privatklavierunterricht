import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { baueVorschau, istLeer, type Notiz } from "./lektionsnotizen";

function notiz(p: Partial<Notiz> & { lektion_am: string }): Notiz {
  return {
    appointment_id: p.appointment_id ?? p.lektion_am,
    inhalt: p.inhalt ?? [],
    verlauf: p.verlauf ?? null,
    woran: p.woran ?? null,
    hausaufgabe: p.hausaufgabe ?? null,
    lektion_am: p.lektion_am,
  };
}

describe("Stand vor der nächsten Lektion", () => {
  it("sagt deutlich, wenn es noch nichts gibt", () => {
    const v = baueVorschau([]);
    expect(v.leer).toBe(true);
    expect(v.hausaufgabe).toBeNull();
  });

  it("nimmt Woran und Kategorien aus der letzten Lektion", () => {
    const v = baueVorschau([
      notiz({
        lektion_am: "2026-08-24T15:15:00Z",
        woran: "Prélude, linke Hand",
        inhalt: ["stueck", "technik"],
      }),
      notiz({ lektion_am: "2026-08-17T15:15:00Z", woran: "Tonleitern" }),
    ]);
    expect(v.zuletzt).toBe("Prélude, linke Hand");
    expect(v.inhalt).toEqual(["stueck", "technik"]);
  });

  it("holt die Hausaufgabe von früher, wenn zuletzt keine gestellt wurde", () => {
    // Sonst stünde vor der Lektion gar nichts da, obwohl von der Woche davor
    // noch etwas offen ist — genau der Fall, den David sonst vergisst.
    const v = baueVorschau([
      notiz({ lektion_am: "2026-08-24T15:15:00Z", woran: "durchgespielt" }),
      notiz({
        lektion_am: "2026-08-17T15:15:00Z",
        hausaufgabe: "Takt 12-20 langsam",
      }),
    ]);
    expect(v.hausaufgabe).toBe("Takt 12-20 langsam");
  });

  it("übergeht leere und nur aus Leerzeichen bestehende Hausaufgaben", () => {
    const v = baueVorschau([
      notiz({ lektion_am: "2026-08-24T15:15:00Z", hausaufgabe: "   " }),
      notiz({ lektion_am: "2026-08-17T15:15:00Z", hausaufgabe: "Arpeggien" }),
    ]);
    expect(v.hausaufgabe).toBe("Arpeggien");
  });
});

describe("Wie lange etwas schon hakt", () => {
  it("zählt aufeinanderfolgende dranbleiben ab der neuesten", () => {
    const v = baueVorschau([
      notiz({ lektion_am: "2026-08-24T15:15:00Z", verlauf: "dranbleiben" }),
      notiz({ lektion_am: "2026-08-17T15:15:00Z", verlauf: "dranbleiben" }),
      notiz({ lektion_am: "2026-08-10T15:15:00Z", verlauf: "dranbleiben" }),
      notiz({ lektion_am: "2026-08-03T15:15:00Z", verlauf: "sitzt" }),
    ]);
    expect(v.dranbleibenSeit).toBe(3);
  });

  it("bricht ab, sobald etwas anderes dazwischen steht", () => {
    // Ein „sitzt" dazwischen heisst, dass die Serie vorbei war. Alles davor
    // gehört zu einer anderen Geschichte und darf nicht mitgezählt werden.
    const v = baueVorschau([
      notiz({ lektion_am: "2026-08-24T15:15:00Z", verlauf: "dranbleiben" }),
      notiz({ lektion_am: "2026-08-17T15:15:00Z", verlauf: "sitzt" }),
      notiz({ lektion_am: "2026-08-10T15:15:00Z", verlauf: "dranbleiben" }),
    ]);
    expect(v.dranbleibenSeit).toBe(1);
  });

  it("zählt nicht, wenn die letzte Lektion gut lief", () => {
    const v = baueVorschau([
      notiz({ lektion_am: "2026-08-24T15:15:00Z", verlauf: "sitzt" }),
      notiz({ lektion_am: "2026-08-17T15:15:00Z", verlauf: "dranbleiben" }),
    ]);
    expect(v.dranbleibenSeit).toBe(0);
  });
});

describe("Leere Notiz", () => {
  it("erkennt eine Notiz, in der nichts steht", () => {
    expect(
      istLeer({ inhalt: [], verlauf: null, woran: "  ", hausaufgabe: null })
    ).toBe(true);
  });

  it("ein einziger angetippter Knopf genügt", () => {
    // Absicht: Wer nur „Sitzt" antippt und weitergeht, hat eine gültige Notiz
    // gemacht. Pflichtfelder wären hier das Ende der Gewohnheit.
    expect(
      istLeer({ inhalt: [], verlauf: "sitzt", woran: null, hausaufgabe: null })
    ).toBe(false);
    expect(
      istLeer({ inhalt: ["technik"], verlauf: null, woran: null, hausaufgabe: null })
    ).toBe(false);
  });
});

describe("Verdrahtung", () => {
  const wurzel = process.cwd();
  const server = readFileSync(
    join(wurzel, "src", "lib", "lektionsnotizen-server.ts"),
    "utf8"
  );
  const migration = readFileSync(
    join(wurzel, "supabase", "migrations", "059_lektionsnotizen.sql"),
    "utf8"
  );

  it("eine Notiz je Lektion, per Datenbank erzwungen", () => {
    // Ohne unique entstünde beim Nachtragen ein zweiter Eintrag, und der
    // Verlauf zeigte dieselbe Stunde doppelt.
    expect(migration).toMatch(/appointment_id uuid not null unique/);
  });

  it("nur der Admin darf lesen", () => {
    // Der Kern der Zusage an David: Er kann ehrlich schreiben.
    expect(migration).toContain("enable row level security");
    expect(migration).toMatch(/p\.role = 'admin'/);
  });

  it("Testschüler bleiben aussen vor", () => {
    expect(server).toContain("ist_test");
  });

  it("nur stattgefundene Lektionen werden abgefragt", () => {
    // Eine abgesagte Stunde hat keinen Inhalt. Stünde sie in der Liste der
    // offenen Notizen, wäre die Liste dauerhaft nicht abzuarbeiten.
    expect(server).toMatch(/"booked", "completed"|'booked', 'completed'/);
  });

  it("die Seite hängt in beiden Navigationen", () => {
    // Sonst wiederholt sich der Fehler von heute Morgen: am Handy nur über
    // die Adresszeile erreichbar.
    const nav = readFileSync(
      join(wurzel, "src", "app", "admin", "_components", "AdminNav.tsx"),
      "utf8"
    );
    const unten = readFileSync(
      join(wurzel, "src", "app", "admin", "_components", "AdminBottomNav.tsx"),
      "utf8"
    );
    expect(nav).toContain("/admin/lektionen");
    expect(unten).toContain("/admin/lektionen");
  });
});

describe("Erinnerung nach der Lektion", () => {
  const wurzel = process.cwd();
  const push = readFileSync(
    join(wurzel, "src", "lib", "lektionsnotizen-push.ts"),
    "utf8"
  );
  const vercel = JSON.parse(
    readFileSync(join(wurzel, "vercel.json"), "utf8")
  ) as { crons: { path: string; schedule: string }[] };

  it("läuft abends, nach dem letzten möglichen Unterrichtsende", () => {
    // 20:00 UTC sind 22:00 im Sommer und 21:00 im Winter. Der Unterricht
    // endet spätestens 20:30 Zürcher Zeit — beides liegt danach.
    const job = vercel.crons.find((c) => c.path.includes("lektionsnotizen"));
    expect(job?.schedule).toBe("0 20 * * *");
  });

  it("erinnert höchstens einmal je Tag", () => {
    expect(push).toContain("heute schon erinnert");
  });

  it("vermerkt nichts, solange nichts offen ist", () => {
    // Der Vermerk entsteht erst mit dem Versand. Sonst könnte ein Termin,
    // der um 21 Uhr nachgetragen wird, nie mehr erinnert werden.
    const nichtsOffen = push.indexOf('grund: "nichts offen"');
    const vermerk = push.indexOf('.upsert({ key: SCHLUESSEL');
    expect(nichtsOffen).toBeGreaterThan(-1);
    expect(nichtsOffen).toBeLessThan(vermerk);
  });

  it("schickt keine Mitteilung, wenn nichts anliegt", () => {
    // Dieselbe Regel wie beim Wochenbriefing: Wer jeden Abend eine
    // Mitteilung bekommt, die meistens leer ist, wischt sie ungelesen weg.
    // Der Abbruch steht vor dem Versand — positionell geprüft, damit ein
    // Umbau der Funktion das nicht still umdreht.
    const abbruch = push.indexOf("offen.length === 0");
    const versand = push.indexOf("sendPushToAdmin(admin");
    expect(abbruch).toBeGreaterThan(-1);
    expect(versand).toBeGreaterThan(abbruch);
  });
});
