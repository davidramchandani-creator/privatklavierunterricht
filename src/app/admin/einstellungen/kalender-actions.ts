"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { BASIS_URL } from "@/lib/seo";
import { adminToken, adminTokenZuruecksetzen } from "@/lib/kalender-feed-server";

/**
 * Der Admin-Feed enthält alle Schüler mit Adresse. Die Rollenprüfung ist
 * hier keine Formsache: Wer diese Adresse bekommt, sieht, wo jedes Kind
 * wohnt und wann David dort ist.
 */
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

export async function adminKalenderLinkHolen(): Promise<{ url: string } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = await createAdminClient();
  const token = await adminToken(admin);
  return { url: `${BASIS_URL}/api/kalender/${token}` };
}

export async function adminKalenderLinkZuruecksetzen(): Promise<{ url: string } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = await createAdminClient();
  const token = await adminTokenZuruecksetzen(admin);
  return { url: `${BASIS_URL}/api/kalender/${token}` };
}
