import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Es gibt drei Verschiebewege, und alle drei müssen dieselben Pflichten
 * erfüllen: Slot gegen die Engine prüfen, Google-Kalender nachziehen,
 * Erinnerungen umplanen, den Schüler informieren.
 *
 *   1. Schüler fragt an, David nimmt an   (acceptReschedule)
 *   2. System bietet Vorrücken an          (beantworteVorrueck)
 *   3. David verschiebt direkt             (moveAppointment)
 *
 * Der dritte fehlte lange komplett — die Termine hatten nur „nicht
 * erschienen" und „stornieren", und wer einen telefonisch abgemachten
 * neuen Termin eintragen wollte, musste stornieren und neu buchen, was
 * fälschlich eine Ausfall-Kaskade samt Mails auslöste.
 */
describe("Direktes Verschieben durch den Admin", () => {
  const actions = readFileSync(
    join(process.cwd(), "src", "app", "admin", "actions.ts"),
    "utf8"
  );
  const fn = actions.slice(
    actions.indexOf("export async function moveAppointment"),
    actions.indexOf("export async function cancelAppointmentNew")
  );

  it("existiert und hängt am Verschieben-Knopf", () => {
    expect(fn.length).toBeGreaterThan(100);
    const ui = readFileSync(
      join(
        process.cwd(),
        "src",
        "app",
        "admin",
        "schueler",
        "[id]",
        "_components",
        "SchuelerDetailActions.tsx"
      ),
      "utf8"
    );
    expect(ui).toContain("moveAppointment(");
    expect(ui).toContain('title="Verschieben"');
  });

  it("prüft den neuen Slot gegen die volle Engine", () => {
    // Sonst liesse sich ein Termin auf eine Sperre oder einen anderen
    // Schüler schieben — genau die Fehler, die die Engine verhindert.
    expect(fn).toContain("loadAvailabilityContext");
    expect(fn).toContain("validateSeries");
    // Der Termin darf nicht mit sich selbst kollidieren.
    expect(fn).toContain("excludeAppointmentId: id");
    // Und der Apple-Kalender muss frisch sein, hier wird wirklich gebucht.
    expect(fn).toContain("kalenderJetzt: true");
  });

  it("überspringt den 24h-Vorlauf, aber nicht die Vergangenheit", () => {
    // Die Absprache hat David gerade selbst getroffen; ihn 24h warten zu
    // lassen wäre absurd. In die Vergangenheit verschieben bleibt trotzdem
    // verboten.
    expect(fn).toContain("skipLeadTime: true");
    expect(fn).toContain("Vergangenheit");
  });

  it("verschiebt nur gebuchte Termine", () => {
    // Ein stornierter oder gehaltener Termin hat keinen Platz mehr, den
    // man verschieben könnte; alles andere wäre Buchhaltungs-Chaos.
    expect(fn).toContain('appt.status !== "booked"');
  });

  it("zieht Kalender, Erinnerungen und Schüler-Mail nach", () => {
    expect(fn).toContain("syncAppointmentToCalendar");
    expect(fn).toContain("cancelLessonReminders");
    expect(fn).toContain("scheduleLessonReminders");
    expect(fn).toContain('"reschedule_confirmed"');
  });
});
