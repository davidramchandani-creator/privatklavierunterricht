"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { legeGruppeAn } from "@/lib/gruppen-server";
import { todayInZurich } from "@/lib/subscription";
import { serienStart } from "@/lib/umstellung-server";
import { cancelAppointmentNew } from "../actions";

async function assertAdmin(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profil?.role !== "admin") return { error: "Keine Berechtigung." };
  return null;
}

function neuLaden() {
  revalidatePath("/admin/gruppen");
  revalidatePath("/admin/kalender");
  revalidatePath("/admin/zahlungen");
  revalidatePath("/admin/schueler");
}

export type GruppeFormular = {
  mitglieder: string[];
  name: string;
  variante: "halbjahr" | "jahr";
  rhythmus: "woechentlich" | "zweiwoechentlich";
  weekday: number;
  time: string;
  parity: 0 | 1 | null;
  periodeStart: string;
  mailsSenden: boolean;
  notiz: string;
};

/** Gruppe mit Abo pro Mitglied und gemeinsamer Serie anlegen. */
export async function gruppeAnlegen(
  f: GruppeFormular
): Promise<{ ok: true; lektionen: number } | { ok: false; fehler: string }> {
  const verboten = await assertAdmin();
  if (verboten) return { ok: false, fehler: verboten.error };

  if (f.variante !== "halbjahr" && f.variante !== "jahr") {
    return { ok: false, fehler: "Bitte Semester- oder Jahresabo wählen." };
  }
  if (f.rhythmus !== "woechentlich" && f.rhythmus !== "zweiwoechentlich") {
    return { ok: false, fehler: "Bitte einen Rhythmus wählen." };
  }
  if (!Number.isInteger(f.weekday) || f.weekday < 0 || f.weekday > 6) {
    return { ok: false, fehler: "Bitte einen Wochentag wählen." };
  }
  if (!/^\d{2}:\d{2}$/.test(f.time)) {
    return { ok: false, fehler: "Bitte eine Uhrzeit wählen." };
  }

  const heute = todayInZurich();
  const morgen = new Date(Date.parse(`${heute}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const inEinemJahr = new Date(Date.parse(`${heute}T00:00:00Z`) + 366 * 86400000)
    .toISOString()
    .slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.periodeStart) || Number.isNaN(Date.parse(f.periodeStart))) {
    return { ok: false, fehler: "Bitte ein gültiges Startdatum wählen." };
  }
  if (f.periodeStart < morgen) {
    return { ok: false, fehler: "Die Gruppe kann frühestens morgen beginnen." };
  }
  if (f.periodeStart > inEinemJahr) {
    return { ok: false, fehler: "Das Startdatum liegt mehr als ein Jahr voraus." };
  }

  const admin = await createAdminClient();
  const r = await legeGruppeAn(admin, {
    mitglieder: f.mitglieder,
    name: f.name,
    variante: f.variante,
    rhythmus: f.rhythmus,
    weekday: f.weekday,
    time: f.time,
    parity: f.rhythmus === "zweiwoechentlich" ? f.parity : null,
    periodeStart: f.periodeStart,
    // Die Verlängerung einer Gruppe kommt in Schritt 3. Bis dahin endet das
    // Abo mit der Periode, und die Mitglieder werden vorher informiert.
    autoRenew: false,
    mailsSenden: f.mailsSenden,
    notiz: f.notiz,
    now: serienStart(f.periodeStart),
  });
  if ("error" in r) return { ok: false, fehler: r.error };

  neuLaden();
  return { ok: true, lektionen: r.lektionen };
}

/**
 * Sagt eine Gruppenlektion für alle Mitglieder ab, als Absage durch David.
 *
 * Läuft pro Mitglied über dieselbe Absage wie im Kalender: Rechnung,
 * Erinnerungen, Mail an den Schüler und Ausfall-Eintrag. Einen Ersatz bucht
 * sie nicht, den plant David (lib/gruppen, `gruppenBehandlung`).
 */
export async function gruppenLektionAbsagen(
  gruppeId: string,
  startAt: string
): Promise<{ ok: true; abgesagt: number } | { ok: false; fehler: string }> {
  const verboten = await assertAdmin();
  if (verboten) return { ok: false, fehler: verboten.error };

  const admin = await createAdminClient();
  const { data: termine } = await admin
    .from("appointments")
    .select("id, student_id")
    .eq("gruppe_id", gruppeId)
    .eq("start_at", startAt)
    .eq("status", "booked");
  if (!termine || termine.length === 0) {
    return { ok: false, fehler: "Für diese Lektion ist niemand mehr gebucht." };
  }

  let abgesagt = 0;
  for (const t of termine) {
    const r = await cancelAppointmentNew(t.id as string, t.student_id as string);
    if (r && "success" in r) abgesagt++;
  }
  neuLaden();
  if (abgesagt < termine.length) {
    return {
      ok: false,
      fehler: `Nur ${abgesagt} von ${termine.length} Terminen abgesagt. Bitte im Kalender prüfen.`,
    };
  }
  return { ok: true, abgesagt };
}
