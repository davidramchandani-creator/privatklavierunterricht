/**
 * Google Calendar One-Way-Sync (System → Google), Spec §8.
 *
 * Authentifizierung über Service-Account (JWT RS256), kein OAuth-User-Flow.
 * Reine Server-Logik: Service-Account-JSON aus env, niemals im Client.
 */

import { createSign } from "crypto";
import { leitTermin } from "./gruppen";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ladeStudioAdresse, unterrichtsort } from "./studio";

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? "primary";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

/** Liest und parst das Service-Account-JSON aus der Umgebung. */
function getServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    // Falls private_key escaped \n enthält (häufig in env-Variablen)
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
  } catch {
    return null;
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Token-Cache (Modul-Ebene, ~55 Min gültig)
let cachedToken: { token: string; expiresAt: number } | null = null;

/** Holt ein Access-Token via Service-Account-JWT (mit Cache). */
async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const sa = getServiceAccount();
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claim)
  )}`;

  let signature: string;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(signingInput);
    signer.end();
    signature = base64url(signer.sign(sa.private_key));
  } catch (err) {
    console.error("Google JWT signing failed:", err);
    return null;
  }

  const jwt = `${signingInput}.${signature}`;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    if (!res.ok) {
      console.error("Google token request failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return data.access_token;
  } catch (err) {
    console.error("Google token request error:", err);
    return null;
  }
}

/** Ob der Sync grundsätzlich konfiguriert ist. */
export function isCalendarConfigured(): boolean {
  return getServiceAccount() !== null;
}

type AppointmentForSync = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  notes: string | null;
  google_event_id: string | null;
  /** Feste Gruppe, falls der Termin zu einer gehört. */
  gruppe_id: string | null;
  student: {
    vorname: string | null;
    nachname: string | null;
    email: string | null;
    adresse: string | null;
    hausbesuch: boolean | null;
  } | null;
  /** Volle Studioadresse, für Schüler, die zu David kommen. */
  studioAdresse: string;
  /** Davids eigener Termin? Nur diese landen in seinem Google-Kalender. */
  vonDavid: boolean;
};

// Farben je Status (Google colorId 1–11)
const COLOR_BY_STATUS: Record<string, string> = {
  booked: "9", // Blaubeere
  completed: "10", // Basilikum (grün)
  pending: "5", // Banane (gelb)
  no_show: "11", // Tomate (rot)
  cancelled: "8", // Graphit
};

function buildEventBody(
  appt: AppointmentForSync,
  /** Gruppenlektion: ein Event für alle, die kommen. */
  gruppe?: { name: string; mitglieder: string[] }
) {
  const name = appt.student
    ? `${appt.student.vorname ?? ""} ${appt.student.nachname ?? ""}`.trim()
    : "Schüler";
  // Kommt der Schüler zu David, steht das Studio da, sonst seine Adresse.
  const location =
    (appt.student ? unterrichtsort(appt.student, appt.studioAdresse) : null) ??
    `Hausbesuch, ${name}`;

  const descriptionParts = [
    gruppe ? `Gruppe: ${gruppe.mitglieder.join(", ")}` : `Schüler/in: ${name}`,
    appt.student?.email ? `E-Mail: ${appt.student.email}` : null,
    `Status: ${appt.status}`,
    appt.notes ? `Notiz: ${appt.notes}` : null,
  ].filter(Boolean);

  return {
    summary: gruppe ? `Gruppenunterricht, ${gruppe.name}` : `Klavierunterricht, ${name}`,
    location,
    description: descriptionParts.join("\n"),
    start: { dateTime: appt.start_at, timeZone: "Europe/Zurich" },
    end: { dateTime: appt.end_at, timeZone: "Europe/Zurich" },
    colorId: COLOR_BY_STATUS[appt.status] ?? "9",
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 30 }],
    },
  };
}

async function fetchAppointment(
  admin: SupabaseClient,
  appointmentId: string
): Promise<AppointmentForSync | null> {
  const { data } = await admin
    .from("appointments")
    .select(
      "id, start_at, end_at, status, notes, google_event_id, gruppe_id, student:profiles!student_id(vorname, nachname, email, adresse, hausbesuch), lehrperson:teachers!teacher_id(ist_inhaber)"
    )
    .eq("id", appointmentId)
    .maybeSingle();
  if (!data) return null;
  // student kann als Array oder Objekt kommen, normalisieren
  const student = Array.isArray(data.student) ? data.student[0] : data.student;
  const lehrperson = Array.isArray(data.lehrperson) ? data.lehrperson[0] : data.lehrperson;
  const studioAdresse = await ladeStudioAdresse(admin);
  return {
    ...data,
    student: student ?? null,
    studioAdresse,
    // Ohne Lehrperson (alte Daten) gilt der Termin als Davids.
    vonDavid: lehrperson ? lehrperson.ist_inhaber === true : true,
  } as AppointmentForSync;
}

const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars";

/**
 * Erstellt oder aktualisiert das Google-Event eines Termins und speichert die
 * `google_event_id`. Schluckt Fehler (Sync darf Buchung nicht blockieren).
 */
export async function syncAppointmentToCalendar(
  admin: SupabaseClient,
  appointmentId: string
): Promise<void> {
  try {
    const token = await getAccessToken();
    if (!token) return;

    const appt = await fetchAppointment(admin, appointmentId);
    if (!appt) return;

    // Gruppenlektion: ein Event für alle, getragen vom Leit-Termin.
    if (appt.gruppe_id) {
      await syncGruppenlektion(admin, appt, token);
      return;
    }

    // Stornierte/no-show Termine: Event löschen statt anlegen. Ebenso
    // Termine einer anderen Lehrperson: Davids Google-Kalender zeigt nur
    // seine eigenen Lektionen. Die Übersicht über alle hat er im Admin.
    if (appt.status === "cancelled" || appt.status === "no_show" || !appt.vonDavid) {
      await deleteCalendarEvent(admin, appointmentId);
      return;
    }

    await schreibeEvent(admin, appt, token, buildEventBody(appt));
  } catch (err) {
    console.error("syncAppointmentToCalendar error:", err);
  }
}

/** Legt das Event eines Termins an oder aktualisiert es. */
async function schreibeEvent(
  admin: SupabaseClient,
  appt: { id: string; google_event_id: string | null },
  token: string,
  body: object
): Promise<void> {
  const calId = encodeURIComponent(CALENDAR_ID);
  if (appt.google_event_id) {
    const res = await fetch(
      `${CAL_BASE}/${calId}/events/${appt.google_event_id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (res.status === 404) {
      // Event existiert nicht mehr → neu anlegen
      await createEvent(admin, appt.id, calId, token, body);
    } else if (!res.ok) {
      console.error("Google event update failed:", res.status, await res.text().catch(() => ""));
    }
  } else {
    await createEvent(admin, appt.id, calId, token, body);
  }
}

/**
 * Eine Gruppenlektion steht einmal im Kalender, nicht pro Mitglied.
 *
 * Jedes Mitglied hat einen eigenen Termin. Der Leit-Termin (lib/gruppen,
 * `leitTermin`) trägt das Event, die Events aller anderen werden gelöscht.
 * Sagt das Leit-Mitglied ab, rückt das nächste nach. Sagen alle ab, gibt es
 * kein Event mehr.
 */
async function syncGruppenlektion(
  admin: SupabaseClient,
  appt: AppointmentForSync,
  token: string
): Promise<void> {
  const [{ data: alle }, { data: gruppe }] = await Promise.all([
    admin
      .from("appointments")
      .select("id, status, google_event_id, student:profiles!student_id(vorname, nachname)")
      .eq("gruppe_id", appt.gruppe_id)
      .eq("start_at", appt.start_at),
    admin.from("gruppen").select("name").eq("id", appt.gruppe_id).maybeSingle(),
  ]);
  const termine = (alle ?? []) as Array<{
    id: string;
    status: string;
    google_event_id: string | null;
    student: { vorname: string | null; nachname: string | null } | { vorname: string | null; nachname: string | null }[] | null;
  }>;
  const leit = appt.vonDavid ? leitTermin(termine) : null;

  for (const t of termine) {
    if (t.id !== leit?.id && t.google_event_id) await deleteCalendarEvent(admin, t.id);
  }
  if (!leit) return;

  const traeger = leit.id === appt.id ? appt : await fetchAppointment(admin, leit.id);
  if (!traeger) return;
  const mitglieder = termine
    .filter((t) => t.status === "booked")
    .map((t) => {
      const s = Array.isArray(t.student) ? t.student[0] : t.student;
      return `${s?.vorname ?? ""} ${s?.nachname ?? ""}`.trim();
    })
    .filter(Boolean);
  await schreibeEvent(
    admin,
    traeger,
    token,
    buildEventBody(traeger, { name: String(gruppe?.name ?? "Gruppe"), mitglieder })
  );
}

async function createEvent(
  admin: SupabaseClient,
  appointmentId: string,
  calId: string,
  token: string,
  body: object
): Promise<void> {
  const res = await fetch(`${CAL_BASE}/${calId}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("Google event create failed:", res.status, await res.text().catch(() => ""));
    return;
  }
  const data = (await res.json()) as { id: string };
  if (data.id) {
    await admin
      .from("appointments")
      .update({ google_event_id: data.id })
      .eq("id", appointmentId);
  }
}

/** Löscht das Google-Event eines Termins und leert `google_event_id`. */
export async function deleteCalendarEvent(
  admin: SupabaseClient,
  appointmentId: string
): Promise<void> {
  try {
    const token = await getAccessToken();
    if (!token) return;

    const { data: appt } = await admin
      .from("appointments")
      .select("google_event_id")
      .eq("id", appointmentId)
      .maybeSingle();
    if (!appt?.google_event_id) return;

    const calId = encodeURIComponent(CALENDAR_ID);
    const res = await fetch(
      `${CAL_BASE}/${calId}/events/${appt.google_event_id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    // 410 = bereits gelöscht; 404 = nicht gefunden → beide ok
    if (res.ok || res.status === 410 || res.status === 404) {
      await admin
        .from("appointments")
        .update({ google_event_id: null })
        .eq("id", appointmentId);
    } else {
      console.error("Google event delete failed:", res.status);
    }
  } catch (err) {
    console.error("deleteCalendarEvent error:", err);
  }
}

/** Testet die Verbindung (für Einstellungsseite). */
export async function testCalendarConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  const sa = getServiceAccount();
  if (!sa) {
    return { ok: false, message: "Kein Service-Account konfiguriert." };
  }
  const token = await getAccessToken();
  if (!token) {
    return { ok: false, message: "Access-Token konnte nicht geholt werden (JWT/Service-Account prüfen)." };
  }
  try {
    const calId = encodeURIComponent(CALENDAR_ID);
    const res = await fetch(`${CAL_BASE}/${calId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `Kalender nicht erreichbar (${res.status}). Calendar-ID prüfen und Kalender für ${sa.client_email} freigeben.`,
      };
    }
    const data = (await res.json()) as { summary?: string };
    return {
      ok: true,
      message: `Verbunden mit Kalender „${data.summary ?? CALENDAR_ID}".`,
    };
  } catch (err) {
    return { ok: false, message: `Fehler: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Synchronisiert alle zukünftigen gebuchten Termine (Vollsync). */
export async function fullSyncFutureAppointments(
  admin: SupabaseClient
): Promise<{ synced: number; failed: number }> {
  const { data: appts } = await admin
    .from("appointments")
    .select("id, teachers!inner(ist_inhaber)")
    .eq("status", "booked")
    .eq("teachers.ist_inhaber", true)
    .gte("start_at", new Date().toISOString());

  let synced = 0;
  let failed = 0;
  for (const a of appts ?? []) {
    try {
      await syncAppointmentToCalendar(admin, a.id);
      synced++;
    } catch {
      failed++;
    }
  }
  return { synced, failed };
}

// ── Probelektionen (von David eingetragen, Person ohne Konto) ────────────────

/**
 * Legt das Google-Event einer Probelektion an oder aktualisiert es. Abgesagte
 * Probelektionen werden gelöscht. Nur Davids eigene landen in seinem Kalender.
 * Schluckt Fehler: Der Eintrag im Admin darf daran nicht scheitern.
 */
export async function syncProbelektionToCalendar(
  admin: SupabaseClient,
  probelektionId: string
): Promise<void> {
  try {
    const token = await getAccessToken();
    if (!token) return;

    const { data: p } = await admin
      .from("probelektionen")
      .select(
        "id, vorname, nachname, email, telefon, start_at, end_at, status, notiz, google_event_id, lehrperson:teachers!teacher_id(ist_inhaber)"
      )
      .eq("id", probelektionId)
      .maybeSingle();
    if (!p) return;
    const lehrperson = Array.isArray(p.lehrperson) ? p.lehrperson[0] : p.lehrperson;
    const vonDavid = lehrperson ? lehrperson.ist_inhaber === true : true;

    if (p.status !== "geplant" || !vonDavid) {
      await deleteProbelektionEvent(admin, probelektionId);
      return;
    }

    const name = `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim();
    const body = {
      summary: `Probelektion, ${name}`,
      location: await ladeStudioAdresse(admin),
      description: [
        `Probelektion: ${name}`,
        p.email ? `E-Mail: ${p.email}` : null,
        p.telefon ? `Telefon: ${p.telefon}` : null,
        p.notiz ? `Notiz: ${p.notiz}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      start: { dateTime: p.start_at, timeZone: "Europe/Zurich" },
      end: { dateTime: p.end_at, timeZone: "Europe/Zurich" },
      colorId: "6", // Mandarine
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
    };
    const calId = encodeURIComponent(CALENDAR_ID);

    if (p.google_event_id) {
      const res = await fetch(`${CAL_BASE}/${calId}/events/${p.google_event_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      if (res.status !== 404 && res.status !== 410) {
        console.error("Google Probelektion update failed:", res.status);
        return;
      }
    }

    const res = await fetch(`${CAL_BASE}/${calId}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("Google Probelektion create failed:", res.status);
      return;
    }
    const data = (await res.json()) as { id?: string };
    if (data.id) {
      await admin.from("probelektionen").update({ google_event_id: data.id }).eq("id", probelektionId);
    }
  } catch (err) {
    console.error("syncProbelektionToCalendar error:", err);
  }
}

/** Löscht das Google-Event einer Probelektion. */
export async function deleteProbelektionEvent(
  admin: SupabaseClient,
  probelektionId: string
): Promise<void> {
  try {
    const token = await getAccessToken();
    if (!token) return;
    const { data: p } = await admin
      .from("probelektionen")
      .select("google_event_id")
      .eq("id", probelektionId)
      .maybeSingle();
    if (!p?.google_event_id) return;
    const calId = encodeURIComponent(CALENDAR_ID);
    const res = await fetch(`${CAL_BASE}/${calId}/events/${p.google_event_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok || res.status === 410 || res.status === 404) {
      await admin.from("probelektionen").update({ google_event_id: null }).eq("id", probelektionId);
    } else {
      console.error("Google Probelektion delete failed:", res.status);
    }
  } catch (err) {
    console.error("deleteProbelektionEvent error:", err);
  }
}
