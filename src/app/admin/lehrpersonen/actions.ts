"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { BASIS_URL } from "@/lib/seo";
import { geocode } from "@/lib/geocoding";
import { LEHRPERSONEN_TAG } from "@/lib/lehrpersonen-server";
import { pruefeLehrperson } from "@/lib/lehrpersonen";

/**
 * Lehrpersonen verwalten. Nur David (Admin). Jede Änderung landet über
 * den Datenbank-Trigger im Änderungsprotokoll.
 */
async function assertAdmin(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const { data: istAdmin } = await supabase.rpc("is_admin");
  if (istAdmin !== true) return { error: "Keine Berechtigung." };
  return null;
}

function fertig(id?: string) {
  updateTag(LEHRPERSONEN_TAG);
  revalidatePath("/admin/lehrpersonen");
  if (id) revalidatePath(`/admin/lehrpersonen/${id}`);
  revalidatePath("/lehrpersonen");
  revalidatePath("/");
}

async function startpunktKoordinaten(adresse: string | null) {
  if (!adresse) return { startpunkt_lat: null, startpunkt_lng: null };
  const t = await geocode(adresse).catch(() => null);
  return { startpunkt_lat: t?.lat ?? null, startpunkt_lng: t?.lng ?? null };
}

/**
 * Neue Lehrperson mit Login. Sie bekommt eine Einladung per Mail und
 * setzt ihr Passwort selbst, wie die Schüler.
 */
export async function lehrpersonAnlegen(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const geprueft = pruefeLehrperson(formData);
  if (!geprueft.ok) return { error: geprueft.fehler };
  const d = geprueft.daten;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telefon = String(formData.get("telefon") ?? "").trim() || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Bitte eine gültige E-Mail angeben." };

  const admin = createAdminClient();
  const { data: einladung, error: fehler } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { vorname: d.vorname, nachname: d.nachname },
    redirectTo: `${BASIS_URL}/auth/callback?next=/auth/passwort-setzen`,
  });
  if (fehler || !einladung?.user) {
    return { error: fehler?.message ?? "Die Einladung konnte nicht verschickt werden." };
  }
  const userId = einladung.user.id;

  // Das Profil legt der Datenbank-Trigger als Schüler an. Hier wird es zur
  // Lehrperson: andere Rolle, keine Lehrperson-Zuordnung als Schüler.
  const { error: pFehler } = await admin
    .from("profiles")
    .upsert(
      { id: userId, role: "lehrperson", vorname: d.vorname, nachname: d.nachname, email, telefon, teacher_id: null, aktiv: true },
      { onConflict: "id" }
    );
  if (pFehler) return { error: "Profil: " + pFehler.message };
  await admin.from("profile_roles").upsert({ user_id: userId, role: "lehrperson" }, { onConflict: "user_id" });

  const koordinaten = await startpunktKoordinaten(d.startpunkt_adresse);
  const { data: lp, error: tFehler } = await admin
    .from("teachers")
    .insert({ ...d, ...koordinaten, profile_id: userId, status: "aktiv" })
    .select("id")
    .single();
  if (tFehler || !lp) return { error: "Lehrperson: " + (tFehler?.message ?? "unbekannt") };

  fertig(lp.id);
  return { success: true as const, id: lp.id as string };
}

export async function lehrpersonSpeichern(id: string, formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const geprueft = pruefeLehrperson(formData);
  if (!geprueft.ok) return { error: geprueft.fehler };
  const d = geprueft.daten;

  const admin = createAdminClient();
  const { data: alt } = await admin.from("teachers").select("startpunkt_adresse").eq("id", id).maybeSingle();
  const koordinaten =
    alt?.startpunkt_adresse === d.startpunkt_adresse ? {} : await startpunktKoordinaten(d.startpunkt_adresse);

  const { error } = await admin
    .from("teachers")
    .update({ ...d, ...koordinaten, aktualisiert_am: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  fertig(id);
  return { success: true as const, startpunktGefunden: "startpunkt_lat" in koordinaten ? koordinaten.startpunkt_lat !== null : undefined };
}

/** Text direkt veröffentlichen (David schreibt oder ändert ihn selbst). */
export async function kurztextVeroeffentlichen(id: string, text: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const sauber = text.trim().slice(0, 1200);
  const admin = createAdminClient();
  const { error } = await admin
    .from("teachers")
    .update({
      kurztext: sauber || null,
      kurztext_freigegeben_am: sauber ? new Date().toISOString() : null,
      kurztext_entwurf: null,
      kurztext_eingereicht_am: null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  fertig(id);
  return { success: true as const };
}

/** Den von der Lehrperson eingereichten Entwurf freigeben oder verwerfen. */
export async function entwurfEntscheiden(id: string, freigeben: boolean) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = createAdminClient();
  const { data: lp } = await admin.from("teachers").select("kurztext_entwurf").eq("id", id).maybeSingle();
  if (!lp?.kurztext_entwurf) return { error: "Es liegt kein Entwurf vor." };
  const { error } = await admin
    .from("teachers")
    .update(
      freigeben
        ? {
            kurztext: lp.kurztext_entwurf,
            kurztext_freigegeben_am: new Date().toISOString(),
            kurztext_entwurf: null,
            kurztext_eingereicht_am: null,
          }
        : { kurztext_entwurf: null, kurztext_eingereicht_am: null }
    )
    .eq("id", id);
  if (error) return { error: error.message };
  fertig(id);
  return { success: true as const };
}

/**
 * Aktiv oder inaktiv. Inaktiv heisst: nicht mehr auf der Webseite und
 * keine neuen Anfragen. Das Login wird gesperrt (ban), Daten bleiben.
 */
export async function lehrpersonStatus(id: string, aktiv: boolean) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = createAdminClient();
  const { data: lp } = await admin.from("teachers").select("profile_id, ist_inhaber").eq("id", id).maybeSingle();
  if (!lp) return { error: "Lehrperson nicht gefunden." };
  if (lp.ist_inhaber && !aktiv) return { error: "Dich selbst kannst du nicht deaktivieren." };

  const { error } = await admin.from("teachers").update({ status: aktiv ? "aktiv" : "inaktiv" }).eq("id", id);
  if (error) return { error: error.message };
  if (lp.profile_id && !lp.ist_inhaber) {
    await admin.auth.admin.updateUserById(lp.profile_id, { ban_duration: aktiv ? "none" : "876000h" });
  }
  fertig(id);
  return { success: true as const };
}

/** Foto hochladen (JPG, PNG oder WebP, höchstens 3 MB). */
export async function fotoHochladen(id: string, formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const datei = formData.get("foto");
  if (!(datei instanceof File) || datei.size === 0) return { error: "Bitte ein Foto auswählen." };
  if (datei.size > 3 * 1024 * 1024) return { error: "Das Foto ist grösser als 3 MB." };
  const endung = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[datei.type];
  if (!endung) return { error: "Bitte ein JPG, PNG oder WebP." };

  const admin = createAdminClient();
  const pfad = `${id}/${Date.now()}.${endung}`;
  const { error } = await admin.storage
    .from("lehrpersonen")
    .upload(pfad, Buffer.from(await datei.arrayBuffer()), { contentType: datei.type, upsert: false });
  if (error) return { error: error.message };
  const { data } = admin.storage.from("lehrpersonen").getPublicUrl(pfad);
  const { error: uFehler } = await admin.from("teachers").update({ foto_url: data.publicUrl }).eq("id", id);
  if (uFehler) return { error: uFehler.message };
  fertig(id);
  return { success: true as const };
}

// ── Leitbild ─────────────────────────────────────────────────

export async function leitbildVeroeffentlichen(titel: string, inhalt: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const text = inhalt.trim();
  if (text.length < 20) return { error: "Das Leitbild ist zu kurz." };
  const admin = createAdminClient();
  const { data: letzte } = await admin
    .from("leitbild_versionen")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await admin.from("leitbild_versionen").insert({
    version: (letzte?.version ?? 0) + 1,
    titel: titel.trim() || "Leitbild",
    inhalt: text,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/leitbild");
  revalidatePath("/lehrperson");
  return { success: true as const };
}
