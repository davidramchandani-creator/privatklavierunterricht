"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { ladeAbrechnung, ladeJahr } from "@/lib/abrechnung-server";
import { ladePrognose } from "@/lib/prognose-server";
import type { Monatsprognose } from "@/lib/prognose";
import {
  markiereExternBezahlt,
  widerrufeExterneZahlung,
} from "@/lib/externe-zahlungen";
import {
  alsCsv,
  AUSGABE_KATEGORIEN,
  type AusgabeKategorie,
  type Monatsabrechnung,
} from "@/lib/abrechnung";

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

export async function abrechnungHolen(
  monat: string
): Promise<
  { abrechnung: Monatsabrechnung; prognose: Monatsprognose } | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const abrechnung = await ladeAbrechnung(admin, monat);
  // Die Prognose baut auf der Abrechnung auf: Der belegte Topf ist genau
  // deren Total, doppelt laden wäre unnötig.
  const prognose = await ladePrognose(admin, monat, abrechnung);
  return { abrechnung, prognose };
}

export async function ausgabeErfassen(formData: FormData): Promise<
  { success: true; error: undefined } | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const datum = String(formData.get("datum") ?? "").trim();
  const kategorie = String(formData.get("kategorie") ?? "").trim();
  const betragRoh = String(formData.get("betrag") ?? "").replace(",", ".");
  const notiz = String(formData.get("notiz") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return { error: "Bitte ein Datum wählen." };
  }
  if (!AUSGABE_KATEGORIEN.includes(kategorie as AusgabeKategorie)) {
    return { error: "Unbekannte Kategorie." };
  }
  const betrag = Number(betragRoh);
  if (!Number.isFinite(betrag) || betrag <= 0) {
    return { error: "Bitte einen Betrag grösser als null angeben." };
  }
  // Ein Vertipper bei der Kommastelle fällt sonst erst in der
  // Steuererklärung auf, und dann ist der Beleg längst weg.
  if (betrag > 10000) {
    return { error: "Über CHF 10'000 — bitte prüfen und sonst aufteilen." };
  }

  const admin = await createAdminClient();
  const { error } = await admin.from("betriebsausgaben").insert({
    datum,
    kategorie,
    betrag,
    notiz: notiz || null,
  });
  if (error) return { error: "Die Ausgabe liess sich nicht speichern." };

  revalidatePath("/admin/abrechnung");
  return { success: true, error: undefined };
}

export async function ausgabeLoeschen(
  id: string
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { error } = await admin.from("betriebsausgaben").delete().eq("id", id);
  if (error) return { error: "Die Ausgabe liess sich nicht löschen." };

  revalidatePath("/admin/abrechnung");
  return { success: true, error: undefined };
}

/**
 * Monat als erledigt markieren.
 *
 * Das schaltet die Erinnerung für diesen Monat ab. Bewusst ein eigener
 * Klick und nicht „sobald eine Ausgabe da ist": Ein einzelner Tankbeleg
 * heisst nicht, dass der Monat fertig ist.
 */
export async function monatAbschliessen(
  monat: string,
  erfasst: boolean
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  if (!/^\d{4}-\d{2}$/.test(monat)) return { error: "Ungültiger Monat." };

  const admin = await createAdminClient();
  const { error } = await admin.from("monatsabschluss").upsert(
    { monat: `${monat}-01`, ausgaben_erfasst: erfasst },
    { onConflict: "monat" }
  );
  if (error) return { error: "Der Status liess sich nicht speichern." };

  revalidatePath("/admin/abrechnung");
  return { success: true, error: undefined };
}

/**
 * Externe Lektion als bezahlt erfassen.
 *
 * Der Gegenpart zu „Zahlung bestätigen" bei den eigenen Rechnungen — nur
 * ohne Rechnung und ohne Mail. Externe Schüler bekommen nie Post; hier
 * wird nur festgehalten, was von der Plattform angekommen ist.
 */
export async function externBezahlt(
  appointmentId: string,
  betrag?: number
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const res = await markiereExternBezahlt(admin, { appointmentId, betrag });
  if ("error" in res) return { error: res.error };

  revalidatePath("/admin/zahlungen");
  revalidatePath("/admin/abrechnung");
  revalidatePath("/admin");
  return { success: true, error: undefined };
}

/** Bestätigung zurücknehmen. */
export async function externZahlungWiderrufen(
  appointmentId: string
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const res = await widerrufeExterneZahlung(admin, appointmentId);
  if ("error" in res) return { error: res.error };

  revalidatePath("/admin/zahlungen");
  revalidatePath("/admin/abrechnung");
  revalidatePath("/admin");
  return { success: true, error: undefined };
}

/** Ganzes Jahr als CSV, für die Steuererklärung oder den Treuhänder. */
export async function jahrAlsCsv(
  jahr: number
): Promise<{ csv: string; dateiname: string } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const monate = await ladeJahr(admin, jahr);
  return {
    csv: alsCsv(monate),
    dateiname: `Klavierunterricht-${jahr}.csv`,
  };
}
