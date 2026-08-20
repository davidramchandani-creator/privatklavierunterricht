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

  it("werden nicht zugeteilt", () => {
    const fn = planung.slice(
      planung.indexOf("export async function rechneZuteilung")
    );
    expect(fn.slice(0, 2500)).toContain('.eq("extern", false)');
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
