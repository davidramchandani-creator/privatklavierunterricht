import { afterEach, describe, expect, it, vi } from "vitest";
import { redirectAddress, sendEmail } from "./email-sender";

/**
 * Der Umleiter ist die einzige Sicherung zwischen einem Testlauf und den
 * echten Postfächern der Schüler. Er wird darum schärfer geprüft als der
 * Rest: nicht nur „funktioniert", sondern „kann nicht versehentlich
 * durchrutschen".
 */

const ORIGINAL = process.env.EMAIL_REDIRECT_TO;
const KEY = process.env.RESEND_API_KEY;

afterEach(() => {
  process.env.EMAIL_REDIRECT_TO = ORIGINAL;
  process.env.RESEND_API_KEY = KEY;
  vi.unstubAllGlobals();
});

function fangeVersandAb() {
  const gesendet: { to: string; subject: string; html: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      gesendet.push(JSON.parse(init.body));
      return { ok: true, text: async () => "" } as Response;
    })
  );
  return gesendet;
}

describe("redirectAddress", () => {
  it("ist ohne gesetzte Variable aus", () => {
    delete process.env.EMAIL_REDIRECT_TO;
    expect(redirectAddress()).toBeNull();
  });

  it("wertet eine leere Variable als aus", () => {
    // Sonst würde `EMAIL_REDIRECT_TO=` als Adresse "" gelten und jede Mail
    // ins Leere schicken – schlimmer als gar keine Umleitung, weil es
    // aussieht, als wäre der Versand kaputt.
    process.env.EMAIL_REDIRECT_TO = "";
    expect(redirectAddress()).toBeNull();
    process.env.EMAIL_REDIRECT_TO = "   ";
    expect(redirectAddress()).toBeNull();
  });

  it("ignoriert Leerzeichen um die Adresse", () => {
    process.env.EMAIL_REDIRECT_TO = "  dave@example.ch  ";
    expect(redirectAddress()).toBe("dave@example.ch");
  });
});

describe("sendEmail im Testmodus", () => {
  it("schickt an die Umleitung statt an den Schüler", async () => {
    process.env.EMAIL_REDIRECT_TO = "dave@example.ch";
    process.env.RESEND_API_KEY = "test";
    const gesendet = fangeVersandAb();

    await sendEmail({
      to: "schueler@example.com",
      subject: "Dein Termin steht",
      html: "<p>Hallo</p>",
    });

    expect(gesendet).toHaveLength(1);
    expect(gesendet[0].to).toBe("dave@example.ch");
    // Die Schüleradresse darf nirgends mehr als Empfänger auftauchen.
    expect(gesendet[0].to).not.toContain("schueler@example.com");
  });

  it("nennt den echten Empfänger in Betreff und Text", async () => {
    process.env.EMAIL_REDIRECT_TO = "dave@example.ch";
    process.env.RESEND_API_KEY = "test";
    const gesendet = fangeVersandAb();

    await sendEmail({
      to: "schueler@example.com",
      subject: "Dein Termin steht",
      html: "<p>Hallo</p>",
    });

    // Ohne diesen Vermerk wüsste man beim Durchsehen nicht, welche Mail zu
    // wem gehört – bei einer Runde mit fünf Schülern kämen fünf gleich
    // aussehende Mails an.
    expect(gesendet[0].subject).toBe(
      "[TEST → schueler@example.com] Dein Termin steht"
    );
    expect(gesendet[0].html).toContain("schueler@example.com");
    expect(gesendet[0].html).toContain("Testmodus");
    // Der ursprüngliche Inhalt bleibt vollständig erhalten.
    expect(gesendet[0].html).toContain("<p>Hallo</p>");
  });

  it("lässt ohne Umleitung alles unverändert", async () => {
    delete process.env.EMAIL_REDIRECT_TO;
    process.env.RESEND_API_KEY = "test";
    const gesendet = fangeVersandAb();

    await sendEmail({
      to: "schueler@example.com",
      subject: "Dein Termin steht",
      html: "<p>Hallo</p>",
    });

    expect(gesendet[0].to).toBe("schueler@example.com");
    expect(gesendet[0].subject).toBe("Dein Termin steht");
    expect(gesendet[0].html).toBe("<p>Hallo</p>");
    expect(gesendet[0].html).not.toContain("Testmodus");
  });
});
