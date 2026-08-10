"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";

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

export async function ferienAnlegen(
  formData: FormData
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const bezeichnung = String(formData.get("bezeichnung") ?? "").trim();
  const start = String(formData.get("start_datum") ?? "");
  const ende = String(formData.get("end_datum") ?? "");

  if (!bezeichnung) return { error: "Bitte eine Bezeichnung angeben." };
  if (!start || !ende) return { error: "Bitte Start- und Enddatum angeben." };
  if (ende < start) return { error: "Das Ende liegt vor dem Beginn." };

  const admin = await createAdminClient();
  const { error } = await admin
    .from("schulferien")
    .insert({ bezeichnung, start_datum: start, end_datum: ende });

  if (error) return { error: "Der Zeitraum konnte nicht gespeichert werden." };

  revalidatePath("/admin/schulferien");
  return { success: true, error: undefined };
}

export async function ferienLoeschen(
  id: string
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();

  // Warnen statt blockieren: Abos, die diesen Zeitraum bereits eingerechnet
  // haben, ändern sich rückwirkend nicht. Ihre Lektionszahl steht fest.
  const { error } = await admin.from("schulferien").delete().eq("id", id);
  if (error) return { error: "Der Zeitraum konnte nicht gelöscht werden." };

  revalidatePath("/admin/schulferien");
  return { success: true, error: undefined };
}
