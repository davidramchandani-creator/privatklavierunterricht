import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NACHLEGEN_AB_TAGE, VORLAUF_TAGE } from "./externe-server";

/**
 * Externe Schüler laufen über eine andere Plattform.
 *
 * Sie sollen überall mitzählen, wo es um **Zeit und Wege** geht — Kalender,
 * Routenplanung, belegte Slots — und nirgends auftauchen, wo es um **Geld
 * und Post** geht. Diese Trennung ist der ganze Sinn der Sache, und sie
 * lässt sich leicht versehentlich durchbrechen: Es genügt eine Abfrage, die
 * „alle aktiven Schüler" holt.
 */
describe("Externe bekommen keine Post", () => {
  const dispatch = readFileSync(
    join(process.cwd(), "src", "lib", "email-dispatch.ts"),
    "utf8"
  );

  it("bricht den Versand vor der Empfängersuche ab", () => {
    // Die Sperre muss vor `to` greifen. Danach wäre sie wirkungslos, weil
    // ohne Mailadresse ohnehin ein Fehler geworfen würde — und der stünde
    // dann als Fehlschlag in der Outbox, statt dass die Mail einfach
    // unterbleibt.
    const sperre = dispatch.indexOf("empfaenger?.extern === true");
    const empfaenger = dispatch.indexOf("let to: string | null = null;");
    expect(sperre).toBeGreaterThan(-1);
    expect(sperre).toBeLessThan(empfaenger);
  });

  it("lässt Mails an David selbst durch", () => {
    // Wenn bei einem externen Schüler etwas ausfällt, will David das
    // wissen. Die Sperre gilt nur für Post an den Schüler.
    expect(dispatch).toContain(
      "!ADMIN_RECIPIENT_TYPES.includes(type)"
    );
  });
});

describe("Externe zählen bei Zeit und Weg mit", () => {
  const planung = readFileSync(
    join(process.cwd(), "src", "lib", "planung-server.ts"),
    "utf8"
  );
  const routing = readFileSync(
    join(process.cwd(), "src", "lib", "routing-server.ts"),
    "utf8"
  );

  it("blockiert ihre Zeit in der Zuteilung", () => {
    expect(planung).toContain("vorbelegt");
    expect(planung).toContain("ladeExterneTermine");
  });

  it("nimmt sie in den bestehenden Stundenplan auf", () => {
    const fn = planung.slice(
      planung.indexOf("export async function ladeBestehendenPlan"),
      planung.indexOf("export async function ladeExterneTermine")
    );
    expect(fn).toContain("...externe");
  });

  it("lässt sie im Routenplaner mitrechnen", () => {
    // Kein extern-Filter in ladeSchueler: Der Externe belegt einen echten
    // Abend, seine Adresse gehört auf die Route.
    const fn = routing.slice(
      routing.indexOf("export async function ladeSchueler")
    );
    expect(fn.slice(0, 1200)).not.toContain('.eq("extern"');
  });
});

describe("Externe bleiben aus Abrechnung und Planung heraus", () => {
  const planungActions = readFileSync(
    join(process.cwd(), "src", "app", "admin", "planung", "actions.ts"),
    "utf8"
  );
  const planung = readFileSync(
    join(process.cwd(), "src", "lib", "planung-server.ts"),
    "utf8"
  );

  it("werden nicht in Planungsrunden angeschrieben", () => {
    expect(planungActions).toContain('.eq("extern", false)');
  });

  it("stehen nicht dauerhaft unter „keine Antwort“", () => {
    const fn = planung.slice(
      planung.indexOf("export async function ladeAntwortStand")
    );
    expect(fn.slice(0, 1200)).toContain('.eq("extern", false)');
  });

  it("werden zugeteilt, solange ihr Termin offen ist", () => {
    // Das ist der Sinn der Sache: David fragt sie nach ihren Zeiten und
    // lässt den Planer einen Platz suchen, der in seine Route passt. Eine
    // Zeit vorzugeben hiesse, den Planer für genau die Schüler nicht
    // benutzen zu können, für die man ihn aufgenommen hat.
    const fn = planung.slice(
      planung.indexOf("export async function rechneZuteilung")
    );
    expect(fn.slice(0, 3000)).toContain("schonVergeben");
  });

  it("blockieren Zeit, sobald ihr Termin steht", () => {
    // Umgekehrter Fall: Wer seinen Platz hat, ist kein Kandidat mehr,
    // seine Zeit aber weg. Beides zugleich wäre ein Doppeleintrag.
    const fn = planung.slice(
      planung.indexOf("export async function ladeExterneTermine")
    );
    expect(fn.slice(0, 1200)).toContain('.not("wochentag", "is", null)');
  });

  it("bekommen kein Paket, ihre Termine hängen an der Vereinbarung", () => {
    const externe = readFileSync(
      join(process.cwd(), "src", "lib", "externe-server.ts"),
      "utf8"
    );
    // package_id null ist der Grund, warum alle Abrechnungswege sie von
    // selbst überspringen: Sie prüfen billing_mode am Paket des Termins.
    expect(externe).toContain("package_id: null");
    expect(externe).toContain("externe_vereinbarung_id: v.id");
  });
});

/**
 * Unbefristete Serien müssen nachwachsen.
 *
 * Sonst läuft die Serie irgendwann aus, und zwar unauffällig: Der Schüler
 * verschwindet aus Kalender und Routenplanung, während der Unterricht in
 * Wirklichkeit weitergeht. Gemerkt würde es erst, wenn David an einem
 * Dienstag nicht auftaucht.
 */
describe("Nachwachsen", () => {
  it("legt nach, bevor der Vorlauf aufgebraucht ist", () => {
    // Die Grenze muss deutlich unter dem Vorlauf liegen, sonst wird erst
    // nachgelegt, wenn der Kalender schon leer ist.
    expect(NACHLEGEN_AB_TAGE).toBeLessThan(VORLAUF_TAGE / 2);
  });

  it("hängt am Cron", () => {
    const jobs = readFileSync(
      join(process.cwd(), "src", "lib", "subscription-jobs.ts"),
      "utf8"
    );
    expect(jobs).toContain("verlaengereExterneSerien(admin)");
  });

  it("holt niemanden zurück, der aufgehört hat", () => {
    const externe = readFileSync(
      join(process.cwd(), "src", "lib", "externe-server.ts"),
      "utf8"
    );
    const fn = externe.slice(
      externe.indexOf("export async function verlaengereExterneSerien")
    );
    expect(fn).toContain('profil?.aktiv !== true');
  });
});

/**
 * Der zugeteilte Termin landet in der Vereinbarung, nicht in einem Abo.
 *
 * Externe nehmen an der Zuteilung teil wie alle anderen, aber am Ende
 * trennen sich die Wege: Für sie entsteht kein Paket, keine Rechnung und
 * keine Rate — nur der Termin und die Serie im Kalender.
 *
 * Ohne diese Verzweigung liefe ein externer Schüler in den Abo-Pfad und
 * bekäme einen Zahlungsplan für Unterricht, den er längst anderswo bezahlt.
 */
describe("Zuteilung anwenden bei Externen", () => {
  const umstellung = readFileSync(
    join(process.cwd(), "src", "lib", "umstellung-server.ts"),
    "utf8"
  );

  it("zweigt vor dem Abo-Anlegen ab", () => {
    const verzweigung = umstellung.indexOf("istExtern.has(z.schuelerId)");
    const aboAnlegen = umstellung.indexOf("legeAboAn(admin, {");
    expect(verzweigung).toBeGreaterThan(-1);
    expect(aboAnlegen).toBeGreaterThan(-1);
    expect(verzweigung).toBeLessThan(aboAnlegen);
  });

  it("schreibt den Termin in die Vereinbarung", () => {
    expect(umstellung).toContain("setzeExternenTermin");

    const externe = readFileSync(
      join(process.cwd(), "src", "lib", "externe-server.ts"),
      "utf8"
    );
    const fn = externe.slice(
      externe.indexOf("export async function setzeExternenTermin")
    );
    expect(fn).toContain("wochentag: params.wochentag");
    expect(fn).toContain("legeExterneTermineAn");
    // Alte Termine räumen, sonst stünden nach einer zweiten Zuteilung
    // beide Plätze nebeneinander im Kalender.
    expect(fn).toContain('status: "cancelled"');
  });
});

/**
 * Die Verfügbarkeit externer Schüler liegt als Dauerangabe.
 *
 * Sie haben kein Portal, in dem sie selbst eintragen könnten — David fragt
 * sie und trägt es ein. Gespeichert wird im selben Feld wie beim Abo-Kauf
 * (`runde_id` null), damit die Zuteilung ohne Sonderweg darauf zugreift.
 */
describe("Verfügbarkeit externer Schüler", () => {
  it("wird ohne Runde abgelegt", () => {
    const actions = readFileSync(
      join(process.cwd(), "src", "app", "admin", "actions.ts"),
      "utf8"
    );
    const fn = actions.slice(actions.indexOf("export async function externenAnlegen"));
    expect(fn).toContain("runde_id: null");
    expect(fn).toContain("student_verfuegbarkeit");
  });

  it("verlangt mindestens ein Zeitfenster", () => {
    const actions = readFileSync(
      join(process.cwd(), "src", "app", "admin", "actions.ts"),
      "utf8"
    );
    // Ohne Zeiten könnte die Zuteilung nichts suchen, und der Schüler
    // stünde dauerhaft ohne Termin da, ohne dass es auffiele.
    expect(actions).toContain(
      "Ohne Zeiten kann die Zuteilung keinen Platz suchen"
    );
  });
});
