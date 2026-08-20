import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Das Vorrück-Angebot fragt den nächsten Schüler des Tages, ob er in eine
 * freigewordene Lücke rücken mag. Drei Eigenschaften sind nicht verhandelbar
 * und werden hier festgenagelt:
 *
 * 1. Es ist eine FRAGE. Nichts wird ohne Zustimmung verschoben.
 * 2. Ablehnen (oder Schweigen) lässt den Termin exakt wie er war.
 * 3. Beim Annehmen wird der Slot neu geprüft — er kann inzwischen von der
 *    Ausfall-Kaskade des absagenden Schülers belegt worden sein.
 */
const server = readFileSync(
  join(process.cwd(), "src", "lib", "vorrueck-server.ts"),
  "utf8"
);

describe("Vorrück-Angebot anbieten", () => {
  it("hängt an beiden Absage-Wegen", () => {
    const portal = readFileSync(
      join(process.cwd(), "src", "app", "schueler", "portal", "actions.ts"),
      "utf8"
    );
    const adminActions = readFileSync(
      join(process.cwd(), "src", "app", "admin", "actions.ts"),
      "utf8"
    );
    // Die Lücke entsteht bei jeder Absage, egal wer absagt. Nur ein Weg
    // eingehängt hiesse: halb so viele geschlossene Löcher.
    expect(portal).toContain("bieteFrueherenSlotAn");
    expect(adminActions).toContain("bieteFrueherenSlotAn");
  });

  it("fragt nur bei mindestens 24 Stunden Vorlauf", () => {
    // Eine Mail für einen Slot in drei Stunden liest niemand rechtzeitig,
    // und wer sie doch liest, müsste hetzen. Dann lieber gar nicht fragen.
    const fn = server.slice(server.indexOf("export async function bieteFrueherenSlotAn"));
    expect(fn).toContain("isAtLeast24hAway");
  });

  it("lässt Externe und Inaktive in Ruhe", () => {
    // Der Termin eines Externen ist über eine andere Plattform abgemacht —
    // ihn zum Vorrücken einzuladen hiesse, eine Abmachung zu verschieben,
    // die gar nicht in diesem System lebt.
    const fn = server.slice(server.indexOf("export async function bieteFrueherenSlotAn"));
    expect(fn).toContain("profil.extern === true");
    expect(fn).toContain("profil.aktiv !== true");
  });

  it("stellt höchstens ein offenes Angebot pro Termin", () => {
    const fn = server.slice(server.indexOf("export async function bieteFrueherenSlotAn"));
    expect(fn).toContain('.eq("status", "offen")');
    // Und die Migration erzwingt es zusätzlich in der DB.
    const migration = readFileSync(
      join(process.cwd(), "supabase", "migrations", "053_vorrueck_angebote.sql"),
      "utf8"
    );
    expect(migration).toContain("vorrueck_offen_einmalig");
    expect(migration).toContain("where status = 'offen'");
  });
});

describe("Antwort des Schülers", () => {
  it("ablehnen ändert nur den Angebots-Status, nie den Termin", () => {
    const fn = server.slice(
      server.indexOf("export async function beantworteVorrueck"),
      server.indexOf("export async function offeneVorrueckAngebote")
    );
    const ablehnung = fn.slice(0, fn.indexOf('from("appointments")'));
    // Vor dem ersten Zugriff auf appointments muss der Ablehnungs-Ausstieg
    // liegen. Danach wäre der Termin schon angefasst worden.
    expect(ablehnung).toContain('"abgelehnt"');
    expect(ablehnung).toContain("if (!params.annehmen)");
  });

  it("prüft den Slot beim Annehmen erneut, inklusive 24h-Vorlauf", () => {
    const fn = server.slice(server.indexOf("export async function beantworteVorrueck"));
    expect(fn).toContain("loadAvailabilityContext");
    expect(fn).toContain("validateSeries");
    // Kein skipLeadTime: Anders als beim Admin-Accept gibt es hier keinen
    // Menschen, der eine kurzfristige Ausnahme bewusst abnickt.
    expect(fn).not.toContain("skipLeadTime");
  });

  it("verfallenes Angebot lässt den alten Termin unangetastet", () => {
    const fn = server.slice(server.indexOf("export async function beantworteVorrueck"));
    expect(fn).toContain('"verfallen"');
    expect(fn).toContain("Dein Termin bleibt wie er war");
  });

  it("nach dem Verschieben: Kalender, Erinnerungen, beide Mails", () => {
    const fn = server.slice(server.indexOf("export async function beantworteVorrueck"));
    expect(fn).toContain("syncAppointmentToCalendar");
    expect(fn).toContain("scheduleLessonReminders");
    expect(fn).toContain('"vorrueck_bestaetigt"');
    // David muss es erfahren, sein Abend beginnt jetzt früher.
    expect(fn).toContain('"vorrueck_admin"');
  });
});

describe("Mail-Verdrahtung", () => {
  it("alle drei Typen sind registriert", () => {
    const dispatch = readFileSync(
      join(process.cwd(), "src", "lib", "email-dispatch.ts"),
      "utf8"
    );
    expect(dispatch).toContain('"vorrueck_angebot"');
    expect(dispatch).toContain('"vorrueck_bestaetigt"');
    // Als Admin-Typ, sonst würde die Externen-Sperre die Mail an David
    // verschlucken, sobald ein Externer im Payload steht.
    const adminListe = dispatch.slice(
      dispatch.indexOf("ADMIN_RECIPIENT_TYPES"),
      dispatch.indexOf("STUDENT_PAYLOAD_TO_TYPES")
    );
    expect(adminListe).toContain('"vorrueck_admin"');
  });

  it("die Angebots-Mail sagt, dass Nein okay ist", () => {
    const templates = readFileSync(
      join(process.cwd(), "src", "lib", "email-templates.ts"),
      "utf8"
    );
    const angebot = templates.slice(
      templates.indexOf('case "vorrueck_angebot"'),
      templates.indexOf('case "vorrueck_bestaetigt"')
    );
    // Ohne diesen Satz liest sich das Angebot wie eine Anweisung, und
    // Schüler, die nicht können, rufen besorgt an.
    expect(angebot).toContain("in Ordnung");
  });
});
