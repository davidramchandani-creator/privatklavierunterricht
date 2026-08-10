// ============================================================
// Ausgefallene Lektionen und ihre Kompensation
//
// Die Kaskade, in dieser Reihenfolge:
//   1. Ausweichtermin in derselben Woche
//   2. Ausweichtermin in der Folgewoche
//   3. Laufzeitgutschrift (Paket läuft entsprechend länger)
//   4. Rückerstattung — nur von Hand, nie automatisch
//
// Warum diese Reihenfolge: Jede Stufe kostet David mehr als die vorige. Ein
// Ausweichtermin kostet nichts (die Lücke war ohnehin da), eine Gutschrift
// kostet nur später Geld, eine Rückerstattung kostet echtes Geld. Die für
// den Schüler fairste Reihenfolge ist damit zugleich die günstigste.
//
// Sonderfall: Sagt der Schüler weniger als 24 Stunden vorher ab, gilt die
// Lektion als gehalten. Die Zeit war reserviert und liess sich nicht mehr
// vergeben. Sagt David ab, gibt es diese Ausnahme nicht — er ist der
// Verursacher und schuldet immer einen Ausgleich.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { BOOKING_LEAD_HOURS } from "./booking";
import { findeAusweichtermine } from "./fixplatz-server";
import { sendEmailNow } from "./emails-outbox";

export type Verursacher = "schueler" | "admin";

export type AusfallStatus =
  | "offen"
  | "ersatz_gebucht"
  | "gutschrift"
  | "verfallen"
  | "rueckerstattet";

/** Fällt die Absage unter die 24-Stunden-Regel? */
export function istKurzfristig(start: Date | string, jetzt: Date): boolean {
  return (
    new Date(start).getTime() - jetzt.getTime() < BOOKING_LEAD_HOURS * 3600000
  );
}

/**
 * Entscheidet, wie ein Ausfall behandelt wird.
 *
 * Bewusst als reine Funktion herausgezogen: Das ist die Geschäftsregel, an
 * der Geld hängt, und sie soll ohne Datenbank prüfbar sein.
 */
export function bestimmeBehandlung(params: {
  verursacher: Verursacher;
  kurzfristig: boolean;
}): {
  /** Lektion wird dem Schüler zurückgegeben? */
  lektionErhalten: boolean;
  /** Ausweichtermine suchen? */
  ersatzSuchen: boolean;
  /** Welche E-Mail der Schüler bekommt. */
  mailTyp: "ausfall_ersatz_vorschlag" | "ausfall_kurzfristig";
  begruendung: string;
} {
  // David sagt ab: immer voller Ausgleich, keine 24-Stunden-Ausnahme.
  if (params.verursacher === "admin") {
    return {
      lektionErhalten: true,
      ersatzSuchen: true,
      mailTyp: "ausfall_ersatz_vorschlag",
      begruendung:
        "Absage durch die Lehrperson – die Lektion bleibt in jedem Fall erhalten.",
    };
  }

  // Schüler sagt kurzfristig ab: Lektion gilt als gehalten.
  if (params.kurzfristig) {
    return {
      lektionErhalten: false,
      ersatzSuchen: false,
      mailTyp: "ausfall_kurzfristig",
      begruendung:
        "Weniger als 24 Stunden vorher abgesagt – die Zeit liess sich nicht mehr vergeben.",
    };
  }

  return {
    lektionErhalten: true,
    ersatzSuchen: true,
    mailTyp: "ausfall_ersatz_vorschlag",
    begruendung: "Rechtzeitig abgesagt – Ausweichtermine werden vorgeschlagen.",
  };
}

/**
 * Wie viele Tage Laufzeit eine ausgefallene Lektion gutgeschrieben bekommt,
 * wenn kein Ausweichtermin zustande kommt.
 *
 * Ein Rhythmusintervall: wer wöchentlich Unterricht hat, bekommt eine Woche,
 * wer zweiwöchentlich hat, zwei. So verschiebt sich die ganze Serie um genau
 * einen Takt nach hinten — die Lektion wird am Ende angehängt.
 */
export function gutschriftTage(rhythmus: string | null): number {
  return rhythmus === "zweiwoechentlich" ? 14 : 7;
}

export type AusfallErgebnis = {
  ausfallId: string;
  behandlung: ReturnType<typeof bestimmeBehandlung>;
  vorschlaege: { start: string; begruendung: string }[];
};

/**
 * Meldet einen Ausfall an und stösst die Kaskade an.
 *
 * Der Termin selbst muss vom Aufrufer bereits storniert sein — diese Funktion
 * kümmert sich nur um die Kompensation. So bleibt die Stornierung dort, wo sie
 * schon behandelt wird, und die Kompensation an einer einzigen Stelle.
 */
export async function meldeAusfall(
  admin: SupabaseClient,
  params: {
    appointmentId: string;
    studentId: string;
    packageId: string | null;
    verursacher: Verursacher;
    originalStart: Date;
    grund?: string | null;
    now?: Date;
  }
): Promise<AusfallErgebnis | { error: string }> {
  const now = params.now ?? new Date();
  const kurzfristig =
    params.verursacher === "schueler" &&
    istKurzfristig(params.originalStart, now);

  const behandlung = bestimmeBehandlung({
    verursacher: params.verursacher,
    kurzfristig,
  });

  const { data: ausfall, error } = await admin
    .from("lesson_ausfaelle")
    .insert({
      appointment_id: params.appointmentId,
      student_id: params.studentId,
      package_id: params.packageId,
      verursacher: params.verursacher,
      original_start: params.originalStart.toISOString(),
      grund: params.grund ?? null,
      kurzfristig,
      status: behandlung.lektionErhalten ? "offen" : "verfallen",
      erledigt_am: behandlung.lektionErhalten ? null : now.toISOString(),
    })
    .select("id")
    .single();

  if (error || !ausfall) {
    // 23505 = derselbe Termin wurde schon einmal als Ausfall gemeldet.
    if (error?.code === "23505") {
      return { error: "Dieser Termin ist bereits als Ausfall erfasst." };
    }
    return { error: "Der Ausfall konnte nicht erfasst werden." };
  }

  let vorschlaege: { start: string; begruendung: string }[] = [];
  if (behandlung.ersatzSuchen) {
    const kandidaten = await findeAusweichtermine(admin, {
      studentId: params.studentId,
      originalStart: params.originalStart,
      excludeAppointmentId: params.appointmentId,
      now,
    });
    vorschlaege = kandidaten.map((k) => ({
      start: k.slot.start.toISOString(),
      begruendung: k.begruendung,
    }));
  }

  const { data: profil } = await admin
    .from("profiles")
    .select("vorname, nachname")
    .eq("id", params.studentId)
    .maybeSingle();
  const name = `${profil?.vorname ?? ""} ${profil?.nachname ?? ""}`.trim();

  // Findet sich kein einziger Ausweichtermin, geht es direkt auf Stufe 3.
  if (behandlung.lektionErhalten && vorschlaege.length === 0) {
    await gewaehreGutschrift(admin, {
      ausfallId: ausfall.id,
      studentId: params.studentId,
      packageId: params.packageId,
      originalStart: params.originalStart,
      studentName: name,
    });
  } else {
    await sendEmailNow(admin,behandlung.mailTyp, {
      student_id: params.studentId,
      student_name: name || undefined,
      original_datum: params.originalStart.toISOString(),
      grund: params.grund ?? undefined,
      vorschlaege,
    });
  }

  await sendEmailNow(admin,"ausfall_admin", {
    student_id: params.studentId,
    student_name: name || undefined,
    original_datum: params.originalStart.toISOString(),
    grund: params.grund ?? undefined,
    kurzfristig,
  });

  return { ausfallId: ausfall.id, behandlung, vorschlaege };
}

/**
 * Stufe 3: Laufzeit verlängern, weil kein Ausweichtermin zustande kam.
 *
 * Wird auch aufgerufen, wenn der Schüler alle Vorschläge ablehnt. Die
 * Verlängerung wird protokolliert, damit sie nachvollziehbar bleibt und bei
 * Bedarf zurückgerechnet werden kann.
 */
export async function gewaehreGutschrift(
  admin: SupabaseClient,
  params: {
    ausfallId: string;
    studentId: string;
    packageId: string | null;
    originalStart: Date;
    studentName?: string;
  }
): Promise<{ tage: number; neuesAblaufdatum: string | null } | { error: string }> {
  let tage = 7;
  let neuesAblaufdatum: string | null = null;

  if (params.packageId) {
    const { data: pkg } = await admin
      .from("packages")
      .select("id, expires_at, rhythmus, paused, pause_remaining_seconds")
      .eq("id", params.packageId)
      .maybeSingle();

    if (pkg) {
      tage = gutschriftTage(pkg.rhythmus);

      if (pkg.paused && pkg.pause_remaining_seconds != null) {
        // Während einer Pause wächst die eingefrorene Restzeit, nicht das
        // Ablaufdatum – sonst ginge die Gutschrift beim Fortsetzen verloren.
        await admin
          .from("packages")
          .update({
            pause_remaining_seconds:
              Number(pkg.pause_remaining_seconds) + tage * 86400,
          })
          .eq("id", pkg.id);
      } else if (pkg.expires_at) {
        const neu = new Date(
          new Date(pkg.expires_at).getTime() + tage * 86400000
        );
        neuesAblaufdatum = neu.toISOString();
        await admin
          .from("packages")
          .update({ expires_at: neu.toISOString() })
          .eq("id", pkg.id);
      }

      // Protokoll, damit die Verlängerung nachvollziehbar bleibt und bei
      // Bedarf zurückgerechnet werden kann.
      await admin.from("package_extensions").insert({
        package_id: pkg.id,
        new_valid_until:
          neuesAblaufdatum ??
          pkg.expires_at ??
          new Date(Date.now() + tage * 86400000).toISOString(),
        reason: `Ausgefallene Lektion vom ${params.originalStart
          .toISOString()
          .slice(0, 10)} – kein Ausweichtermin möglich (+${tage} Tage)`,
      });
    }
  }

  await admin
    .from("lesson_ausfaelle")
    .update({
      status: "gutschrift",
      gutschrift_tage: tage,
      erledigt_am: new Date().toISOString(),
    })
    .eq("id", params.ausfallId);

  await sendEmailNow(admin,"ausfall_gutschrift", {
    student_id: params.studentId,
    student_name: params.studentName,
    original_datum: params.originalStart.toISOString(),
    tage,
    neues_ablaufdatum: neuesAblaufdatum,
  });

  return { tage, neuesAblaufdatum };
}
