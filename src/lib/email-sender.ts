import nodemailer from "nodemailer";

function createTransporter() {
  const host = process.env.SMTP_HOST ?? "localhost";
  const isLocalhost = host.includes("localhost");

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    ...(isLocalhost ? { tls: { rejectUnauthorized: false } } : {}),
  });
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const transporter = createTransporter();
  const fromName = process.env.SMTP_FROM_NAME ?? "Klavierunterricht David Ramchandani";
  const fromEmail = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "";

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}
