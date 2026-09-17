import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Die Mailadresse gehört Profil und Login-Konto zugleich.
 *
 * Maurice, 17. September 2026: Profil auf Rolands Adresse, Konto noch auf
 * Jasmines. Post kam an, „Passwort vergessen" mit Rolands Adresse fand kein
 * Konto und tat still nichts.
 */
describe("Mailadresse und Login-Konto", () => {
  const ohneKommentare = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const actions = ohneKommentare(
    readFileSync(join(process.cwd(), "src", "app", "admin", "actions.ts"), "utf8")
  );

  it("beim Bearbeiten wandert die Adresse auch ans Konto", () => {
    const anfang = actions.indexOf("export async function updateSchueler");
    const ende = actions.indexOf("export async function", anfang + 10);
    const fn = actions.slice(anfang, ende);
    expect(fn).toContain("auth.admin.updateUserById(id");
    expect(fn).toMatch(/email,\s*email_confirm:\s*true/);
    // Externe haben kein Konto, dort gibt es nichts anzugleichen.
    expect(fn).toContain("!bisher?.extern");
    // Erst das Konto, dann das Profil: Scheitert das Konto, bleibt beides
    // beim alten Stand statt auseinanderzulaufen.
    expect(fn.indexOf("updateUserById")).toBeLessThan(fn.indexOf('.from("profiles").update(felder)'));
  });

  it("der Zugangslink aus dem Admin geht denselben sicheren Weg wie „Passwort vergessen\"", () => {
    // token_hash auf eigener Seite, erst nach Klick eingelöst. Der frühere
    // Direktlink über Supabases /verify wurde von Mail-Vorschauen verbrannt.
    const anfang = actions.indexOf("export async function resendInvite");
    const ende = actions.indexOf("export async function", anfang + 10);
    const fn = actions.slice(anfang, ende);
    expect(fn).toContain("hashed_token");
    expect(fn).toContain("/auth/bestaetigen?token_hash=");
    expect(fn).not.toContain("action_link");
    expect(fn).toContain('renderEmail("password_reset"');
    // Und im Admin darf der Fehler sichtbar sein, anders als auf der
    // öffentlichen Loginseite.
    expect(fn).toContain("kein Login-Konto");
  });
});
