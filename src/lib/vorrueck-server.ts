// ============================================================
// Vorrück-Angebote: die Lücke nach einer Absage weitergeben
//
// Sagt jemand ab, klafft mitten im Abend ein Loch — Zeit, die David vor Ort
// absitzt, ohne zu unterrichten. Der Schüler direkt nach der Lücke könnte
// früher kommen und das Loch schliessen. Dieses Modul stellt ihm genau
// diese Frage, per Mail und als Banner im Portal: unverbindlich, mit einem
// klaren „Nein ist auch okay".
//
// Der Ablauf:
//   Absage → biete FrueherenSlotAn() findet den nächsten Termin desselben
//   Tages → Angebot in DB + Mail → Schüler antwortet im Portal →
//   beantworteVorrueck() verschiebt den Termin oder legt das Angebot ab.
//
// Kein Automatismus verschiebt hier irgendetwas ohne Zustimmung des
// Schülers. Das ist der Unterschied zur Ausfall-Kaskade, die dem
// *absagenden* Schüler Ersatz sucht — hier geht es um den *nächsten*.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAtLeast24hAway,
  validateSeries,
  slotsFromStarts,
  DEFAULT_BUFFER_MIN,
  LESSON_DURATION_MIN,
} from "./booking";
import { loadAvailabilityContext } from "./booking-server";
import { sendEmailNow } from "./emails-outbox";
import { syncAppointmentToCalendar } from "./google-calendar";
import { cancelLessonReminders, scheduleLessonReminders } from "./reminders";

export type VorrueckAngebot = {
  id: string;
  appointment_id: string;
  student_id: string;
  alter_beginn: string;
  neuer_beginn: string;
  status: "offen" | "angenommen" | "abgelehnt" | "verfallen";
};

/** Lokaler Kalendertag in Zürich, als YYYY-MM-DD. */
function zuercherTag(iso: string | Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * Nach einer Absage: dem nächsten Schüler desselben Tages anbieten, in die
 * Lücke vorzurücken.
 *
 * Bewusst zurückhaltend — in all diesen Fällen passiert einfach nichts,
 * statt dass eine seltsame Mail rausgeht:
 * - Lücke ist keine 24h entfernt (zu kurzfristig, um per Mail zu fragen)
 * - kein späterer Termin am selben Tag
 * - der nächste Schüler ist extern (sein Termin ist anderswo abgemacht)
 * - für den Termin läuft schon ein offenes Angebot
 */
export async function bieteFrueherenSlotAn(
  admin: SupabaseClient,
  abgesagt: { id: string; start_at: string; student_id: string }
): Promise<{ angeboten: boolean; grund?: string }> {
  const jetzt = new Date();
  if (!isAtLeast24hAway(abgesagt.start_at, jetzt)) {
    return { angeboten: false, grund: "zu kurzfristig" };
  }

  // Der nächste gebuchte Termin am selben Zürcher Kalendertag.
  const tag = zuercherTag(abgesagt.start_at);
  const { data: kandidaten } = await admin
    .from("appointments")
    .select("id, start_at, end_at, student_id")
    .eq("status", "booked")
    .gt("start_at", abgesagt.start_at)
    // Grosszügig bis Tagesende +2h UTC laden, dann exakt nach Zürcher Tag
    // filtern. Ein reiner UTC-Vergleich kippt an der Sommerzeit.
    .lt(
      "start_at",
      new Date(new Date(abgesagt.start_at).getTime() + 14 * 3600_000).toISOString()
    )
    .order("start_at", { ascending: true })
    .limit(5);

  const naechster = (kandidaten ?? []).find(
    (a) =>
      zuercherTag(a.start_at) === tag && a.student_id !== abgesagt.student_id
  );
  if (!naechster) return { angeboten: false, grund: "kein späterer Termin" };

  const { data: profil } = await admin
    .from("profiles")
    .select("vorname, aktiv, extern")
    .eq("id", naechster.student_id)
    .maybeSingle();
  if (!profil || profil.aktiv !== true || profil.extern === true) {
    return { angeboten: false, grund: "Schüler extern oder inaktiv" };
  }

  // Der freigewordene Beginn. Liegt er nicht vor dem jetzigen Termin des
  // Nächsten, gibt es nichts anzubieten.
  if (new Date(abgesagt.start_at) >= new Date(naechster.start_at)) {
    return { angeboten: false, grund: "kein Zeitgewinn" };
  }

  // Schon ein offenes Angebot? Dann nicht noch eines hinterher.
  const { data: offen } = await admin
    .from("vorrueck_angebote")
    .select("id")
    .eq("appointment_id", naechster.id)
    .eq("status", "offen")
    .maybeSingle();
  if (offen) return { angeboten: false, grund: "Angebot läuft schon" };

  const { data: angebot, error } = await admin
    .from("vorrueck_angebote")
    .insert({
      appointment_id: naechster.id,
      student_id: naechster.student_id,
      ausgeloest_von: abgesagt.id,
      alter_beginn: naechster.start_at,
      neuer_beginn: abgesagt.start_at,
    })
    .select("id")
    .single();
  if (error || !angebot) {
    return { angeboten: false, grund: "Angebot konnte nicht angelegt werden" };
  }

  await sendEmailNow(admin, "vorrueck_angebot", {
    student_id: naechster.student_id,
    student_name: profil.vorname ?? "",
    angebot_id: angebot.id,
    alter_beginn: naechster.start_at,
    neuer_beginn: abgesagt.start_at,
  });

  return { angeboten: true };
}

/**
 * Antwort des Schülers auf ein Vorrück-Angebot.
 *
 * Annahme verschiebt den Termin sofort — dafür wird der Slot noch einmal
 * gegen die Buchungs-Engine geprüft, denn zwischen Angebot und Antwort kann
 * die Lücke anderweitig gefüllt worden sein (etwa vom absagenden Schüler
 * selbst, dem die Ausfall-Kaskade Ersatz gesucht hat). Ist der Slot weg,
 * verfällt das Angebot mit einer verständlichen Meldung, und der alte
 * Termin bleibt unangetastet.
 */
export async function beantworteVorrueck(
  admin: SupabaseClient,
  params: { angebotId: string; studentId: string; annehmen: boolean }
): Promise<{ verschoben: boolean; error?: string }> {
  const { data: angebot } = await admin
    .from("vorrueck_angebote")
    .select("*")
    .eq("id", params.angebotId)
    .maybeSingle();

  if (!angebot || angebot.student_id !== params.studentId) {
    return { verschoben: false, error: "Angebot nicht gefunden." };
  }
  if (angebot.status !== "offen") {
    return { verschoben: false, error: "Dieses Angebot ist schon beantwortet." };
  }

  if (!params.annehmen) {
    await admin
      .from("vorrueck_angebote")
      .update({ status: "abgelehnt", beantwortet_am: new Date().toISOString() })
      .eq("id", params.angebotId);
    return { verschoben: false };
  }

  const { data: appt } = await admin
    .from("appointments")
    .select("id, status, start_at, student_id")
    .eq("id", angebot.appointment_id)
    .maybeSingle();
  if (!appt || appt.status !== "booked") {
    await admin
      .from("vorrueck_angebote")
      .update({ status: "verfallen", beantwortet_am: new Date().toISOString() })
      .eq("id", params.angebotId);
    return { verschoben: false, error: "Der Termin besteht nicht mehr." };
  }

  const { data: profil } = await admin
    .from("profiles")
    .select("buffer_time_minutes, vorname, nachname")
    .eq("id", params.studentId)
    .maybeSingle();
  const bufferMin = profil?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  const neuerStart = new Date(angebot.neuer_beginn);
  const jetzt = new Date();
  const slotEnde = new Date(neuerStart.getTime() + LESSON_DURATION_MIN * 60000);

  // Volle Prüfung inklusive 24h-Vorlauf: Eine Verschiebung unter 24h würde
  // David einen früheren Termin unterschieben, mit dem er nicht rechnet —
  // dieselbe Regel wie bei jeder anderen Verschiebung im System.
  const ctx = await loadAvailabilityContext(
    admin,
    params.studentId,
    bufferMin,
    neuerStart,
    slotEnde,
    jetzt,
    // Der Termin wird gleich verschoben: Kalender zwingend frisch holen.
    { excludeAppointmentId: angebot.appointment_id, kalenderJetzt: true }
  );
  const pruefung = validateSeries(neuerStart, 1, 7, ctx);
  if (!pruefung.ok) {
    await admin
      .from("vorrueck_angebote")
      .update({ status: "verfallen", beantwortet_am: new Date().toISOString() })
      .eq("id", params.angebotId);
    return {
      verschoben: false,
      error:
        "Der frühere Platz ist inzwischen nicht mehr frei. Dein Termin bleibt wie er war.",
    };
  }

  const neuesEnde = slotsFromStarts([neuerStart])[0].end;
  const { error: updateError } = await admin
    .from("appointments")
    .update({
      start_at: neuerStart.toISOString(),
      end_at: neuesEnde.toISOString(),
    })
    .eq("id", angebot.appointment_id);
  if (updateError) {
    return { verschoben: false, error: "Der Termin liess sich nicht verschieben." };
  }

  await admin
    .from("vorrueck_angebote")
    .update({ status: "angenommen", beantwortet_am: new Date().toISOString() })
    .eq("id", params.angebotId);

  await syncAppointmentToCalendar(admin, angebot.appointment_id);
  await cancelLessonReminders(admin, angebot.appointment_id);
  await scheduleLessonReminders(admin, {
    id: angebot.appointment_id,
    student_id: params.studentId,
    start_at: neuerStart.toISOString(),
  });

  await sendEmailNow(admin, "vorrueck_bestaetigt", {
    student_id: params.studentId,
    student_name: profil?.vorname ?? "",
    alter_beginn: angebot.alter_beginn,
    neuer_beginn: angebot.neuer_beginn,
  });

  // David muss es erfahren: Sein Abend sieht jetzt anders aus.
  await sendEmailNow(admin, "vorrueck_admin", {
    student_id: params.studentId,
    student_name:
      `${profil?.vorname ?? ""} ${profil?.nachname ?? ""}`.trim(),
    alter_beginn: angebot.alter_beginn,
    neuer_beginn: angebot.neuer_beginn,
  });

  return { verschoben: true };
}

/** Offene Angebote eines Schülers, deren neuer Beginn noch in der Zukunft liegt. */
export async function offeneVorrueckAngebote(
  admin: SupabaseClient,
  studentId: string
): Promise<VorrueckAngebot[]> {
  const { data } = await admin
    .from("vorrueck_angebote")
    .select("id, appointment_id, student_id, alter_beginn, neuer_beginn, status")
    .eq("student_id", studentId)
    .eq("status", "offen")
    .gt("neuer_beginn", new Date().toISOString())
    .order("neuer_beginn", { ascending: true });
  return (data ?? []) as VorrueckAngebot[];
}
