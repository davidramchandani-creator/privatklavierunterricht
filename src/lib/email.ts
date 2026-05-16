import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "David Ramchandani <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://privatklavierunterricht.vercel.app";

export async function sendInviteEmail(to: string, vorname: string, inviteLink: string) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Deine Einladung zum Schülerportal",
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #3730A3; padding: 32px 40px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Klavierunterricht mit David</h1>
        </div>
        <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; margin-top: 0;">Hallo ${vorname}</p>
          <p style="color: #4b5563;">Du wurdest zum Schülerportal eingeladen. Klicke auf den Button unten, um dein Passwort zu setzen und dich anzumelden.</p>
          <a href="${inviteLink}" style="display: inline-block; background: #3730A3; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
            Passwort setzen &amp; anmelden
          </a>
          <p style="color: #9ca3af; font-size: 13px; margin-bottom: 0;">
            Der Link ist 24 Stunden gültig. Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.
          </p>
        </div>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Passwort zurücksetzen – Schülerportal",
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #3730A3; padding: 32px 40px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Klavierunterricht mit David</h1>
        </div>
        <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; margin-top: 0;">Hallo</p>
          <p style="color: #4b5563;">Du hast ein neues Passwort angefordert. Klicke auf den Button unten, um dein Passwort zurückzusetzen.</p>
          <a href="${resetLink}" style="display: inline-block; background: #3730A3; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
            Passwort zurücksetzen
          </a>
          <p style="color: #9ca3af; font-size: 13px; margin-bottom: 0;">
            Der Link ist 24 Stunden gültig. Falls du kein neues Passwort angefordert hast, kannst du diese E-Mail ignorieren.
          </p>
        </div>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
}
