// ============================================================
// Was externe Schüler eingebracht haben
//
// Externe zahlen über ihre Plattform. David sieht das Geld erst auf dem
// Konto, ohne dass dieses System je eine Rechnung gestellt hätte. Hier
// bestätigt er, was angekommen ist — derselbe Handgriff wie bei den
// eigenen Schülern, nur ohne Rechnung und ohne Post.
//
// Zwei Zahlen, die man nicht verwechseln darf:
//
//   erwartet  = gehaltene Lektion mal hinterlegtem Ertrag. Eine Schätzung.
//   bezahlt   = von David bestätigt. Das ist die Zahl für die Steuer.
//
// Deshalb trägt jede Zahlung ihren eigenen Betrag und nicht bloss einen
// Haken: Nimmt die Plattform eine Provision oder rechnet sie eine Lektion
// anders ab, gilt was überwiesen wurde, nicht was hinterlegt ist.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export type ExterneLektion = {
  appointmentId: string;
  studentId: string;
  name: string;
  plattform: string | null;
  beginn: string;
  /** Aus `externer_ertrag` hochgerechnet — der Vorschlag für den Betrag. */
  erwartet: number;
  /** Liegt der Termin schon hinter uns? */
  gehalten: boolean;
  istTest: boolean;
  /** Gesetzt, sobald David die Zahlung bestätigt hat. */
  bezahlt: { betrag: number; am: string; notiz: string | null } | null;
};

type TerminRow = {
  id: string;
  start_at: string;
  end_at: string;
  student_id: string;
  profiles: {
    vorname: string | null;
    nachname: string | null;
    plattform: string | null;
    externer_ertrag: number | string | null;
    ist_test: boolean | null;
  };
};

/**
 * Alle externen Lektionen eines Zeitraums, mit Zahlungsstand.
 *
 * Ohne Zeitraum: die letzten 200. Stornierte fallen raus — eine abgesagte
 * Lektion bringt nichts ein und würde die Liste nur zumüllen.
 */
export async function ladeExterneLektionen(
  admin: SupabaseClient,
  bereich: { von?: string; bis?: string } = {}
): Promise<ExterneLektion[]> {
  let query = admin
    .from("appointments")
    .select(
      "id, start_at, end_at, student_id, profiles!inner(vorname, nachname, plattform, externer_ertrag, ist_test, extern)"
    )
    .eq("profiles.extern", true)
    .in("status", ["booked", "completed"])
    .order("start_at", { ascending: false })
    .limit(200);

  if (bereich.von) query = query.gte("start_at", bereich.von);
  if (bereich.bis) query = query.lt("start_at", bereich.bis);

  const { data: termine } = await query;
  const rows = (termine ?? []) as unknown as TerminRow[];
  if (rows.length === 0) return [];

  const { data: zahlungen } = await admin
    .from("externe_zahlungen")
    .select("appointment_id, betrag, bezahlt_am, notiz")
    .in(
      "appointment_id",
      rows.map((t) => t.id)
    );

  const bezahltNach = new Map(
    (zahlungen ?? []).map((z) => [
      z.appointment_id as string,
      {
        betrag: Number(z.betrag),
        am: z.bezahlt_am as string,
        notiz: (z.notiz as string | null) ?? null,
      },
    ])
  );

  const jetzt = new Date().toISOString();

  return rows.map((t) => ({
    appointmentId: t.id,
    studentId: t.student_id,
    name: `${t.profiles.vorname ?? ""} ${t.profiles.nachname ?? ""}`.trim() || "Unbekannt",
    plattform: t.profiles.plattform ?? null,
    beginn: t.start_at,
    erwartet: Number(t.profiles.externer_ertrag ?? 0),
    gehalten: t.end_at < jetzt,
    istTest: t.profiles.ist_test === true,
    bezahlt: bezahltNach.get(t.id) ?? null,
  }));
}

/**
 * Bestätigt, dass für eine externe Lektion Geld angekommen ist.
 *
 * Der eindeutige Index auf `appointment_id` fängt den Doppelklick ab: Ohne
 * ihn stünde dieselbe Lektion zweimal in der Steuererklärung.
 */
export async function markiereExternBezahlt(
  admin: SupabaseClient,
  params: {
    appointmentId: string;
    betrag?: number;
    bezahltAm?: string;
    notiz?: string | null;
  }
): Promise<{ betrag: number } | { error: string }> {
  const { data: termin } = await admin
    .from("appointments")
    .select("id, status, student_id, profiles!inner(extern, externer_ertrag)")
    .eq("id", params.appointmentId)
    .maybeSingle();

  if (!termin) return { error: "Termin nicht gefunden." };

  const profil = (
    Array.isArray(termin.profiles) ? termin.profiles[0] : termin.profiles
  ) as { extern?: boolean; externer_ertrag?: number | string | null } | null;

  // Diese Tabelle ist ausschliesslich für Externe. Ein eigener Schüler
  // gehört über die Rechnung abgerechnet, sonst steht seine Lektion in
  // zwei Systemen gleichzeitig und wird doppelt gezählt.
  if (profil?.extern !== true) {
    return { error: "Das ist kein externer Schüler." };
  }
  if (termin.status === "cancelled") {
    return { error: "Die Lektion ist abgesagt." };
  }

  const betrag =
    params.betrag != null && Number.isFinite(params.betrag)
      ? Number(params.betrag)
      : Number(profil.externer_ertrag ?? 0);

  if (!(betrag >= 0)) return { error: "Ungültiger Betrag." };
  // Ein Vertipper wie 6800 statt 68 wäre in der Jahresrechnung schwer zu
  // finden. Lieber hier abfangen.
  if (betrag > 1000) return { error: "Über CHF 1000 für eine Lektion? Bitte prüfen." };

  const { error } = await admin.from("externe_zahlungen").insert({
    appointment_id: params.appointmentId,
    student_id: termin.student_id,
    betrag,
    bezahlt_am: params.bezahltAm ?? new Date().toISOString(),
    notiz: params.notiz ?? null,
  });

  if (error) {
    // 23505 = unique violation: schon bezahlt. Kein Fehler aus Davids
    // Sicht, nur ein zweiter Klick.
    if (error.code === "23505") return { error: "Diese Lektion ist bereits erfasst." };
    return { error: "Die Zahlung liess sich nicht speichern." };
  }

  return { betrag };
}

/** Nimmt eine Bestätigung zurück (verklickt, oder Geld kam doch nicht). */
export async function widerrufeExterneZahlung(
  admin: SupabaseClient,
  appointmentId: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await admin
    .from("externe_zahlungen")
    .delete()
    .eq("appointment_id", appointmentId);

  if (error) return { error: "Die Zahlung liess sich nicht zurücknehmen." };
  return { ok: true };
}
