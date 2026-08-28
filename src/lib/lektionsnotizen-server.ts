// ============================================================
// Lektionsnotizen: Daten holen
//
// Drei Fragen, die die Oberfläche stellt:
//
//   Was ist offen?      Lektionen, die stattgefunden haben, ohne Notiz.
//   Was kommt?          Der Stand vor jeder der nächsten Lektionen.
//   Wie war es bisher?  Der ganze Verlauf eines Schülers.
//
// Die Regeln dazu stehen in lektionsnotizen.ts.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  baueVorschau,
  FRAGEN_NACH_MINUTEN,
  OFFEN_MAX_TAGE,
  type Notiz,
  type Vorschau,
} from "./lektionsnotizen";

export type OffeneLektion = {
  appointmentId: string;
  studentId: string;
  name: string;
  beginn: string;
};

type ProfilZeile = { vorname: string; nachname: string } | null;

const name = (p: ProfilZeile) =>
  p ? `${p.vorname} ${p.nachname}`.trim() : "Unbekannt";

/**
 * Lektionen, die vorbei sind und zu denen noch nichts eingetragen ist.
 *
 * Abgesagte Stunden sind bewusst draussen: Sie hatten keinen Inhalt, und eine
 * Liste, die sich nicht leeren lässt, hört man nach einer Woche auf zu lesen.
 */
export async function ladeOffeneNotizen(
  admin: SupabaseClient,
  jetzt: Date = new Date()
): Promise<OffeneLektion[]> {
  const bis = new Date(jetzt.getTime() - FRAGEN_NACH_MINUTEN * 60_000);
  const von = new Date(jetzt.getTime() - OFFEN_MAX_TAGE * 86_400_000);

  const { data: lektionen } = await admin
    .from("appointments")
    .select("id, student_id, start_at, profiles!inner(vorname, nachname, ist_test)")
    .in("status", ["booked", "completed"])
    .gte("start_at", von.toISOString())
    .lte("end_at", bis.toISOString())
    // Der Testschüler hat keine echte Stunde gehabt, über die man etwas
    // schreiben könnte.
    .eq("profiles.ist_test", false)
    .order("start_at", { ascending: false });

  if (!lektionen || lektionen.length === 0) return [];

  const ids = lektionen.map((l) => l.id);
  const { data: vorhanden } = await admin
    .from("lektionsnotizen")
    .select("appointment_id")
    .in("appointment_id", ids);

  const schonNotiert = new Set((vorhanden ?? []).map((n) => n.appointment_id));

  return lektionen
    .filter((l) => !schonNotiert.has(l.id))
    .map((l) => ({
      appointmentId: l.id,
      studentId: l.student_id,
      name: name(l.profiles as unknown as ProfilZeile),
      beginn: l.start_at,
    }));
}

/**
 * Der Stand je Schüler, für die Vorschau vor der nächsten Lektion.
 *
 * Holt bewusst mehr als die letzte Notiz: „seit vier Lektionen dranbleiben"
 * lässt sich aus einer einzelnen Zeile nicht ablesen.
 */
export async function ladeVorschauFuer(
  admin: SupabaseClient,
  studentIds: string[]
): Promise<Record<string, Vorschau>> {
  if (studentIds.length === 0) return {};

  const { data } = await admin
    .from("lektionsnotizen")
    .select(
      "appointment_id, student_id, inhalt, verlauf, woran, hausaufgabe, appointments!inner(start_at)"
    )
    .in("student_id", studentIds)
    .order("erstellt_am", { ascending: false })
    .limit(200);

  const proSchueler: Record<string, Notiz[]> = {};
  for (const r of data ?? []) {
    const termin = r.appointments as unknown as { start_at: string } | null;
    (proSchueler[r.student_id] ??= []).push({
      appointment_id: r.appointment_id,
      inhalt: r.inhalt ?? [],
      verlauf: r.verlauf,
      woran: r.woran,
      hausaufgabe: r.hausaufgabe,
      lektion_am: termin?.start_at ?? "",
    });
  }

  const raus: Record<string, Vorschau> = {};
  for (const id of studentIds) {
    const liste = (proSchueler[id] ?? []).sort((a, b) =>
      // Nach Lektionsdatum, nicht nach Eintragsdatum: Wer eine alte Stunde
      // nachträgt, soll damit nicht den aktuellen Stand überschreiben.
      a.lektion_am < b.lektion_am ? 1 : -1
    );
    raus[id] = baueVorschau(liste);
  }
  return raus;
}

/** Alle Notizen eines Schülers, neueste zuerst. */
export async function ladeVerlauf(
  admin: SupabaseClient,
  studentId: string
): Promise<Notiz[]> {
  const { data } = await admin
    .from("lektionsnotizen")
    .select(
      "appointment_id, inhalt, verlauf, woran, hausaufgabe, appointments!inner(start_at)"
    )
    .eq("student_id", studentId)
    .limit(100);

  return (data ?? [])
    .map((r) => {
      const termin = r.appointments as unknown as { start_at: string } | null;
      return {
        appointment_id: r.appointment_id,
        inhalt: r.inhalt ?? [],
        verlauf: r.verlauf,
        woran: r.woran,
        hausaufgabe: r.hausaufgabe,
        lektion_am: termin?.start_at ?? "",
      };
    })
    .sort((a, b) => (a.lektion_am < b.lektion_am ? 1 : -1));
}
