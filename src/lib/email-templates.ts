const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://privatklavierunterricht.ch";

function fmtDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-CH", {
      timeZone: "Europe/Zurich",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(new Date(iso))
      .replace(",", ",")
      + " Uhr";
  } catch {
    return iso;
  }
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-CH", {
      timeZone: "Europe/Zurich",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function baseWrapper(contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1C244B;padding:28px 32px;text-align:center;">
              <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">
                Klavierunterricht David Ramchandani
              </span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;color:#1f2937;font-size:15px;line-height:1.7;">
              ${contentHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <span style="color:#6b7280;font-size:12px;">
                Diese E-Mail wurde automatisch versandt.
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmail(
  type: string,
  payload: Record<string, unknown>
): { subject: string; html: string } | null {
  switch (type) {
    case "booking_request_admin": {
      const studentName = String(payload.student_name ?? "Unbekannt");
      const desiredStart = String(payload.desired_start ?? "");
      const lessonsCount = Number(payload.lessons_count ?? 1);
      const intervalDays = Number(payload.interval_days ?? 0);

      const subject = `Neue Terminanfrage – ${studentName}`;
      const content = `
        <p style="margin:0 0 16px;">Es liegt eine neue Terminanfrage vor:</p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;">
          <tr>
            <td style="padding:8px 0;color:#6b7280;width:180px;font-size:14px;">Schüler/in</td>
            <td style="padding:8px 0;font-weight:600;font-size:14px;">${studentName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:14px;">Wunschtermin</td>
            <td style="padding:8px 0;font-weight:600;font-size:14px;">${desiredStart ? fmtDateTime(desiredStart) : "–"}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:14px;">Anzahl Lektionen</td>
            <td style="padding:8px 0;font-weight:600;font-size:14px;">${lessonsCount}</td>
          </tr>
          ${
            intervalDays > 0
              ? `<tr>
            <td style="padding:8px 0;color:#6b7280;font-size:14px;">Seriell</td>
            <td style="padding:8px 0;font-weight:600;font-size:14px;">Ja (alle ${intervalDays} Tage)</td>
          </tr>`
              : ""
          }
        </table>
        <p style="margin:0 0 24px;">
          <a href="${APP_URL}/admin/terminanfragen"
             style="display:inline-block;background-color:#1C244B;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
            Zur Terminanfragen-Übersicht
          </a>
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "booking_request_received": {
      const desiredStart = String(payload.desired_start ?? "");
      const lessonsCount = Number(payload.lessons_count ?? 1);

      const subject = "Deine Terminanfrage wurde erhalten";
      const content = `
        <p style="margin:0 0 16px;">Vielen Dank für deine Terminanfrage!</p>
        <p style="margin:0 0 16px;">
          David hat deine Anfrage erhalten und wird sie so bald wie möglich bearbeiten.
          Du erhältst eine Bestätigung, sobald dein Termin genehmigt wurde.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Angefragter Termin</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${desiredStart ? fmtDateTime(desiredStart) : "–"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Anzahl Lektionen</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${lessonsCount}</td>
          </tr>
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Falls du Fragen hast, wende dich direkt an David.
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "booking_confirmed": {
      const starts = Array.isArray(payload.starts) ? (payload.starts as string[]) : [];
      const lessonsCount = Number(payload.lessons_count ?? starts.length);
      const intervalDays = Number(payload.interval_days ?? 0);

      const subject = "Deine Termine wurden bestätigt – Klavierunterricht";
      const displayedStarts = starts.slice(0, 10);
      const remaining = starts.length - displayedStarts.length;

      const dateListItems = displayedStarts
        .map(
          (s) =>
            `<li style="padding:4px 0;font-size:14px;">${fmtDateTime(s)}</li>`
        )
        .join("");

      const content = `
        <p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#1C244B;">
          Herzlichen Glückwunsch! 🎹
        </p>
        <p style="margin:0 0 16px;">
          Dein${lessonsCount > 1 ? "e Termine wurden" : " Termin wurde"} bestätigt.
          ${intervalDays > 0 ? `Die Lektionen finden alle ${intervalDays} Tage statt.` : ""}
        </p>
        <p style="margin:0 0 8px;font-weight:600;">Bestätigte Termine:</p>
        <ul style="margin:0 0 24px;padding-left:20px;color:#1f2937;">
          ${dateListItems}
          ${remaining > 0 ? `<li style="padding:4px 0;font-size:14px;color:#6b7280;">… und ${remaining} weitere Termine</li>` : ""}
        </ul>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Wir freuen uns auf die gemeinsamen Lektionen!
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "booking_rejected": {
      const reason = payload.reason ? String(payload.reason) : null;

      const subject = "Deine Terminanfrage – Absage";
      const content = `
        <p style="margin:0 0 16px;">
          Leider können wir deinen angefragten Termin nicht bestätigen.
        </p>
        ${
          reason
            ? `<p style="margin:0 0 16px;padding:12px 16px;background-color:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;font-size:14px;color:#7f1d1d;">
            <strong>Begründung:</strong> ${reason}
          </p>`
            : ""
        }
        <p style="margin:0 0 24px;">
          Gerne kannst du einen anderen Termin anfragen. Wir helfen dir, einen passenden Zeitpunkt zu finden.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${APP_URL}/schueler/portal"
             style="display:inline-block;background-color:#1C244B;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
            Neuen Termin anfragen
          </a>
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "booking_request_withdrawn": {
      const studentName = payload.student_name
        ? String(payload.student_name)
        : null;

      const subject = "Terminanfrage zurückgezogen";
      const content = `
        <p style="margin:0 0 16px;">
          ${
            studentName
              ? `<strong>${studentName}</strong> hat`
              : "Ein Schüler / eine Schülerin hat"
          } eine Terminanfrage zurückgezogen.
        </p>
        <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
          Die Anfrage wurde aus dem System entfernt. Es sind keine weiteren Aktionen erforderlich.
        </p>
        <p style="margin:0;">
          <a href="${APP_URL}/admin/terminanfragen"
             style="display:inline-block;background-color:#1C244B;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
            Zur Terminanfragen-Übersicht
          </a>
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "appointment_cancelled_by_student": {
      const startAt = String(payload.start_at ?? "");
      const studentName = payload.student_name
        ? String(payload.student_name)
        : null;
      const formattedDate = startAt ? fmtDateTime(startAt) : "–";

      const subject = `Termin storniert – ${startAt ? fmtDate(startAt) : "Unbekanntes Datum"}`;
      const content = `
        <p style="margin:0 0 16px;">
          ${
            studentName
              ? `<strong>${studentName}</strong> hat`
              : "Ein Schüler / eine Schülerin hat"
          } einen Termin storniert.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Stornierter Termin</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${formattedDate}</td>
          </tr>
          ${
            studentName
              ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Schüler/in</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${studentName}</td>
          </tr>`
              : ""
          }
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Der Termin ist nun wieder frei.
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "reschedule_request_admin": {
      const studentName = String(payload.student_name ?? "Unbekannt");
      const originalStart = String(payload.original_start ?? "");
      const proposedStart = String(payload.proposed_start ?? "");

      const subject = `Verschiebungswunsch – ${studentName}`;
      const content = `
        <p style="margin:0 0 16px;"><strong>${studentName}</strong> möchte einen Termin verschieben:</p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;">
          <tr>
            <td style="padding:8px 0;color:#6b7280;width:180px;font-size:14px;">Bisheriger Termin</td>
            <td style="padding:8px 0;font-weight:600;font-size:14px;">${originalStart ? fmtDateTime(originalStart) : "–"}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:14px;">Gewünschter neuer Termin</td>
            <td style="padding:8px 0;font-weight:600;font-size:14px;color:#1C244B;">${proposedStart ? fmtDateTime(proposedStart) : "–"}</td>
          </tr>
        </table>
        <p style="margin:0 0 24px;">
          <a href="${APP_URL}/admin/terminanfragen"
             style="display:inline-block;background-color:#1C244B;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
            Verschiebung prüfen
          </a>
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "reschedule_request_received": {
      const originalStart = String(payload.original_start ?? "");
      const proposedStart = String(payload.proposed_start ?? "");

      const subject = "Dein Verschiebungswunsch wurde erhalten";
      const content = `
        <p style="margin:0 0 16px;">Vielen Dank – wir haben deinen Verschiebungswunsch erhalten.</p>
        <p style="margin:0 0 16px;">
          David prüft den neuen Zeitpunkt und bestätigt ihn so bald wie möglich.
          Bis dahin bleibt dein bisheriger Termin gültig.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Bisheriger Termin</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${originalStart ? fmtDateTime(originalStart) : "–"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Gewünschter neuer Termin</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${proposedStart ? fmtDateTime(proposedStart) : "–"}</td>
          </tr>
        </table>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "reschedule_confirmed": {
      const proposedStart = String(payload.proposed_start ?? "");

      const subject = "Dein Termin wurde verschoben – Klavierunterricht";
      const content = `
        <p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#1C244B;">
          Dein Termin wurde verschoben ✓
        </p>
        <p style="margin:0 0 16px;">Dein neuer Termin ist bestätigt:</p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Neuer Termin</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;color:#1C244B;">${proposedStart ? fmtDateTime(proposedStart) : "–"}</td>
          </tr>
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">Wir freuen uns auf die Lektion!</p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "reschedule_rejected": {
      const originalStart = String(payload.original_start ?? "");
      const reason = payload.reason ? String(payload.reason) : null;

      const subject = "Dein Verschiebungswunsch – Absage";
      const content = `
        <p style="margin:0 0 16px;">
          Leider können wir deinen Verschiebungswunsch nicht annehmen.
          Dein bisheriger Termin${originalStart ? ` am <strong>${fmtDateTime(originalStart)}</strong>` : ""} bleibt bestehen.
        </p>
        ${
          reason
            ? `<p style="margin:0 0 16px;padding:12px 16px;background-color:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;font-size:14px;color:#7f1d1d;">
            <strong>Begründung:</strong> ${reason}
          </p>`
            : ""
        }
        <p style="margin:0 0 24px;">
          Gerne kannst du im Portal einen anderen Zeitpunkt anfragen.
        </p>
        <p style="margin:0;">
          <a href="${APP_URL}/schueler/portal"
             style="display:inline-block;background-color:#1C244B;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
            Zum Portal
          </a>
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "package_cancelled": {
      const lessonsUsed = Number(payload.lessons_used ?? 0);
      const singlePrice = Number(payload.single_lesson_price ?? 0);
      const refund = Number(payload.refund ?? 0);
      const owed = Number(payload.owed ?? 0);
      const chf = (n: number) =>
        `CHF ${n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const subject = "Dein Paket wurde storniert";
      const content = `
        <p style="margin:0 0 16px;">Dein Paket wurde storniert.</p>
        <p style="margin:0 0 16px;">
          Die bereits besuchten Lektionen werden zum Einzelpreis verrechnet:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:220px;font-size:14px;">Besuchte Lektionen</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${lessonsUsed} × ${chf(singlePrice)}</td>
          </tr>
          ${
            refund > 0
              ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Rückerstattung</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;color:#047857;">${chf(refund)}</td>
          </tr>`
              : ""
          }
          ${
            owed > 0
              ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Nachzahlung</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;color:#b91c1c;">${chf(owed)}</td>
          </tr>`
              : ""
          }
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          David meldet sich bei dir bezüglich der Abwicklung. Bei Fragen kannst du dich jederzeit melden.
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "twint_payment_request": {
      const studentName = String(payload.student_name ?? "");
      const lessonDate = String(payload.lesson_date ?? "");
      const amount = Number(payload.amount ?? 0);
      const twintLink = String(payload.twint_link ?? "#");
      const invoiceNumber = String(payload.invoice_number ?? "");
      const lessonsRemaining = payload.lessons_remaining != null ? Number(payload.lessons_remaining) : null;
      const packageType = payload.package_type ? String(payload.package_type) : null;

      const chf = amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const subject = `Zahlungsaufforderung – Klavierstunde vom ${lessonDate ? fmtDate(lessonDate) : ""}`;
      const content = `
        <p style="margin:0 0 16px;">Hallo ${studentName ? studentName.split(" ")[0] : ""},</p>
        <p style="margin:0 0 16px;">
          deine Klavierstunde hat stattgefunden – vielen Dank! Bitte überweise den Betrag per TWINT.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Lektion</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${lessonDate ? fmtDateTime(lessonDate) : "–"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Betrag</td>
            <td style="padding:6px 0;font-weight:700;font-size:16px;color:#1C244B;">CHF ${chf}</td>
          </tr>
          ${invoiceNumber ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Referenz</td>
            <td style="padding:6px 0;font-size:14px;">${invoiceNumber}</td>
          </tr>` : ""}
          ${lessonsRemaining != null && packageType ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Verbleibende Lektionen</td>
            <td style="padding:6px 0;font-size:14px;">${lessonsRemaining} ${packageType === "10er" ? "(10er-Abo)" : packageType === "20er" ? "(20er-Abo)" : ""}</td>
          </tr>` : ""}
        </table>
        <p style="margin:0 0 24px;">
          <a href="${twintLink}"
             style="display:inline-block;background-color:#1C244B;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700;">
            Jetzt per TWINT bezahlen
          </a>
        </p>
        <p style="margin:0 0 16px;">
          Nach der Zahlung bitte im Portal bestätigen:
        </p>
        <p style="margin:0 0 24px;">
          <a href="${APP_URL}/schueler/portal#zahlungen"
             style="display:inline-block;background-color:#f3f5f8;color:#1C244B;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;border:1px solid #e5e7eb;">
            Zahlung bestätigen
          </a>
        </p>
        <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">
          Bei Fragen melde dich jederzeit bei David.
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "qr_invoice": {
      const studentName = String(payload.student_name ?? "");
      const lessonDate = String(payload.lesson_date ?? "");
      const amount = Number(payload.amount ?? 0);
      const invoiceNumber = String(payload.invoice_number ?? "");
      const pdfLink = String(payload.pdf_link ?? "#");
      const lessonsRemaining = payload.lessons_remaining != null ? Number(payload.lessons_remaining) : null;

      const chf = amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const subject = `Rechnung ${invoiceNumber} – Klavierstunde vom ${lessonDate ? fmtDate(lessonDate) : ""}`;
      const content = `
        <p style="margin:0 0 16px;">Hallo ${studentName ? studentName.split(" ")[0] : ""},</p>
        <p style="margin:0 0 16px;">
          deine Klavierstunde hat stattgefunden – vielen Dank! Anbei deine Rechnung als QR-Rechnung.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Rechnungsnummer</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Lektion</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${lessonDate ? fmtDateTime(lessonDate) : "–"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Betrag</td>
            <td style="padding:6px 0;font-weight:700;font-size:16px;color:#1C244B;">CHF ${chf}</td>
          </tr>
          ${lessonsRemaining != null ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Verbleibende Lektionen</td>
            <td style="padding:6px 0;font-size:14px;">${lessonsRemaining}</td>
          </tr>` : ""}
        </table>
        <p style="margin:0 0 24px;">
          <a href="${pdfLink}"
             style="display:inline-block;background-color:#1C244B;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700;">
            Rechnung als PDF herunterladen
          </a>
        </p>
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">
          <strong>Zahlungsdetails:</strong><br/>
          IBAN: CH68 0830 7000 5411 7930 6<br/>
          Empfänger: David Ramchandani<br/>
          Verwendungszweck: ${invoiceNumber}
        </p>
        <p style="margin:0 0 16px;">
          Nach der Zahlung bitte im Portal bestätigen:
        </p>
        <p style="margin:0 0 24px;">
          <a href="${APP_URL}/schueler/portal#zahlungen"
             style="display:inline-block;background-color:#f3f5f8;color:#1C244B;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;border:1px solid #e5e7eb;">
            Zahlung bestätigen
          </a>
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "payment_confirmed": {
      const studentName = String(payload.student_name ?? "");
      const lessonDate = String(payload.lesson_date ?? "");
      const amount = Number(payload.amount ?? 0);
      const invoiceNumber = String(payload.invoice_number ?? "");

      const chf = amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const subject = `Zahlung bestätigt – Klavierstunde vom ${lessonDate ? fmtDate(lessonDate) : ""}`;
      const content = `
        <p style="margin:0 0 16px;">Hallo ${studentName ? studentName.split(" ")[0] : ""},</p>
        <p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#10b981;">
          Zahlung bestätigt ✓
        </p>
        <p style="margin:0 0 16px;">
          Deine Zahlung wurde erfolgreich verbucht. Danke vielmals!
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f0fdf4;border-radius:6px;padding:16px;border:1px solid #bbf7d0;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Lektion</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${lessonDate ? fmtDateTime(lessonDate) : "–"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Betrag</td>
            <td style="padding:6px 0;font-weight:700;font-size:16px;color:#10b981;">CHF ${chf}</td>
          </tr>
          ${invoiceNumber ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Rechnungsnummer</td>
            <td style="padding:6px 0;font-size:14px;">${invoiceNumber}</td>
          </tr>` : ""}
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "payment_rejected": {
      const studentName = String(payload.student_name ?? "");
      const lessonDate = String(payload.lesson_date ?? "");
      const amount = Number(payload.amount ?? 0);
      const invoiceNumber = String(payload.invoice_number ?? "");
      const reason = payload.reason ? String(payload.reason) : null;

      const chf = amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const subject = `Zahlung nicht gefunden – Klavierstunde vom ${lessonDate ? fmtDate(lessonDate) : ""}`;
      const content = `
        <p style="margin:0 0 16px;">Hallo ${studentName ? studentName.split(" ")[0] : ""},</p>
        <p style="margin:0 0 16px;">
          Leider konnte deine Zahlung für die folgende Lektion nicht gefunden werden:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#fef2f2;border-radius:6px;padding:16px;border:1px solid #fecaca;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Lektion</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${lessonDate ? fmtDateTime(lessonDate) : "–"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Betrag</td>
            <td style="padding:6px 0;font-weight:700;font-size:16px;color:#dc2626;">CHF ${chf}</td>
          </tr>
          ${invoiceNumber ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Rechnungsnummer</td>
            <td style="padding:6px 0;font-size:14px;">${invoiceNumber}</td>
          </tr>` : ""}
        </table>
        ${reason ? `<p style="margin:0 0 16px;padding:12px 16px;background-color:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;font-size:14px;color:#7f1d1d;">
          <strong>Hinweis:</strong> ${reason}
        </p>` : ""}
        <p style="margin:0 0 16px;">
          Bitte überweise den Betrag erneut und bestätige die Zahlung anschliessend im Portal.
          Falls du glaubst, dass ein Fehler vorliegt, melde dich direkt bei David.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${APP_URL}/schueler/portal#zahlungen"
             style="display:inline-block;background-color:#1C244B;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">
            Zum Portal
          </a>
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "appointment_cancelled_student": {
      const startAt = String(payload.start_at ?? "");
      const formattedDate = startAt ? fmtDateTime(startAt) : "–";

      const subject = `Deine Stornierung ist bestätigt – ${startAt ? fmtDate(startAt) : ""}`.trim();
      const content = `
        <p style="margin:0 0 16px;">Hallo,</p>
        <p style="margin:0 0 16px;">
          deine Lektion wurde wie gewünscht storniert. Hier die Bestätigung:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Stornierter Termin</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${formattedDate}</td>
          </tr>
        </table>
        <p style="margin:0 0 16px;">
          Die Lektion wurde dir nicht vom Paket abgezogen. Du kannst jederzeit
          einen neuen Termin anfragen.
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "appointment_cancelled_by_admin": {
      const startAt = String(payload.start_at ?? "");
      const formattedDate = startAt ? fmtDateTime(startAt) : "–";
      const reason = payload.reason ? String(payload.reason) : null;

      const subject = `Termin abgesagt – ${startAt ? fmtDate(startAt) : ""}`.trim();
      const content = `
        <p style="margin:0 0 16px;">Hallo,</p>
        <p style="margin:0 0 16px;">
          leider muss deine folgende Lektion entfallen:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Abgesagter Termin</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${formattedDate}</td>
          </tr>
          ${
            reason
              ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Grund</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${reason}</td>
          </tr>`
              : ""
          }
        </table>
        <p style="margin:0 0 16px;">
          Die Lektion wurde dir nicht vom Paket abgezogen. Melde dich gerne für
          einen Ersatztermin.
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "reschedule_request_withdrawn": {
      const studentName = payload.student_name ? String(payload.student_name) : null;
      const originalStart = String(payload.original_start ?? "");

      const subject = "Verschiebung zurückgezogen";
      const content = `
        <p style="margin:0 0 16px;">
          ${
            studentName ? `<strong>${studentName}</strong>` : "Ein Schüler / eine Schülerin"
          } hat eine offene Verschiebungsanfrage zurückgezogen.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Betroffener Termin</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${originalStart ? fmtDateTime(originalStart) : "–"}</td>
          </tr>
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Der ursprüngliche Termin bleibt unverändert bestehen.
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "proposal_new": {
      const proposedStart = String(payload.proposed_start ?? "");
      const lessonsCount = Number(payload.lessons_count ?? 1);
      const intervalDays = Number(payload.interval_days ?? 0);

      const subject = "Neuer Terminvorschlag von David";
      const content = `
        <p style="margin:0 0 16px;">Hallo,</p>
        <p style="margin:0 0 16px;">
          David hat dir einen neuen Termin vorgeschlagen:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Vorgeschlagener Start</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${proposedStart ? fmtDateTime(proposedStart) : "–"}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Anzahl Lektionen</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${lessonsCount}</td>
          </tr>
          ${
            intervalDays > 0 && lessonsCount > 1
              ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Rhythmus</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">alle ${intervalDays} Tage</td>
          </tr>`
              : ""
          }
        </table>
        <p style="margin:0 0 24px;">
          <a href="${APP_URL}/schueler/portal"
             style="display:inline-block;background-color:#1C244B;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
            Im Portal annehmen oder ablehnen
          </a>
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "proposal_rejected_admin": {
      const studentName = payload.student_name ? String(payload.student_name) : null;
      const proposedStart = String(payload.proposed_start ?? "");

      const subject = "Terminvorschlag abgelehnt";
      const content = `
        <p style="margin:0 0 16px;">
          ${
            studentName ? `<strong>${studentName}</strong>` : "Ein Schüler / eine Schülerin"
          } hat deinen Terminvorschlag abgelehnt.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Vorgeschlagen war</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${proposedStart ? fmtDateTime(proposedStart) : "–"}</td>
          </tr>
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Du kannst im Schülerprofil einen neuen Vorschlag machen.
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "package_settlement_paid": {
      const amount = Number(payload.amount ?? 0);
      const subject = "Zahlung erhalten – Stornierungsbetrag";
      const content = `
        <p style="margin:0 0 16px;">Hallo,</p>
        <p style="margin:0 0 16px;">
          vielen Dank – der Stornierungsbetrag von
          <strong>CHF ${amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          ist bei mir eingegangen. Damit ist die Stornierung vollständig abgeschlossen.
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    default:
      return null;
  }
}
