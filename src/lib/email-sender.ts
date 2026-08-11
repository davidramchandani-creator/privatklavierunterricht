import nodemailer from "nodemailer";

/**
 * Absender-Adresse. Muss in Resend als verifizierte Domain hinterlegt sein
 * (privatklavierunterricht.ch). Reihenfolge: EMAIL_FROM → SMTP_FROM → Default.
 */
function fromAddress(): string {
  const name =
    process.env.SMTP_FROM_NAME ?? "Klavierunterricht David Ramchandani";
  const email =
    process.env.EMAIL_FROM ??
    process.env.SMTP_FROM ??
    "david@privatklavierunterricht.ch";
  return `${name} <${email}>`;
}

/**
 * Testmodus: Umleitungsadresse, falls gesetzt.
 *
 * Solange `EMAIL_REDIRECT_TO` gesetzt ist, bekommt **kein** Schüler Post. Das
 * ist der einzige Ort, an dem umgeleitet wird — bewusst ganz unten am
 * Versand, damit auch geplante Mails aus der Outbox und jede künftige
 * Mailstelle erfasst sind, ohne dass jemand daran denken muss.
 */
export function redirectAddress(): string | null {
  const wert = process.env.EMAIL_REDIRECT_TO?.trim();
  return wert ? wert : null;
}

/** Sichtbarer Hinweis im Mailkopf, wer sie eigentlich bekommen hätte. */
function testBanner(echterEmpfaenger: string): string {
  return `<div style="background:#f59e0b;color:#1c1917;padding:12px 16px;font-family:sans-serif;font-size:13px;line-height:1.5;">
    <strong>Testmodus.</strong> Diese Mail wurde umgeleitet.
    Empfänger wäre gewesen: <strong>${echterEmpfaenger}</strong>.
  </div>`;
}

/**
 * Versand bevorzugt über die Resend-HTTP-API (läuft über 443, serverless-sicher).
 * Fällt nur ohne RESEND_API_KEY auf SMTP zurück (lokale Entwicklung).
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;

  // Umleitung vor allem anderen: ab hier gibt es keinen Weg mehr zum Schüler.
  const umleitung = redirectAddress();
  if (umleitung) {
    opts = {
      to: umleitung,
      subject: `[TEST → ${opts.to}] ${opts.subject}`,
      html: testBanner(opts.to) + opts.html,
    };
  }

  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend API ${res.status}: ${detail}`);
    }
    return;
  }

  // Fallback: SMTP (lokal / falls kein Resend-Key gesetzt ist).
  const host = process.env.SMTP_HOST ?? "localhost";
  const isLocalhost = host.includes("localhost");
  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    ...(isLocalhost ? { tls: { rejectUnauthorized: false } } : {}),
  });
  await transporter.sendMail({
    from: fromAddress(),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}
