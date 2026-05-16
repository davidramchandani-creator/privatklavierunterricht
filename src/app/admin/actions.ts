"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendInviteEmail, sendPasswordResetEmail } from "@/lib/email";

// ── Schüler ──────────────────────────────────────────────────────────────────

export async function inviteSchueler(formData: FormData) {
  const email = formData.get("email") as string;
  const vorname = formData.get("vorname") as string;
  const nachname = formData.get("nachname") as string;
  const telefon = (formData.get("telefon") as string) || null;
  const adresse = (formData.get("adresse") as string) || null;

  if (!email || !vorname || !nachname) {
    return { error: "E-Mail, Vorname und Nachname sind Pflichtfelder." };
  }

  const adminClient = await createAdminClient();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://privatklavierunterricht.vercel.app";

  // Generate invite link (bypasses PKCE — works across any browser/device)
  const { data: linkData, error: inviteError } =
    await adminClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { vorname, nachname },
        redirectTo: `${appUrl}/auth/callback?next=/auth/passwort-setzen`,
      },
    });

  if (inviteError) {
    return { error: inviteError.message };
  }

  const inviteData = { user: linkData.user };
  const inviteLink = linkData.properties.action_link;

  try {
    await sendInviteEmail(email, vorname, inviteLink);
  } catch (e) {
    return { error: "Schüler erstellt, aber E-Mail konnte nicht gesendet werden: " + (e as Error).message };
  }

  const userId = inviteData.user.id;

  // Set role
  const { error: roleError } = await adminClient.from("profile_roles").insert({
    user_id: userId,
    role: "schueler",
  });
  if (roleError) {
    return { error: "Rolle konnte nicht gesetzt werden: " + roleError.message };
  }

  // Create schueler record
  const { error: schuelerError } = await adminClient.from("schueler").insert({
    user_id: userId,
    vorname,
    nachname,
    email,
    telefon,
    adresse,
    aktiv: true,
  });

  if (schuelerError) {
    return { error: "Schüler-Datensatz konnte nicht erstellt werden: " + schuelerError.message };
  }

  revalidatePath("/admin/schueler");
  return { success: true };
}

export async function updateSchueler(id: string, formData: FormData) {
  const supabase = await createClient();

  const vorname = formData.get("vorname") as string;
  const nachname = formData.get("nachname") as string;
  const email = formData.get("email") as string;
  const telefon = (formData.get("telefon") as string) || null;
  const adresse = (formData.get("adresse") as string) || null;
  const notizen = (formData.get("notizen") as string) || null;

  const { error } = await supabase
    .from("schueler")
    .update({ vorname, nachname, email, telefon, adresse, notizen })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${id}`);
  revalidatePath("/admin/schueler");
  return { success: true };
}

export async function deleteSchueler(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("schueler").update({ aktiv: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/schueler");
  revalidatePath(`/admin/schueler/${id}`);
  return { success: true };
}

export async function reactivateSchueler(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("schueler").update({ aktiv: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/schueler");
  revalidatePath(`/admin/schueler/${id}`);
  return { success: true };
}

export async function hardDeleteSchueler(id: string) {
  const adminClient = await createAdminClient();

  // Get user_id before deleting
  const { data: schueler } = await adminClient
    .from("schueler")
    .select("user_id")
    .eq("id", id)
    .single();

  // Delete schueler record (cascades to pakete, termine, zahlungen, bewertungen)
  const { error: schuelerError } = await adminClient
    .from("schueler")
    .delete()
    .eq("id", id);

  if (schuelerError) return { error: schuelerError.message };

  // Delete auth user if linked
  if (schueler?.user_id) {
    await adminClient.auth.admin.deleteUser(schueler.user_id);
  }

  revalidatePath("/admin/schueler");
  return { success: true };
}

export async function resendInvite(email: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://privatklavierunterricht.vercel.app";
  const adminClient = await createAdminClient();

  // admin.generateLink bypasses PKCE – works across any browser/device
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/auth/passwort-setzen`,
    },
  });

  if (error) return { error: error.message };

  try {
    await sendPasswordResetEmail(email, data.properties.action_link);
  } catch (e) {
    return { error: "Link generiert, aber E-Mail konnte nicht gesendet werden: " + (e as Error).message };
  }

  return { success: true };
}

// ── Pakete ────────────────────────────────────────────────────────────────────

export async function createPaket(formData: FormData) {
  const supabase = await createClient();

  const schueler_id = formData.get("schueler_id") as string;
  const typ = formData.get("typ") as string;
  const lektionen_gesamt = parseInt(formData.get("lektionen_gesamt") as string);
  const preis_pro_lektion = parseFloat(formData.get("preis_pro_lektion") as string);
  const gueltig_bis = (formData.get("gueltig_bis") as string) || null;

  const { error } = await supabase.from("pakete").insert({
    schueler_id,
    typ,
    lektionen_gesamt,
    lektionen_genutzt: 0,
    preis_pro_lektion,
    aktiv: true,
    gueltig_bis: gueltig_bis ? new Date(gueltig_bis).toISOString() : null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${schueler_id}`);
  return { success: true };
}

export async function updatePaketStatus(id: string, aktiv: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("pakete")
    .update({ aktiv })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/schueler");
  return { success: true };
}

// ── Termine ───────────────────────────────────────────────────────────────────

export async function createTermin(formData: FormData) {
  const supabase = await createClient();

  const schueler_id = formData.get("schueler_id") as string;
  const paket_id = (formData.get("paket_id") as string) || null;
  const beginn = new Date(formData.get("beginn") as string).toISOString();
  const ende = new Date(formData.get("ende") as string).toISOString();
  const notiz = (formData.get("notiz") as string) || null;

  const { error } = await supabase.from("termine").insert({
    schueler_id,
    paket_id,
    beginn,
    ende,
    status: "bestaetigt",
    notiz,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/kalender");
  revalidatePath(`/admin/schueler/${schueler_id}`);
  return { success: true };
}

export async function storniereTerminAdmin(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("termine")
    .update({ status: "storniert" })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  return { success: true };
}

export async function abschliessenTermin(id: string) {
  const supabase = await createClient();

  const { data: termin, error: fetchError } = await supabase
    .from("termine")
    .select("paket_id")
    .eq("id", id)
    .single();

  if (fetchError || !termin) return { error: "Termin nicht gefunden." };

  const { error } = await supabase
    .from("termine")
    .update({ status: "abgeschlossen" })
    .eq("id", id);

  if (error) return { error: error.message };

  if (termin.paket_id) {
    const { data: paket } = await supabase
      .from("pakete")
      .select("lektionen_genutzt")
      .eq("id", termin.paket_id)
      .single();

    if (paket) {
      await supabase
        .from("pakete")
        .update({ lektionen_genutzt: paket.lektionen_genutzt + 1 })
        .eq("id", termin.paket_id);
    }
  }

  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  return { success: true };
}

// ── Zahlungen ─────────────────────────────────────────────────────────────────

export async function updateZahlungStatus(
  id: string,
  status: string,
  bezahlt_am?: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("zahlungen")
    .update({
      status,
      bezahlt_am: bezahlt_am ?? (status === "bezahlt" ? new Date().toISOString().split("T")[0] : null),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/zahlungen");
  revalidatePath("/admin");
  return { success: true };
}

export async function createZahlung(formData: FormData) {
  const supabase = await createClient();

  const schueler_id = formData.get("schueler_id") as string;
  const paket_id = (formData.get("paket_id") as string) || null;
  const betrag = parseFloat(formData.get("betrag") as string);
  const methode = formData.get("methode") as string;
  const faellig_am = formData.get("faellig_am") as string;
  const rechnung_nr = (formData.get("rechnung_nr") as string) || null;

  const { error } = await supabase.from("zahlungen").insert({
    schueler_id,
    paket_id,
    betrag,
    status: "offen",
    methode,
    faellig_am,
    rechnung_nr,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/zahlungen");
  revalidatePath(`/admin/schueler/${schueler_id}`);
  return { success: true };
}

// ── Bewertungen ───────────────────────────────────────────────────────────────

export async function approveBewertung(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("bewertungen")
    .update({ anzeigen: true })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/bewertungen");
  return { success: true };
}

export async function rejectBewertung(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("bewertungen").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/bewertungen");
  return { success: true };
}

// ── Verfügbarkeit ─────────────────────────────────────────────────────────────

export type VerfuegbarkeitSlot = {
  wochentag: number;
  beginn_zeit: string;
  ende_zeit: string;
  aktiv: boolean;
};

export async function updateVerfuegbarkeit(slots: VerfuegbarkeitSlot[]) {
  const supabase = await createClient();

  // Delete all existing
  const { error: deleteError } = await supabase
    .from("admin_verfuegbarkeit")
    .delete()
    .gte("wochentag", 0);

  if (deleteError) return { error: deleteError.message };

  if (slots.length > 0) {
    const { error } = await supabase.from("admin_verfuegbarkeit").insert(slots);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/verfuegbarkeit");
  return { success: true };
}

// ── Preise ────────────────────────────────────────────────────────────────────

export async function updatePreise(formData: FormData) {
  const supabase = await createClient();

  const typen = ["einzellektion", "10er", "20er"] as const;

  for (const typ of typen) {
    const preis = parseFloat(formData.get(typ) as string);
    if (isNaN(preis)) continue;

    // Try to update existing, or insert
    const { data: existing } = await supabase
      .from("preise")
      .select("id")
      .eq("typ", typ)
      .single();

    if (existing) {
      await supabase
        .from("preise")
        .update({ preis_pro_lektion: preis, aktiv: true })
        .eq("id", existing.id);
    } else {
      await supabase.from("preise").insert({
        typ,
        preis_pro_lektion: preis,
        aktiv: true,
      });
    }
  }

  revalidatePath("/admin/preise");
  return { success: true };
}

// ── Anfragen ─────────────────────────────────────────────────────────────────

export async function updateAnfrageStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("anfragen")
    .update({ status })
    .eq("id", id);
  if (error) return { error: "Status konnte nicht aktualisiert werden." };
  revalidatePath("/admin/anfragen");
  return { success: true };
}
