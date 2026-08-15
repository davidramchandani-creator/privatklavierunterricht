import { BASIS_URL } from "@/lib/seo";
import { GOOGLE_BEWERTEN_URL } from "@/lib/google-bewertung";

const APP_URL = BASIS_URL;

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
    // ── Schüler-Aktionen an den Admin ───────────────────────────────
    case "payment_reported_admin": {
      const amount = Number(payload.amount ?? 0).toFixed(2);
      return {
        subject: `Zahlung gemeldet: CHF ${amount} von ${payload.student_name ?? "Schüler"}`,
        html: baseWrapper(
          `<p><strong>${payload.student_name ?? "Ein Schüler"}</strong> hat eine Zahlung als erledigt markiert.</p>
           <p>
             <strong>Betrag:</strong> CHF ${amount}<br/>
             ${payload.invoice_number ? `<strong>Rechnung:</strong> ${payload.invoice_number}<br/>` : ""}
             ${payload.lesson_date ? `<strong>Lektion:</strong> ${fmtDateTime(String(payload.lesson_date))}<br/>` : ""}
           </p>
           <p>Bitte prüfe den Zahlungseingang und bestätige oder lehne die Zahlung im Adminbereich ab.</p>
           <p style="text-align:center;margin:24px 0;">
             <a href="${APP_URL}/admin/zahlungen" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Zahlungen öffnen</a>
           </p>`
        ),
      };
    }
    case "package_purchased_admin": {
      return {
        subject: `Neues Paket gebucht: ${payload.package_label ?? "Paket"} – ${payload.student_name ?? "Schüler"}`,
        html: baseWrapper(
          `<p><strong>${payload.student_name ?? "Ein Schüler"}</strong> hat ein neues Paket gebucht.</p>
           <p>
             <strong>Paket:</strong> ${payload.package_label ?? "-"}<br/>
             <strong>Lektionen:</strong> ${payload.lessons_total ?? "-"}<br/>
             <strong>Preis pro Lektion:</strong> CHF ${Number(payload.price_per_lesson ?? 0).toFixed(2)}<br/>
             <strong>Gesamtpreis:</strong> CHF ${Number(payload.total_price ?? 0).toFixed(2)}
           </p>
           <p>Die Rechnung wurde automatisch erstellt und dem Schüler zugestellt.</p>
           <p style="text-align:center;margin:24px 0;">
             <a href="${APP_URL}/admin/zahlungen" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Zahlungen öffnen</a>
           </p>`
        ),
      };
    }
    case "proposal_accepted_admin": {
      return {
        subject: `Terminvorschlag angenommen von ${payload.student_name ?? "Schüler"}`,
        html: baseWrapper(
          `<p><strong>${payload.student_name ?? "Ein Schüler"}</strong> hat deinen Terminvorschlag angenommen.</p>
           <p>
             <strong>Termin:</strong> ${payload.proposed_start ? fmtDateTime(String(payload.proposed_start)) : "-"}<br/>
             ${Number(payload.lessons_count ?? 1) > 1 ? `<strong>Serie:</strong> ${payload.lessons_count} Lektionen alle ${payload.interval_days} Tage<br/>` : ""}
           </p>
           <p>Die Termine sind gebucht und im Kalender eingetragen.</p>
           <p style="text-align:center;margin:24px 0;">
             <a href="${APP_URL}/admin/kalender" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Kalender öffnen</a>
           </p>`
        ),
      };
    }
    // ── Kontaktformular ─────────────────────────────────────────────
    case "kontakt_received": {
      return {
        subject: "Deine Nachricht ist angekommen",
        html: baseWrapper(
          `<p>Hallo ${payload.vorname ?? ""}</p>
           <p>Danke für deine Nachricht, ich habe sie erhalten und melde mich
              so bald wie möglich bei dir.</p>
           ${payload.betreff ? `<p><strong>Betreff:</strong> ${payload.betreff}</p>` : ""}
           <p style="background:#f9fafb;border-left:3px solid #1C244B;padding:12px 16px;color:#4b5563;white-space:pre-wrap;">${String(payload.nachricht ?? "")}</p>
           <p>Liebe Grüsse<br/>David Ramchandani</p>`
        ),
      };
    }
    case "kontakt_admin": {
      return {
        subject: `Neue Kontaktanfrage von ${payload.vorname ?? ""} ${payload.nachname ?? ""}`.trim(),
        html: baseWrapper(
          `<p><strong>Neue Nachricht über das Kontaktformular</strong></p>
           <p>
             <strong>Name:</strong> ${payload.vorname ?? ""} ${payload.nachname ?? ""}<br/>
             <strong>E-Mail:</strong> ${payload.email ?? ""}<br/>
             ${payload.telefon ? `<strong>Telefon:</strong> ${payload.telefon}<br/>` : ""}
             ${payload.betreff ? `<strong>Betreff:</strong> ${payload.betreff}<br/>` : ""}
           </p>
           <p style="background:#f9fafb;border-left:3px solid #1C244B;padding:12px 16px;color:#4b5563;white-space:pre-wrap;">${String(payload.nachricht ?? "")}</p>
           <p style="text-align:center;margin:24px 0;">
             <a href="${APP_URL}/admin/anfragen" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Im Admin ansehen</a>
           </p>`
        ),
      };
    }
    // ── Erinnerungen ────────────────────────────────────────────────
    case "lesson_reminder_24h": {
      const start = fmtDateTime(String(payload.start_at));
      return {
        subject: `Erinnerung: Klavierunterricht morgen (${start})`,
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + payload.student_name : ""}</p>
           <p>Kurze Erinnerung: Deine Klavierlektion findet <strong>${start}</strong> statt.</p>
           <p>Falls es dir nicht passt, kannst du den Termin <strong>bis 24 Stunden vorher</strong>
              im Portal verschieben oder stornieren, danach ist das leider nicht mehr möglich.</p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Zum Schülerportal</a>
           </p>
           <p>Bis morgen!<br/>Liebe Grüsse<br/>David</p>`
        ),
      };
    }
    case "lesson_reminder_2h": {
      const start = fmtDateTime(String(payload.start_at));
      return {
        subject: `Gleich geht's los: Klavierunterricht um ${start}`,
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + payload.student_name : ""}</p>
           <p>Deine Klavierlektion beginnt <strong>${start}</strong>. Bis gleich!</p>
           <p>Liebe Grüsse<br/>David</p>`
        ),
      };
    }
    case "payment_overdue": {
      const amount = Number(payload.amount ?? 0).toFixed(2);
      return {
        subject: `Zahlungserinnerung: CHF ${amount} offen`,
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + payload.student_name : ""}</p>
           <p>Der Betrag von <strong>CHF ${amount}</strong>${
             payload.invoice_number ? ` (Rechnung ${payload.invoice_number})` : ""
           } war am <strong>${fmtDate(String(payload.due_date))}</strong> fällig und ist noch offen.</p>
           <p>Diese erste Erinnerung ist rein informativ, bitte begleiche den Betrag
              bei Gelegenheit im Portal.</p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Jetzt bezahlen</a>
           </p>
           <p>Falls du bereits bezahlt hast, ignoriere diese Nachricht einfach.</p>
           <p>Liebe Grüsse<br/>David</p>`
        ),
      };
    }
    case "package_expiring": {
      const remaining = Number(payload.lessons_remaining ?? 0);
      return {
        subject: "Dein Paket läuft bald ab",
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + payload.student_name : ""}</p>
           <p>Dein Paket ist noch bis <strong>${fmtDate(String(payload.expires_at))}</strong> gültig${
             remaining > 0
               ? `, du hast noch <strong>${remaining} Lektion${remaining === 1 ? "" : "en"}</strong> offen`
               : ""
           }.</p>
           <p>Nicht genutzte Lektionen verfallen nach Ablauf. Am besten buchst du deine
              restlichen Termine jetzt im Portal.</p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Termine buchen</a>
           </p>
           <p>Liebe Grüsse<br/>David</p>`
        ),
      };
    }
    case "booking_request_admin": {
      const studentName = String(payload.student_name ?? "Unbekannt");
      const desiredStarts = Array.isArray(payload.desired_starts)
        ? (payload.desired_starts as string[])
        : payload.desired_start
          ? [String(payload.desired_start)]
          : [];
      const count = desiredStarts.length;

      const subject = `Neue Terminanfrage: ${studentName} (${count} Termin${count !== 1 ? "e" : ""})`;
      const dateRows = desiredStarts
        .map(
          (s) =>
            `<li style="padding:3px 0;font-size:14px;font-weight:600;">${fmtDateTime(s)}</li>`
        )
        .join("");
      const content = `
        <p style="margin:0 0 16px;">Es liegt eine neue Terminanfrage vor:</p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:16px;">
          <tr>
            <td style="padding:8px 0;color:#6b7280;width:180px;font-size:14px;">Schüler/in</td>
            <td style="padding:8px 0;font-weight:600;font-size:14px;">${studentName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:14px;">Anzahl Termine</td>
            <td style="padding:8px 0;font-weight:600;font-size:14px;">${count}</td>
          </tr>
        </table>
        ${count > 0 ? `
        <p style="margin:0 0 8px;font-weight:600;font-size:14px;">Gewünschte Termine:</p>
        <ul style="margin:0 0 24px;padding-left:20px;color:#1f2937;">${dateRows}</ul>
        ` : ""}
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
      const desiredStarts = Array.isArray(payload.desired_starts)
        ? (payload.desired_starts as string[])
        : payload.desired_start
          ? [String(payload.desired_start)]
          : [];
      const count = desiredStarts.length;

      const subject =
        count > 1
          ? `Deine ${count} Terminanfragen wurden erhalten`
          : "Deine Terminanfrage wurde erhalten";

      const dateItems = desiredStarts
        .map(
          (s) =>
            `<li style="padding:3px 0;font-size:14px;font-weight:600;">${fmtDateTime(s)}</li>`
        )
        .join("");

      const content = `
        <p style="margin:0 0 16px;">Vielen Dank für deine Terminanfrage${count > 1 ? "n" : ""}!</p>
        <p style="margin:0 0 16px;">
          David hat deine Anfrage erhalten und wird ${count > 1 ? "jeden Termin einzeln" : "sie so bald wie möglich"} bearbeiten.
          Du erhältst eine Bestätigung, sobald ${count > 1 ? "ein Termin" : "dein Termin"} genehmigt wurde.
        </p>
        ${count > 0 ? `
        <div style="background-color:#f9fafb;border-radius:6px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Angefragte Termine (${count}):</p>
          <ul style="margin:0;padding-left:20px;color:#1f2937;">${dateItems}</ul>
        </div>
        ` : ""}
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

      const subject = "Deine Termine wurden bestätigt: Klavierunterricht";
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
          Ich freue mich auf die gemeinsamen Lektionen!
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "booking_rejected": {
      const reason = payload.reason ? String(payload.reason) : null;

      const subject = "Deine Terminanfrage: Absage";
      const content = `
        <p style="margin:0 0 16px;">
          Leider kann ich deinen angefragten Termin nicht bestätigen.
        </p>
        ${
          reason
            ? `<p style="margin:0 0 16px;padding:12px 16px;background-color:#fef2f2;border-left:3px solid #ef4444;border-radius:4px;font-size:14px;color:#7f1d1d;">
            <strong>Begründung:</strong> ${reason}
          </p>`
            : ""
        }
        <p style="margin:0 0 24px;">
          Gerne kannst du einen anderen Termin anfragen. Ich helfe dir gerne, einen passenden Zeitpunkt zu finden.
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

      const subject = `Termin storniert: ${startAt ? fmtDate(startAt) : "Unbekanntes Datum"}`;
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

      const subject = `Verschiebungswunsch: ${studentName}`;
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
        <p style="margin:0 0 16px;">Vielen Dank, ich habe deinen Verschiebungswunsch erhalten.</p>
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

      const subject = "Dein Termin wurde verschoben: Klavierunterricht";
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
        <p style="margin:0;color:#6b7280;font-size:13px;">Ich freue mich auf die Lektion!</p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "reschedule_rejected": {
      const originalStart = String(payload.original_start ?? "");
      const reason = payload.reason ? String(payload.reason) : null;

      const subject = "Dein Verschiebungswunsch: Absage";
      const content = `
        <p style="margin:0 0 16px;">
          Leider kann ich deinen Verschiebungswunsch nicht annehmen.
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
      const twintLink = String(payload.twint_link ?? "");
      const invoiceNumber = String(payload.invoice_number ?? "");
      const lessonsRemaining = payload.lessons_remaining != null ? Number(payload.lessons_remaining) : null;
      const packageType = payload.package_type ? String(payload.package_type) : null;
      // Paket-Rechnung im Voraus: description (z.B. "10er-Paket") + Fälligkeit.
      const description = payload.description ? String(payload.description) : null;
      const dueDate = payload.due_date ? String(payload.due_date) : null;
      const isPackage = !lessonDate && !!description;

      const chf = amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const subject = isPackage
        ? `Zahlungsaufforderung: ${description}`
        : `Zahlungsaufforderung: Klavierstunde vom ${lessonDate ? fmtDate(lessonDate) : ""}`;
      const introText = isPackage
        ? `vielen Dank für deine Buchung! Bitte überweise den Betrag für dein ${description} per TWINT.`
        : `deine Klavierstunde hat stattgefunden, vielen Dank! Bitte überweise den Betrag per TWINT.`;
      const content = `
        <p style="margin:0 0 16px;">Hallo ${studentName ? studentName.split(" ")[0] : ""},</p>
        <p style="margin:0 0 16px;">
          ${introText}
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">${isPackage ? "Paket" : "Lektion"}</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${isPackage ? description : (lessonDate ? fmtDateTime(lessonDate) : "–")}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Betrag</td>
            <td style="padding:6px 0;font-weight:700;font-size:16px;color:#1C244B;">CHF ${chf}</td>
          </tr>
          ${invoiceNumber ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Referenz</td>
            <td style="padding:6px 0;font-size:14px;">${invoiceNumber}</td>
          </tr>` : ""}
          ${isPackage && dueDate ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Zahlbar bis</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${fmtDate(dueDate)}</td>
          </tr>` : ""}
          ${!isPackage && lessonsRemaining != null && packageType ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Verbleibende Lektionen</td>
            <td style="padding:6px 0;font-size:14px;">${lessonsRemaining} ${packageType === "10er" ? "(10er-Abo)" : packageType === "20er" ? "(20er-Abo)" : ""}</td>
          </tr>` : ""}
        </table>
        ${twintLink ? `<p style="margin:0 0 24px;">
          <a href="${twintLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
            <img alt="Mit TWINT bezahlen" src="https://go.twint.ch/static/img/button_dark_en.svg" style="height:58px;width:auto;border:none;" />
          </a>
        </p>` : ""}
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
      // Paket-Rechnung im Voraus: description (z.B. "10er-Paket") + Fälligkeit.
      const description = payload.description ? String(payload.description) : null;
      const dueDate = payload.due_date ? String(payload.due_date) : null;
      const isPackage = !lessonDate && !!description;

      const chf = amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const subject = isPackage
        ? `Rechnung ${invoiceNumber} – ${description}`
        : `Rechnung ${invoiceNumber}: Klavierstunde vom ${lessonDate ? fmtDate(lessonDate) : ""}`;
      const introText = isPackage
        ? `vielen Dank für deine Buchung! Anbei die QR-Rechnung für dein ${description}.`
        : `deine Klavierstunde hat stattgefunden, vielen Dank! Anbei deine Rechnung als QR-Rechnung.`;
      const content = `
        <p style="margin:0 0 16px;">Hallo ${studentName ? studentName.split(" ")[0] : ""},</p>
        <p style="margin:0 0 16px;">
          ${introText}
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Rechnungsnummer</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">${isPackage ? "Paket" : "Lektion"}</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${isPackage ? description : (lessonDate ? fmtDateTime(lessonDate) : "–")}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Betrag</td>
            <td style="padding:6px 0;font-weight:700;font-size:16px;color:#1C244B;">CHF ${chf}</td>
          </tr>
          ${isPackage && dueDate ? `<tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Zahlbar bis</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${fmtDate(dueDate)}</td>
          </tr>` : ""}
          ${!isPackage && lessonsRemaining != null ? `<tr>
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

    case "group_session_created": {
      const courseTitle = String(payload.course_title ?? "Gruppenkurs");
      const startAt = String(payload.start_at ?? "");
      const subject = `Gruppenlektion eröffnet: ${courseTitle}`;
      const content = `
        <p style="margin:0 0 16px;">Hallo,</p>
        <p style="margin:0 0 16px;">
          du hast eine Gruppenlektion für <strong>${courseTitle}</strong> eröffnet:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Termin</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${startAt ? fmtDateTime(startAt) : "–"}</td>
          </tr>
        </table>
        <p style="margin:0 0 16px;">
          Andere Schüler können dieser Lektion noch beitreten. Je mehr Teilnehmer,
          desto günstiger wird der Preis pro Person. Den Betrag erhältst du erst
          nach der Lektion.
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "group_session_joined": {
      const courseTitle = String(payload.course_title ?? "Gruppenkurs");
      const startAt = String(payload.start_at ?? "");
      const subject = `Anmeldung bestätigt: ${courseTitle}`;
      const content = `
        <p style="margin:0 0 16px;">Hallo,</p>
        <p style="margin:0 0 16px;">
          du bist für die Gruppenlektion <strong>${courseTitle}</strong> angemeldet:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Termin</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${startAt ? fmtDateTime(startAt) : "–"}</td>
          </tr>
        </table>
        <p style="margin:0 0 16px;">
          Den Betrag (abhängig von der Teilnehmerzahl) erhältst du erst nach der Lektion.
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "group_session_left": {
      const startAt = String(payload.start_at ?? "");
      const subject = "Abmeldung bestätigt: Gruppenlektion";
      const content = `
        <p style="margin:0 0 16px;">Hallo,</p>
        <p style="margin:0 0 16px;">
          deine Abmeldung von der Gruppenlektion${startAt ? ` am <strong>${fmtDateTime(startAt)}</strong>` : ""} ist bestätigt.
          Es entstehen dir dafür keine Kosten.
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "group_session_admin": {
      const studentName = String(payload.student_name ?? "Ein Schüler");
      const courseTitle = payload.course_title ? String(payload.course_title) : null;
      const startAt = String(payload.start_at ?? "");
      const kind = String(payload.kind ?? "");
      const verb =
        kind === "created"
          ? "hat eine Gruppenlektion eröffnet"
          : kind === "joined"
            ? "ist einer Gruppenlektion beigetreten"
            : "hat sich von einer Gruppenlektion abgemeldet";
      const subject = `Gruppenkurs: ${studentName} ${verb}`;
      const content = `
        <p style="margin:0 0 16px;">Hallo David,</p>
        <p style="margin:0 0 16px;">
          <strong>${studentName}</strong> ${verb}${courseTitle ? ` (${courseTitle})` : ""}:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Termin</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${startAt ? fmtDateTime(startAt) : "–"}</td>
          </tr>
        </table>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "group_payment_request": {
      const studentName = String(payload.student_name ?? "");
      const courseTitle = String(payload.course_title ?? "Gruppenkurs");
      const lessonDate = String(payload.lesson_date ?? "");
      const amount = Number(payload.amount ?? 0);
      const method = String(payload.method ?? "qr");
      const invoiceNumber = payload.invoice_number ? String(payload.invoice_number) : "";
      const participantCount = payload.participant_count != null ? Number(payload.participant_count) : null;
      const chf = amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const detailRows = `
        <tr>
          <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">Gruppenkurs</td>
          <td style="padding:6px 0;font-weight:600;font-size:14px;">${courseTitle}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:14px;">Lektion</td>
          <td style="padding:6px 0;font-weight:600;font-size:14px;">${lessonDate ? fmtDateTime(lessonDate) : "–"}</td>
        </tr>
        ${participantCount != null ? `<tr>
          <td style="padding:6px 0;color:#6b7280;font-size:14px;">Teilnehmer</td>
          <td style="padding:6px 0;font-size:14px;">${participantCount}</td>
        </tr>` : ""}
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:14px;">Betrag</td>
          <td style="padding:6px 0;font-weight:700;font-size:16px;color:#1C244B;">CHF ${chf}</td>
        </tr>
        ${invoiceNumber ? `<tr>
          <td style="padding:6px 0;color:#6b7280;font-size:14px;">Referenz</td>
          <td style="padding:6px 0;font-size:14px;">${invoiceNumber}</td>
        </tr>` : ""}
      `;

      const gruppenTwintLink = String(payload.twint_link ?? "");
      const payBlock =
        method === "twint" && gruppenTwintLink
          ? `<p style="margin:0 0 24px;">
              <a href="${gruppenTwintLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
                <img alt="Mit TWINT bezahlen" src="https://go.twint.ch/static/img/button_dark_en.svg" style="height:58px;width:auto;border:none;" />
              </a>
            </p>`
          : `<p style="margin:0 0 24px;">
              <a href="${String(payload.pdf_link ?? "#")}"
                 style="display:inline-block;background-color:#1C244B;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700;">
                Rechnung als PDF herunterladen
              </a>
            </p>`;

      const subject = `Zahlungsaufforderung: Gruppenlektion ${courseTitle}`;
      const content = `
        <p style="margin:0 0 16px;">Hallo ${studentName ? studentName.split(" ")[0] : ""},</p>
        <p style="margin:0 0 16px;">
          deine Gruppenlektion hat stattgefunden, vielen Dank! Bitte begleiche den Betrag.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#f9fafb;border-radius:6px;padding:16px;">
          ${detailRows}
        </table>
        ${payBlock}
        <p style="margin:0 0 16px;">Nach der Zahlung bitte im Portal bestätigen:</p>
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
      // Rechnungen ohne Lektionsdatum (Paket, Anzahlung, Rate) tragen ihre
      // Bezeichnung in `description`.
      const bezeichnung = payload.description ? String(payload.description) : null;
      const unlocksBooking = payload.unlocks_booking === true;

      const chf = amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const subject = lessonDate
        ? `Zahlung bestätigt: Klavierstunde vom ${fmtDate(lessonDate)}`
        : bezeichnung
          ? `Zahlung bestätigt: ${bezeichnung}`
          : "Zahlung bestätigt";
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
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">${lessonDate ? "Lektion" : "Position"}</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${
              lessonDate ? fmtDateTime(lessonDate) : (bezeichnung ?? "–")
            }</td>
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
        ${unlocksBooking ? `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-weight:600;color:#166534;">Du kannst jetzt Termine buchen</p>
          <p style="margin:0;color:#166534;font-size:14px;">
            Mit der Anzahlung ist dein Paket freigeschaltet. Alle Lektionen
            stehen dir ab sofort zur Verfügung, die weiteren Raten laufen
            monatlich weiter.
          </p>
        </div>
        <p style="text-align:center;margin:0 0 24px;">
          <a href="${APP_URL}/schueler/portal#termine" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Termine buchen</a>
        </p>` : ""}
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
      // Paket-, Anzahlungs- und Ratenrechnungen haben kein Lektionsdatum;
      // sie tragen ihre Bezeichnung in `description`.
      const bezeichnung = payload.description ? String(payload.description) : null;

      const chf = amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const subject = lessonDate
        ? `Zahlung nicht gefunden: Klavierstunde vom ${fmtDate(lessonDate)}`
        : bezeichnung
          ? `Zahlung nicht gefunden: ${bezeichnung}`
          : "Zahlung nicht gefunden";
      const content = `
        <p style="margin:0 0 16px;">Hallo ${studentName ? studentName.split(" ")[0] : ""},</p>
        <p style="margin:0 0 16px;">
          Leider konnte ich deine Zahlung für ${
            lessonDate ? "die folgende Lektion" : "die folgende Position"
          } nicht finden:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background-color:#fef2f2;border-radius:6px;padding:16px;border:1px solid #fecaca;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;width:180px;font-size:14px;">${lessonDate ? "Lektion" : "Position"}</td>
            <td style="padding:6px 0;font-weight:600;font-size:14px;">${
              lessonDate ? fmtDateTime(lessonDate) : (bezeichnung ?? "–")
            }</td>
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

      const subject = `Deine Stornierung ist bestätigt: ${startAt ? fmtDate(startAt) : ""}`.trim();
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

      const subject = `Termin abgesagt: ${startAt ? fmtDate(startAt) : ""}`.trim();
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
      const subject = "Zahlung erhalten: Stornierungsbetrag";
      const content = `
        <p style="margin:0 0 16px;">Hallo,</p>
        <p style="margin:0 0 16px;">
          vielen Dank, der Stornierungsbetrag von
          <strong>CHF ${amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          ist bei mir eingegangen. Damit ist die Stornierung vollständig abgeschlossen.
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "password_reset": {
      const resetUrl = String(payload.reset_url ?? "");
      const subject = "Passwort zurücksetzen";
      const content = `
        <p style="margin:0 0 16px;">Hallo,</p>
        <p style="margin:0 0 24px;">
          es liegt eine Anfrage vor, dein Passwort zurückzusetzen.
          Klicke auf den Button, um ein neues Passwort festzulegen:
        </p>
        <p style="text-align:center;margin:0 0 24px;">
          <a href="${resetUrl}"
             style="display:inline-block;background-color:#1C244B;color:#ffffff;text-decoration:none;
                    padding:13px 32px;border-radius:8px;font-size:15px;font-weight:600;">
            Passwort zurücksetzen
          </a>
        </p>
        <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">
          Der Link ist <strong>60 Minuten</strong> gültig. Falls du keine Zurücksetzung
          angefragt hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.
        </p>
        <p style="margin:0;">Liebe Grüsse<br/>David Ramchandani</p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "anfrage_received": {
      const vorname = String(payload.vorname ?? "");
      const wunschtermin = payload.wunschtermin ? String(payload.wunschtermin) : null;
      const subject = "Deine Probestunden-Anfrage ist eingegangen";
      const content = `
        <p style="margin:0 0 16px;">Hallo ${vorname},</p>
        <p style="margin:0 0 16px;">
          vielen Dank für deine Anfrage! Ich habe sie erhalten und melde mich so bald wie möglich bei dir.
        </p>
        ${wunschtermin ? `
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:20px;background:#f8f9fa;border-radius:8px;">
          <tr>
            <td style="padding:14px 18px;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Dein Wunschtermin</p>
              <p style="margin:0;font-size:15px;color:#1C244B;font-weight:600;">${wunschtermin}</p>
            </td>
          </tr>
        </table>
        ` : ""}
        <p style="margin:0 0 24px;">
          Die Probelektion dauert ca. 45 Minuten und gibt dir einen ersten Eindruck davon, wie der Unterricht bei mir läuft.
          Ich freue mich darauf, dich kennenzulernen!
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Liebe Grüsse<br/>David Ramchandani<br/>
          <a href="${APP_URL}" style="color:#6b7280;">privatklavierunterricht.ch</a>
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "anfrage_admin": {
      const vorname = String(payload.vorname ?? "");
      const nachname = String(payload.nachname ?? "");
      const email = String(payload.email ?? "");
      const telefon = payload.telefon ? String(payload.telefon) : null;
      const nachricht = payload.nachricht ? String(payload.nachricht) : null;
      const wunschtermin = payload.wunschtermin ? String(payload.wunschtermin) : null;
      const subject = `Neue Probestunden-Anfrage: ${vorname} ${nachname}`;
      const content = `
        <p style="margin:0 0 16px;">Es liegt eine neue Probestunden-Anfrage vor:</p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:20px;background:#f8f9fa;border-radius:8px;">
          <tr>
            <td style="padding:14px 18px;">
              <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                <tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:13px;width:130px;">Name</td>
                  <td style="padding:4px 0;color:#1f2937;font-size:14px;font-weight:600;">${vorname} ${nachname}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:13px;">E-Mail</td>
                  <td style="padding:4px 0;font-size:14px;"><a href="mailto:${email}" style="color:#1C244B;">${email}</a></td>
                </tr>
                ${telefon ? `<tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:13px;">Telefon</td>
                  <td style="padding:4px 0;color:#1f2937;font-size:14px;">${telefon}</td>
                </tr>` : ""}
                ${wunschtermin ? `<tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:13px;">Wunschtermin</td>
                  <td style="padding:4px 0;color:#1C244B;font-size:14px;font-weight:600;">${wunschtermin}</td>
                </tr>` : ""}
              </table>
            </td>
          </tr>
        </table>
        ${nachricht ? `
        <div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">Nachricht</p>
          <p style="margin:0;color:#1f2937;font-size:14px;">${nachricht}</p>
        </div>
        ` : ""}
        <p style="margin:0 0 24px;">
          <a href="${APP_URL}/admin/anfragen"
             style="display:inline-block;background-color:#1C244B;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
            Anfrage öffnen
          </a>
        </p>
      `;
      return { subject, html: baseWrapper(content) };
    }

    case "package_created": {
      const raten = payload.billing_mode === "raten";
      // Bei „pro Lektion" darf hier keine Rechnung angekündigt werden: Es
      // kommt keine. Der Schüler zahlt nach jeder Lektion einzeln, und die
      // Aufforderung dazu erreicht ihn jeweils nach dem Unterricht.
      const proLektion = payload.billing_mode === "pro_lektion";
      const lektionen = Number(payload.lessons_total ?? 0);
      const chf = (n: unknown) =>
        Number(n ?? 0).toLocaleString("de-CH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      const plan = Array.isArray(payload.plan)
        ? (payload.plan as Array<{ label: string; amount: number; dueDate: string }>)
        : [];

      return {
        subject: raten
          ? `Dein ${payload.package_label ?? "Paket"} ist bereit: Anzahlung offen`
          : `Dein ${payload.package_label ?? "Paket"} ist bereit`,
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>
           <p>Dein <strong>${payload.package_label ?? "Paket"}</strong> mit
              <strong>${lektionen} Lektionen</strong> ist angelegt${
                payload.expires_at
                  ? `, gültig bis <strong>${fmtDate(String(payload.expires_at))}</strong>`
                  : ""
              }.</p>

           ${
             raten
               ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:0 0 24px;">
                    <p style="margin:0 0 8px;font-weight:600;color:#92400e;">Ein Schritt fehlt noch</p>
                    <p style="margin:0;color:#92400e;font-size:14px;">
                      Du hast Ratenzahlung gewählt. Sobald deine Anzahlung von
                      <strong>CHF ${chf(payload.deposit_amount)}</strong> bei mir eingegangen
                      und von mir bestätigt ist, kannst du deine Lektionen buchen.
                      Die Rechnung dazu bekommst du in einer separaten E-Mail.
                    </p>
                  </div>`
               : proLektion
                 ? `<p>Du kannst ab sofort Termine buchen. Bezahlt wird nach
                      jeder Lektion einzeln, du bekommst die Zahlungsaufforderung
                      jeweils im Anschluss. Jetzt ist nichts offen.</p>`
                 : `<p>Du kannst ab sofort Termine buchen, du musst nicht auf den
                      Zahlungseingang warten. Die Rechnung über
                      <strong>CHF ${chf(payload.total_price)}</strong> erhältst du in einer
                      separaten E-Mail, zahlbar innert 15 Tagen.</p>`
           }

           ${
             plan.length > 0
               ? `<p style="margin:0 0 8px;font-weight:600;">Dein Zahlungsplan</p>
                  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background:#f8fafc;border-radius:6px;">
                    ${plan
                      .map(
                        (e) => `<tr>
                          <td style="padding:8px 12px;color:#475569;font-size:14px;">${e.label}</td>
                          <td style="padding:8px 12px;color:#64748b;font-size:13px;">${fmtDate(e.dueDate)}</td>
                          <td style="padding:8px 12px;font-weight:600;font-size:14px;text-align:right;">CHF ${chf(e.amount)}</td>
                        </tr>`
                      )
                      .join("")}
                  </table>`
               : ""
           }

           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal#zahlungen" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">${
               raten ? "Zahlungsplan ansehen" : "Zum Portal"
             }</a>
           </p>
           <p>Liebe Grüsse<br/>David</p>`
        ),
      };
    }

    // ── Abo-Modell ────────────────────────────────────────────────
    case "subscription_renewal_notice": {
      const remaining = Number(payload.lessons_remaining ?? 0);
      return {
        subject: "Dein Abo verlängert sich bald",
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + payload.student_name : ""}</p>
           <p>Dein <strong>${payload.package_label ?? "Paket"}</strong> läuft am
              <strong>${fmtDate(String(payload.expires_at))}</strong> ab und verlängert
              sich danach automatisch um eine neue Laufzeit.</p>
           ${
             remaining > 0
               ? `<p>Du hast noch <strong>${remaining} Lektion${remaining === 1 ? "" : "en"}</strong> offen.
                   Nicht genutzte Lektionen verfallen beim Ablauf, buch dir am besten
                   jetzt noch die restlichen Termine.</p>`
               : ""
           }
           <p>Wenn du nicht verlängern möchtest, kannst du die automatische Verlängerung
              im Portal abschalten, bis 14 Tage vor Ablauf.</p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Zum Portal</a>
           </p>
           <p>Liebe Grüsse<br/>David</p>`
        ),
      };
    }
    case "subscription_renewed": {
      const raten = payload.billing_mode === "raten";
      return {
        subject: "Dein Abo wurde verlängert",
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + payload.student_name : ""}</p>
           <p>Dein <strong>${payload.package_label ?? "Paket"}</strong> wurde automatisch
              verlängert und ist ab sofort wieder buchbar${
                payload.expires_at
                  ? `, gültig bis <strong>${fmtDate(String(payload.expires_at))}</strong>`
                  : ""
              }.</p>
           <p>${
             raten
               ? "Die Anzahlung für die neue Laufzeit erhältst du separat per Rechnung, die weiteren Raten folgen monatlich."
               : "Die Rechnung für die neue Laufzeit erhältst du separat."
           }</p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Termine buchen</a>
           </p>
           <p>Liebe Grüsse<br/>David</p>`
        ),
      };
    }
    case "subscription_expired": {
      const verfallen = Number(payload.lessons_forfeited ?? 0);
      return {
        subject: "Dein Paket ist abgelaufen",
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + payload.student_name : ""}</p>
           <p>Dein <strong>${payload.package_label ?? "Paket"}</strong> ist am
              <strong>${fmtDate(String(payload.expires_at))}</strong> abgelaufen.</p>
           ${
             verfallen > 0
               ? `<p>Dabei sind <strong>${verfallen} nicht genutzte Lektion${verfallen === 1 ? "" : "en"}</strong> verfallen.</p>`
               : ""
           }
           <p>Du kannst jederzeit ein neues Paket lösen, auf Wunsch auch in Monatsraten.</p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Neues Paket wählen</a>
           </p>
           <p>Liebe Grüsse<br/>David</p>`
        ),
      };
    }
    case "subscription_cancelled": {
      return {
        subject: "Automatische Verlängerung beendet",
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + payload.student_name : ""}</p>
           <p>Die automatische Verlängerung für dein
              <strong>${payload.package_label ?? "Paket"}</strong> ist abgeschaltet.</p>
           <p>Dein Paket bleibt bis <strong>${fmtDate(String(payload.expires_at))}</strong>
              wie gewohnt nutzbar. Danach läuft es aus, ohne dass ein neues startet.</p>
           <p>Nicht genutzte Lektionen verfallen beim Ablauf, buch dir also
              rechtzeitig deine restlichen Termine.</p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Termine buchen</a>
           </p>
           <p>Liebe Grüsse<br/>David</p>`
        ),
      };
    }
    case "subscription_renewed_admin": {
      return {
        subject: `Abo verlängert: ${payload.student_name ?? "Schüler"}`,
        html: baseWrapper(
          `<p><strong>${payload.student_name ?? "Ein Schüler"}</strong> hat ein automatisch
              verlängertes <strong>${payload.package_label ?? "Paket"}</strong>.</p>
           <p>Zahlungsart: ${payload.billing_mode === "raten" ? "Monatsraten" : "Einmalzahlung"}<br/>
              Gültig bis: ${payload.expires_at ? fmtDate(String(payload.expires_at)) : "–"}</p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/admin/schueler" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Im Admin öffnen</a>
           </p>`
        ),
      };
    }
    case "subscription_cancelled_admin": {
      return {
        subject: `Abo gekündigt: ${payload.student_name ?? "Schüler"}`,
        html: baseWrapper(
          `<p><strong>${payload.student_name ?? "Ein Schüler"}</strong> hat die automatische
              Verlängerung für das <strong>${payload.package_label ?? "Paket"}</strong>
              abgeschaltet.</p>
           <p>Das Paket läuft am
              ${payload.expires_at ? fmtDate(String(payload.expires_at)) : "Ende der Laufzeit"}
              aus und wird nicht erneuert.</p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/admin/schueler" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Im Admin öffnen</a>
           </p>`
        ),
      };
    }

    // ── Fixplatz ─────────────────────────────────────────────
    case "fixplatz_confirmed": {
      const termine = Array.isArray(payload.termine)
        ? (payload.termine as string[])
        : [];
      const verschoben = Array.isArray(payload.verschoben)
        ? (payload.verschoben as Array<{ original: string; ersatz: string }>)
        : [];
      const offen = Array.isArray(payload.offen) ? (payload.offen as string[]) : [];

      return {
        subject: `Dein fester Platz steht: ${payload.fixplatz_text ?? "Fixplatz"}`,
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>
           <p>Dein fester Unterrichtsplatz ist eingerichtet:</p>

           <div style="background:#F3F5F8;border-radius:8px;padding:16px;margin:0 0 24px;">
             <p style="margin:0;font-size:16px;font-weight:600;color:#1C244B;">
               ${payload.fixplatz_text ?? ""}
             </p>
             <p style="margin:8px 0 0;color:#475569;font-size:14px;">
               ${termine.length} Termine sind bereits eingetragen, du musst nichts
               mehr einzeln buchen.
             </p>
           </div>

           ${
             verschoben.length > 0
               ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:0 0 24px;">
                    <p style="margin:0 0 8px;font-weight:600;color:#92400e;">Ein paar Ausweichtermine</p>
                    <p style="margin:0 0 8px;color:#92400e;font-size:14px;">
                      An diesen Tagen war dein Platz belegt (Ferien oder Feiertag).
                      Ich habe dir einen Ersatz in derselben oder der folgenden Woche
                      gelegt:
                    </p>
                    <ul style="margin:0;padding-left:20px;color:#92400e;font-size:14px;">
                      ${verschoben
                        .map(
                          (v) =>
                            `<li>statt ${fmtDate(v.original)} → <strong>${fmtDateTime(v.ersatz)}</strong></li>`
                        )
                        .join("")}
                    </ul>
                  </div>`
               : ""
           }

           ${
             offen.length > 0
               ? `<p><strong>${offen.length} Lektion${offen.length === 1 ? "" : "en"}</strong>
                    konnte ich noch nicht platzieren. Ich melde mich dazu bei dir,
                    die Lektionen sind dir gutgeschrieben und verfallen nicht.</p>`
               : ""
           }

           <p style="margin:24px 0 8px;font-weight:600;">Deine Termine</p>
           <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background:#f8fafc;border-radius:6px;">
             ${termine
               .map(
                 (t, i) => `<tr>
                   <td style="padding:6px 12px;color:#94a3b8;font-size:13px;width:32px;">${i + 1}.</td>
                   <td style="padding:6px 12px;color:#334155;font-size:14px;">${fmtDateTime(t)}</td>
                 </tr>`
               )
               .join("")}
           </table>

           <p style="color:#64748b;font-size:14px;">
             Wenn du einmal nicht kannst: bitte spätestens 24 Stunden vorher im
             Portal absagen. Du bekommst dann automatisch Ausweichtermine
             vorgeschlagen.
           </p>

           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal#termine" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Termine ansehen</a>
           </p>`
        ),
      };
    }

    case "fixplatz_admin": {
      return {
        subject: `Neuer Fixplatz: ${payload.student_name ?? "Schüler"}`,
        html: baseWrapper(
          `<p><strong>${payload.student_name ?? "Ein Schüler"}</strong> hat einen festen
              Platz gebucht:</p>
           <p style="font-size:16px;font-weight:600;color:#1C244B;">
             ${payload.fixplatz_text ?? ""}
           </p>
           <p>${payload.anzahl_termine ?? 0} Termine angelegt${
             payload.anzahl_verschoben
               ? `, davon ${payload.anzahl_verschoben} als Ausweichtermin`
               : ""
           }${
             payload.anzahl_offen
               ? `. ${payload.anzahl_offen} Lektion(en) konnten nicht platziert werden und brauchen deine Hand.`
               : "."
           }</p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/admin/kalender" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Kalender öffnen</a>
           </p>`
        ),
      };
    }

    // ── Ausfälle ─────────────────────────────────────────────
    case "ausfall_ersatz_vorschlag": {
      const vorschlaege = Array.isArray(payload.vorschlaege)
        ? (payload.vorschlaege as Array<{ start: string; begruendung: string }>)
        : [];
      return {
        subject: payload.original_datum
          ? `Ausweichtermine für deine Lektion vom ${fmtDate(String(payload.original_datum))}`
          : "Ausweichtermine für deine ausgefallene Lektion",
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>
           <p>Deine Lektion vom
              <strong>${payload.original_datum ? fmtDateTime(String(payload.original_datum)) : ""}</strong>
              fällt aus${payload.grund ? ` (${payload.grund})` : ""}.</p>

           <p><strong>Die Lektion ist dir erhalten</strong>, sie wird nicht abgezogen.
              Such dir einen der folgenden Ausweichtermine aus:</p>

           <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background:#f8fafc;border-radius:6px;">
             ${vorschlaege
               .map(
                 (v) => `<tr>
                   <td style="padding:10px 12px;color:#1C244B;font-size:14px;font-weight:600;">${fmtDateTime(v.start)}</td>
                   <td style="padding:10px 12px;color:#64748b;font-size:13px;">${v.begruendung}</td>
                 </tr>`
               )
               .join("")}
           </table>

           <p style="color:#64748b;font-size:14px;">
             Passt keiner davon? Dann verlängert sich stattdessen die Laufzeit deines
             Pakets um die entsprechende Zeit, du verlierst nichts.
           </p>

           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal#termine" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Ausweichtermin wählen</a>
           </p>`
        ),
      };
    }

    case "ausfall_gutschrift": {
      return {
        subject: "Deine Laufzeit wurde verlängert",
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>
           <p>Für die ausgefallene Lektion vom
              <strong>${payload.original_datum ? fmtDate(String(payload.original_datum)) : ""}</strong>
              liess sich kein Ausweichtermin finden.</p>

           <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin:0 0 24px;">
             <p style="margin:0;color:#065f46;font-size:14px;">
               Die Lektion bleibt dir erhalten und die Laufzeit deines Pakets
               verlängert sich um <strong>${payload.tage ?? 0} Tage</strong>${
                 payload.neues_ablaufdatum
                   ? `, neu gültig bis <strong>${fmtDate(String(payload.neues_ablaufdatum))}</strong>`
                   : ""
               }.
             </p>
           </div>

           <p>Beim nächsten Mal kannst du sie ganz normal buchen.</p>

           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Zum Portal</a>
           </p>`
        ),
      };
    }

    case "ausfall_kurzfristig": {
      return {
        subject: `Absage erhalten: ${payload.original_datum ? fmtDate(String(payload.original_datum)) : ""}`,
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>
           <p>Deine Absage für den
              <strong>${payload.original_datum ? fmtDateTime(String(payload.original_datum)) : ""}</strong>
              ist bei mir angekommen.</p>

           <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:0 0 24px;">
             <p style="margin:0;color:#92400e;font-size:14px;">
               Weil die Absage weniger als 24 Stunden vorher kam, gilt die Lektion
               als gehalten, die Zeit war für dich reserviert und liess sich nicht
               mehr anderweitig vergeben.
             </p>
           </div>

           <p style="color:#64748b;font-size:14px;">
             Wenn etwas Aussergewöhnliches dazwischenkam, melde dich einfach bei mir.
           </p>

           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal#termine" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Zu meinen Terminen</a>
           </p>`
        ),
      };
    }

    case "ausfall_admin": {
      return {
        subject: `Absage: ${payload.student_name ?? "Schüler"} – ${payload.original_datum ? fmtDate(String(payload.original_datum)) : ""}`,
        html: baseWrapper(
          `<p><strong>${payload.student_name ?? "Ein Schüler"}</strong> hat die Lektion vom
              <strong>${payload.original_datum ? fmtDateTime(String(payload.original_datum)) : ""}</strong>
              abgesagt${payload.grund ? `: „${payload.grund}“` : "."}</p>
           <p>${
             payload.kurzfristig
               ? "Kurzfristig (unter 24 Stunden), die Lektion gilt als gehalten."
               : "Rechtzeitig abgesagt, der Schüler hat Ausweichtermine vorgeschlagen bekommen."
           }</p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/admin/kalender" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Kalender öffnen</a>
           </p>`
        ),
      };
    }

    // ── Rhythmuswechsel ──────────────────────────────────────
    case "rhythmus_changed": {
      const laenger = Number(payload.differenz_tage ?? 0) > 0;
      const tage = Math.abs(Number(payload.differenz_tage ?? 0));
      return {
        subject: `Dein Rhythmus ist jetzt ${payload.neuer_rhythmus_text ?? "geändert"}`,
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>
           <p>Dein Unterrichtsrhythmus wurde von
              <strong>${payload.alter_rhythmus_text ?? ""}</strong> auf
              <strong>${payload.neuer_rhythmus_text ?? ""}</strong> umgestellt.</p>

           <div style="background:#F3F5F8;border-radius:8px;padding:16px;margin:0 0 24px;">
             <p style="margin:0 0 6px;color:#475569;font-size:14px;">
               <strong>${payload.lektionen_offen ?? 0}</strong> Lektionen sind noch offen.
             </p>
             <p style="margin:0;color:#475569;font-size:14px;">
               Neu gültig bis
               <strong>${payload.neues_ablaufdatum ? fmtDate(String(payload.neues_ablaufdatum)) : ""}</strong>
               ${
                 tage === 0
                   ? "(unverändert)"
                   : laenger
                     ? `(${tage} Tage länger)`
                     : `(${tage} Tage kürzer)`
               }.
             </p>
           </div>

           <p style="color:#64748b;font-size:14px;">
             Der Preis bleibt gleich, gleiche Lektionszahl, gleicher Lektionspreis.
             Der Rhythmus ändert nur, über welchen Zeitraum du sie beziehst.
             ${
               payload.raten_angepasst
                 ? " Deine offenen Raten wurden entsprechend neu verteilt; der Gesamtbetrag bleibt unverändert."
                 : ""
             }
           </p>

           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Zum Portal</a>
           </p>`
        ),
      };
    }

    // ── Abo ──────────────────────────────────────────────────
    case "abo_gestartet": {
      const chf = (n: unknown) =>
        Number(n ?? 0).toLocaleString("de-CH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      const termine = Array.isArray(payload.termine)
        ? (payload.termine as string[])
        : [];
      const ferientage = Array.isArray(payload.ferientage)
        ? (payload.ferientage as { tag: string; grund: string }[])
        : [];

      return {
        subject: `Dein ${payload.abo_label ?? "Abo"} läuft`,
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>
           <p>Dein <strong>${payload.abo_label ?? "Abo"}</strong> ist eingerichtet.
              Hier steht alles Wichtige auf einen Blick:</p>

           <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;background:#F3F5F8;border-radius:8px;">
             <tr>
               <td style="padding:12px 16px;color:#64748b;font-size:14px;">Laufzeit</td>
               <td style="padding:12px 16px;color:#1C244B;font-size:14px;font-weight:600;text-align:right;">
                 ${payload.periode_start ? fmtDate(String(payload.periode_start)) : ""},
                 ${payload.periode_ende ? fmtDate(String(payload.periode_ende)) : ""}
               </td>
             </tr>
             <tr>
               <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Unterricht</td>
               <td style="padding:12px 16px;color:#1C244B;font-size:14px;font-weight:600;text-align:right;border-top:1px solid #e2e8f0;">
                 ${payload.fixplatz_text ?? payload.rhythmus_text ?? ""}
               </td>
             </tr>
             <tr>
               <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Lektionen</td>
               <td style="padding:12px 16px;color:#1C244B;font-size:14px;font-weight:600;text-align:right;border-top:1px solid #e2e8f0;">
                 ${payload.lektionen ?? 0}
               </td>
             </tr>
             <tr>
               <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Pro Monat</td>
               <td style="padding:12px 16px;color:#1C244B;font-size:16px;font-weight:700;text-align:right;border-top:1px solid #e2e8f0;">
                 CHF ${chf(payload.monatsbetrag)}
               </td>
             </tr>
           </table>

           <p>Der Monatsbetrag bleibt über die ganze Laufzeit gleich, auch in
              Monaten mit mehr oder weniger Lektionen. Insgesamt sind es
              <strong>${payload.lektionen ?? 0} Lektionen</strong> über
              ${payload.laufzeit_monate ?? 0} Monate.</p>

           ${
             payload.termin_offen
               ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:0 0 24px;">
                    <p style="margin:0 0 8px;font-weight:600;color:#92400e;">Dein Termin folgt</p>
                    <p style="margin:0;color:#92400e;font-size:14px;">
                      Ich lege die Termine aller Schüler gemeinsam fest, damit die
                      Fahrwege aufgehen. Sobald dein fester Platz steht, bekommst du
                      ihn per E-Mail, mit allen Daten der ganzen Laufzeit.
                    </p>
                  </div>`
               : ""
           }

           ${
             ferientage.length > 0
               ? `<div style="background:#F3F5F8;border-radius:8px;padding:16px;margin:0 0 24px;">
                    <p style="margin:0 0 8px;font-weight:600;color:#1C244B;font-size:14px;">
                      In den Ferien findet kein Unterricht statt
                    </p>
                    <p style="margin:0 0 8px;color:#475569;font-size:14px;">
                      Diese Termine sind <strong>bereits eingerechnet</strong>, du
                      zahlst nichts dafür und verlierst nichts:
                    </p>
                    <ul style="margin:0;padding-left:20px;color:#475569;font-size:14px;">
                      ${ferientage
                        .map((f) => `<li>${fmtDate(f.tag)} · ${f.grund}</li>`)
                        .join("")}
                    </ul>
                  </div>`
               : ""
           }

           ${
             termine.length > 0
               ? `<p style="margin:0 0 8px;font-weight:600;">Deine Termine</p>
                  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;background:#f8fafc;border-radius:6px;">
                    ${termine
                      .map(
                        (t, i) => `<tr>
                          <td style="padding:6px 12px;color:#94a3b8;font-size:13px;width:32px;">${i + 1}.</td>
                          <td style="padding:6px 12px;color:#334155;font-size:14px;">${fmtDate(t)}</td>
                        </tr>`
                      )
                      .join("")}
                  </table>`
               : ""
           }

           <p style="color:#64748b;font-size:14px;">
             ${
               payload.auto_renew
                 ? "Dein Abo verlängert sich am Ende der Laufzeit automatisch um dieselbe Dauer. Kündbar bis 30 Tage vorher, jederzeit im Portal."
                 : "Dein Abo endet am Ende der Laufzeit. Wenn du weitermachen möchtest, kannst du es im Portal verlängern."
             }
           </p>
           <p style="color:#64748b;font-size:14px;">
             Wenn du einmal nicht kannst: bitte spätestens 24 Stunden vorher im
             Portal absagen. Du bekommst dann Ausweichtermine vorgeschlagen.
           </p>

           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Zum Portal</a>
           </p>`
        ),
      };
    }

    case "abo_gestartet_admin": {
      const chf = (n: unknown) =>
        Number(n ?? 0).toLocaleString("de-CH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      return {
        subject: `Neues Abo: ${payload.student_name ?? "Schüler"}`,
        html: baseWrapper(
          `<p><strong>${payload.student_name ?? "Ein Schüler"}</strong> hat ein
              <strong>${payload.abo_label ?? "Abo"}</strong> abgeschlossen.</p>
           <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;background:#F3F5F8;border-radius:8px;">
             <tr>
               <td style="padding:10px 16px;color:#64748b;font-size:14px;">Unterricht</td>
               <td style="padding:10px 16px;color:#1C244B;font-size:14px;font-weight:600;text-align:right;">${payload.fixplatz_text ?? payload.rhythmus_text ?? ""}</td>
             </tr>
             <tr>
               <td style="padding:10px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Laufzeit</td>
               <td style="padding:10px 16px;color:#1C244B;font-size:14px;font-weight:600;text-align:right;border-top:1px solid #e2e8f0;">
                 ${payload.periode_start ? fmtDate(String(payload.periode_start)) : ""},
                 ${payload.periode_ende ? fmtDate(String(payload.periode_ende)) : ""}
               </td>
             </tr>
             <tr>
               <td style="padding:10px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Lektionen</td>
               <td style="padding:10px 16px;color:#1C244B;font-size:14px;font-weight:600;text-align:right;border-top:1px solid #e2e8f0;">${payload.lektionen ?? 0}</td>
             </tr>
             <tr>
               <td style="padding:10px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Pro Monat / Total</td>
               <td style="padding:10px 16px;color:#1C244B;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e2e8f0;">
                 CHF ${chf(payload.monatsbetrag)} / CHF ${chf(payload.gesamtpreis)}
               </td>
             </tr>
           </table>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/admin/schueler" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Im Admin öffnen</a>
           </p>`
        ),
      };
    }

    case "abo_verlaengert": {
      const chf = (n: unknown) =>
        Number(n ?? 0).toLocaleString("de-CH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      const ferientage = Array.isArray(payload.ferientage)
        ? (payload.ferientage as { tag: string; grund: string }[])
        : [];

      // Die neue Periode kann eine andere Lektionszahl haben, im Sommer
      // liegen mehr Ferien als im Winter. Das wird offen benannt, statt es
      // in einer geänderten Zahl zu verstecken.
      const vorherLekt = Number(payload.vorher_lektionen ?? 0);
      const jetztLekt = Number(payload.lektionen ?? 0);
      const anders = vorherLekt > 0 && vorherLekt !== jetztLekt;

      return {
        subject: `Dein ${payload.abo_label ?? "Abo"} geht weiter`,
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>
           <p>Dein <strong>${payload.abo_label ?? "Abo"}</strong> hat sich wie
              vereinbart verlängert. Dein fester Platz bleibt derselbe.</p>

           <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;background:#F3F5F8;border-radius:8px;">
             <tr>
               <td style="padding:12px 16px;color:#64748b;font-size:14px;">Neue Laufzeit</td>
               <td style="padding:12px 16px;color:#1C244B;font-size:14px;font-weight:600;text-align:right;">
                 ${payload.periode_start ? fmtDate(String(payload.periode_start)) : ""},
                 ${payload.periode_ende ? fmtDate(String(payload.periode_ende)) : ""}
               </td>
             </tr>
             <tr>
               <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Lektionen</td>
               <td style="padding:12px 16px;color:#1C244B;font-size:14px;font-weight:600;text-align:right;border-top:1px solid #e2e8f0;">${jetztLekt}</td>
             </tr>
             <tr>
               <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Pro Monat</td>
               <td style="padding:12px 16px;color:#1C244B;font-size:16px;font-weight:700;text-align:right;border-top:1px solid #e2e8f0;">CHF ${chf(payload.monatsbetrag)}</td>
             </tr>
           </table>

           ${
             anders
               ? `<div style="background:#F3F5F8;border-radius:8px;padding:16px;margin:0 0 24px;">
                    <p style="margin:0;color:#475569;font-size:14px;">
                      Diese Periode enthält <strong>${jetztLekt} statt ${vorherLekt} Lektionen</strong>
                      ${
                        jetztLekt < vorherLekt
                          ? ", in diesem Zeitraum liegen mehr Ferien"
                          : ", in diesem Zeitraum liegen weniger Ferien"
                      }.
                      Der Monatsbetrag ist entsprechend angepasst; der Preis pro
                      Lektion bleibt unverändert.
                    </p>
                  </div>`
               : ""
           }

           ${
             ferientage.length > 0
               ? `<p style="margin:0 0 8px;font-weight:600;">Unterrichtsfrei in dieser Periode</p>
                  <ul style="margin:0 0 24px;padding-left:20px;color:#475569;font-size:14px;">
                    ${ferientage
                      .map((f) => `<li>${fmtDate(f.tag)} · ${f.grund}</li>`)
                      .join("")}
                  </ul>`
               : ""
           }

           <p style="color:#64748b;font-size:14px;">
             Wenn du nicht weitermachen möchtest, kannst du die Verlängerung
             jederzeit im Portal abschalten, spätestens 30 Tage vor Ablauf der
             laufenden Periode.
           </p>

           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Zum Portal</a>
           </p>`
        ),
      };
    }

    case "abo_verlaengert_admin": {
      const chf = (n: unknown) =>
        Number(n ?? 0).toLocaleString("de-CH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      return {
        subject: `Abo verlängert: ${payload.student_name ?? "Schüler"}`,
        html: baseWrapper(
          `<p>Das <strong>${payload.abo_label ?? "Abo"}</strong> von
              <strong>${payload.student_name ?? "einem Schüler"}</strong> hat sich
              verlängert.</p>
           <p>Neue Periode
              ${payload.periode_start ? fmtDate(String(payload.periode_start)) : ""},
              ${payload.periode_ende ? fmtDate(String(payload.periode_ende)) : ""}
              mit <strong>${payload.lektionen ?? 0} Lektionen</strong> zu
              CHF ${chf(payload.monatsbetrag)} pro Monat. Die Terminserie ist
              bereits eingetragen.</p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/admin/kalender" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Kalender öffnen</a>
           </p>`
        ),
      };
    }

    case "abo_beendet": {
      const chf = (n: unknown) =>
        Number(n ?? 0).toLocaleString("de-CH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      const nachzahlung = Number(payload.nachzahlung ?? 0);
      const rueckerstattung = Number(payload.rueckerstattung ?? 0);

      return {
        subject: "Dein Abo wurde beendet",
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>
           <p>Dein Abo ist zum heutigen Tag beendet${
             payload.grund ? ` (${payload.grund})` : ""
           }.</p>

           <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;background:#F3F5F8;border-radius:8px;">
             <tr>
               <td style="padding:10px 16px;color:#64748b;font-size:14px;">Angefangene Monate</td>
               <td style="padding:10px 16px;color:#1C244B;font-size:14px;font-weight:600;text-align:right;">${payload.monate_begonnen ?? 0}</td>
             </tr>
             <tr>
               <td style="padding:10px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Dafür geschuldet</td>
               <td style="padding:10px 16px;color:#1C244B;font-size:14px;font-weight:600;text-align:right;border-top:1px solid #e2e8f0;">CHF ${chf(payload.geschuldet)}</td>
             </tr>
             <tr>
               <td style="padding:10px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Bereits bezahlt</td>
               <td style="padding:10px 16px;color:#1C244B;font-size:14px;font-weight:600;text-align:right;border-top:1px solid #e2e8f0;">CHF ${chf(payload.bereits_bezahlt)}</td>
             </tr>
           </table>

           <p style="color:#475569;font-size:14px;">
             Angefangene Monate werden voll verrechnet, in diesen Monaten hat
             Unterricht stattgefunden und dein Platz war reserviert. Die
             restlichen ${payload.monate_offen ?? 0} Monate entfallen.
           </p>

           ${
             nachzahlung > 0
               ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:0 0 24px;">
                    <p style="margin:0;color:#92400e;font-size:14px;">
                      Offen bleibt eine Restzahlung von
                      <strong>CHF ${chf(nachzahlung)}</strong>. Die Rechnung dazu
                      bekommst du separat.
                    </p>
                  </div>`
               : ""
           }
           ${
             rueckerstattung > 0
               ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin:0 0 24px;">
                    <p style="margin:0;color:#065f46;font-size:14px;">
                      Du bekommst <strong>CHF ${chf(rueckerstattung)}</strong>
                      zurück. Ich melde mich für die Auszahlung bei dir.
                    </p>
                  </div>`
               : ""
           }
           ${
             nachzahlung === 0 && rueckerstattung === 0
               ? `<p style="color:#475569;font-size:14px;">Es ist nichts mehr offen.</p>`
               : ""
           }

           <p style="color:#64748b;font-size:14px;">
             ${payload.stornierte_termine ?? 0} zukünftige Termine wurden
             abgesagt. Wenn du später wieder einsteigen möchtest, melde dich
             jederzeit.
           </p>`
        ),
      };
    }

    case "abo_endet_bald": {
      return {
        subject: `Dein ${payload.package_label ?? "Abo"} endet bald`,
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>
           <p>Dein <strong>${payload.package_label ?? "Abo"}</strong> endet am
              <strong>${
                payload.periode_ende
                  ? fmtDate(String(payload.periode_ende))
                  : payload.expires_at
                    ? fmtDate(String(payload.expires_at))
                    : ""
              }</strong>.</p>

           <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:0 0 24px;">
             <p style="margin:0;color:#92400e;font-size:14px;">
               Du hast die automatische Verlängerung abgeschaltet. Danach ist
               dein fester Platz wieder frei, falls du weitermachen möchtest,
               melde dich bitte vorher bei mir oder schalte die Verlängerung im
               Portal wieder ein.
             </p>
           </div>

           <p style="color:#64748b;font-size:14px;">
             Solltest du bewusst aufhören wollen: alles gut, dann musst du
             nichts tun. Die Termine bis zum Ende der Laufzeit bleiben natürlich
             bestehen.
           </p>

           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Zum Portal</a>
           </p>`
        ),
      };
    }

    // ── Terminplanung ────────────────────────────────────────
    case "verfuegbarkeit_anfrage":
    case "verfuegbarkeit_erinnerung": {
      const erinnerung = type === "verfuegbarkeit_erinnerung";
      return {
        subject: erinnerung
          ? "Erinnerung: Wann kannst du?"
          : "Wann kannst du? Bitte kurz eintragen",
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>

           ${
             erinnerung
               ? `<p>Von dir fehlen noch die Zeiten für <strong>${payload.titel ?? "die kommende Planung"}</strong>.
                    Ohne sie kann ich dir keinen Termin zuteilen.</p>`
               : `<p>Ich plane gerade <strong>${payload.titel ?? "die kommende Periode"}</strong>
                    und brauche von dir, wann du kannst.</p>`
           }

           <div style="background:#F3F5F8;border-radius:8px;padding:16px;margin:0 0 24px;">
             <p style="margin:0 0 8px;color:#1C244B;font-size:14px;font-weight:600;">
               Bitte bis ${payload.frist ? fmtDate(String(payload.frist)) : ""} eintragen
             </p>
             <p style="margin:0;color:#475569;font-size:14px;">
               Es dauert eine Minute: Tage antippen, Zeitspanne wählen, fertig.
             </p>
           </div>

           <p><strong>Warum ich frage:</strong> Ich fahre zu allen Schülern und
              lege die Termine so, dass möglichst wenig Leerfahrt entsteht. Wenn
              ich von allen weiss, wann sie können, finde ich eine Reihenfolge,
              die für alle passt, statt dass der Schnellste den besten Platz
              bekommt.</p>

           <p style="color:#64748b;font-size:14px;">
             Gib gern <strong>mehrere</strong> Zeitfenster an. Je mehr Auswahl,
             desto eher bekommst du eine Zeit, die dir wirklich passt. Deine
             Wunschzeit kannst du markieren.
           </p>

           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Zeiten eintragen</a>
           </p>`
        ),
      };
    }

    case "verfuegbarkeit_einzelanfrage": {
      return {
        subject: "Wann kannst du? Dein fester Termin wartet",
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>

           <p>Dein Abo läuft, aber dein fester Termin steht noch aus. Damit ich
              ihn setzen kann, brauche ich von dir, wann du kannst.</p>

           <div style="background:#F3F5F8;border-radius:8px;padding:16px;margin:0 0 24px;">
             <p style="margin:0 0 8px;color:#1C244B;font-size:14px;font-weight:600;">
               Bitte bis ${payload.frist ? fmtDate(String(payload.frist)) : ""} eintragen
             </p>
             <p style="margin:0;color:#475569;font-size:14px;">
               Es dauert eine Minute: Tage antippen, Zeitspanne wählen, fertig.
             </p>
           </div>

           <p><strong>Warum ich frage:</strong> Ich fahre zu allen Schülern.
              Wenn ich weiss, wann du kannst, finde ich einen Platz, der auf
              einer Strecke liegt, die ich ohnehin fahre. Das ist für dich die
              beste Zeit und für mich die kürzeste Fahrt.</p>

           <p style="color:#64748b;font-size:14px;">
             Gib gern <strong>mehrere</strong> Zeitfenster an. Je mehr Auswahl,
             desto eher bekommst du eine Zeit, die dir wirklich passt. Deine
             Wunschzeit kannst du markieren.
           </p>

           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Zeiten eintragen</a>
           </p>`
        ),
      };
    }

    case "verfuegbarkeit_zuteilung": {
      return {
        subject: `Dein Termin steht: ${payload.fixplatz_text ?? ""}`,
        html: baseWrapper(
          `<p>Hallo${payload.student_name ? " " + String(payload.student_name).split(" ")[0] : ""}</p>
           <p>Danke fürs Eintragen deiner Zeiten. Dein fester Termin steht:</p>

           <div style="background:#F3F5F8;border-radius:8px;padding:16px;margin:0 0 24px;">
             <p style="margin:0;font-size:16px;font-weight:600;color:#1C244B;">
               ${payload.fixplatz_text ?? ""}
             </p>
             <p style="margin:8px 0 0;color:#475569;font-size:14px;">
               ${payload.anzahl_termine ?? 0} Termine sind eingetragen, du musst
               nichts mehr einzeln buchen.
             </p>
           </div>

           ${
             payload.wunsch_erfuellt
               ? `<p style="color:#065f46;font-size:14px;">Das ist die Zeit, die du als
                    Wunschtermin markiert hattest.</p>`
               : `<p style="color:#64748b;font-size:14px;">Deine Wunschzeit liess sich
                    diesmal nicht mit allen anderen Terminen vereinbaren, dieser Platz
                    war der beste, der für alle aufging. Wenn er gar nicht passt, melde
                    dich bitte, dann schauen wir nochmals.</p>`
           }

           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/schueler/portal#termine" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Termine ansehen</a>
           </p>`
        ),
      };
    }

    // ── Bewertungen ────────────────────────────────────────────────
    //
    // Die Bitte um eine Bewertung ist heikel: Sie kann leicht wie eine
    // Forderung klingen, und dann schreibt jemand aus Pflichtgefuehl etwas
    // Hoefliches. Deshalb steht ausdruecklich drin, dass Sterne genuegen
    // und dass ein Nein in Ordnung ist. Wer sich frei fuehlt, schreibt
    // ehrlicher, und ehrlich ist das, was auf der Seite wirkt.
    case "bewertung_anfrage": {
      const vorname = String(payload.vorname ?? "");
      const link = String(payload.link ?? APP_URL);
      const google = String(payload.google_link ?? GOOGLE_BEWERTEN_URL);
      return {
        subject: "Magst du kurz etwas zum Unterricht sagen?",
        html: baseWrapper(
          `<p style="margin:0 0 16px;">Hallo ${vorname},</p>
           <p style="margin:0 0 16px;">
             wenn dir der Unterricht gefaellt, wuerde mir eine kurze Bewertung sehr helfen.
             Die meisten, die bei mir anfragen, schauen zuerst, was andere schreiben.
           </p>
           <p style="margin:0 0 24px;">
             Ein paar Sterne genuegen. Wenn du magst, schreib zwei Saetze dazu, das dauert keine Minute.
           </p>
           <p style="text-align:center;margin:28px 0 12px;">
             <a href="${google}" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Bei Google bewerten</a>
           </p>
           <p style="text-align:center;margin:0 0 28px;font-size:13px;color:#6b7280;">
             Kein Google-Konto oder lieber nicht oeffentlich?
             <a href="${link}" style="color:#1C244B;">Dann hier direkt bei mir</a>.
           </p>
           <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">
             Und wenn dir gerade nicht danach ist: auch voellig in Ordnung, ignorier die Mail einfach.
             Auf den Unterricht hat das keinen Einfluss.
           </p>
           <p style="margin:0;color:#6b7280;font-size:13px;">
             Liebe Gruesse<br/>David Ramchandani<br/>
             <a href="${APP_URL}" style="color:#6b7280;">privatklavierunterricht.ch</a>
           </p>`
        ),
      };
    }

    case "bewertung_eingegangen": {
      const sterne = Number(payload.sterne ?? 0);
      const text = payload.text ? String(payload.text) : null;
      return {
        subject: `Neue Bewertung: ${sterne} von 5 Sternen von ${payload.name ?? "jemandem"}`,
        html: baseWrapper(
          `<p style="margin:0 0 16px;">
             <strong>${payload.name ?? "Jemand"}</strong> hat eine Bewertung abgegeben:
             <strong>${sterne} von 5 Sternen</strong>.
           </p>
           ${
             text
               ? `<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:20px;background:#f8f9fa;border-radius:8px;">
                    <tr><td style="padding:14px 18px;font-size:15px;color:#1f2937;line-height:1.7;">${text}</td></tr>
                  </table>`
               : `<p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Ohne Text, nur die Sterne.</p>`
           }
           <p style="margin:0 0 24px;">
             Sie steht noch nicht auf der Website. Erst nach deiner Freigabe.
           </p>
           <p style="text-align:center;margin:28px 0;">
             <a href="${APP_URL}/admin/bewertungen" style="display:inline-block;background:#1C244B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">Bewertung ansehen</a>
           </p>`
        ),
      };
    }

    default:
      return null;
  }
}
