"use server";

import { createClient } from "@/lib/supabase/server";

export type PublicSlot = {
  beginn: string;
  ende: string;
};

export async function getPublicSlots(weekOffset: number): Promise<PublicSlot[]> {
  const supabase = await createClient();

  const { data: verfuegbarkeit } = await supabase
    .from("admin_verfuegbarkeit")
    .select("wochentag, beginn_zeit, ende_zeit")
    .eq("aktiv", true);

  if (!verfuegbarkeit || verfuegbarkeit.length === 0) return [];

  const now = new Date();
  const monday = getMonday(now, weekOffset);
  const sunday = new Date(monday.getTime() + 7 * 86400000);

  const { data: booked } = await supabase
    .from("termine")
    .select("beginn")
    .neq("status", "storniert")
    .gte("beginn", monday.toISOString())
    .lt("beginn", sunday.toISOString());

  // Also exclude slots already requested via anfragen
  const { data: requested } = await supabase
    .from("anfragen")
    .select("wunschtermin")
    .eq("status", "neu")
    .gte("wunschtermin", monday.toISOString())
    .lt("wunschtermin", sunday.toISOString());

  const bookedSet = new Set([
    ...(booked?.map((t) => t.beginn) ?? []),
    ...(requested?.map((a) => a.wunschtermin).filter(Boolean) ?? []),
  ]);

  const slots: PublicSlot[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const date = new Date(monday.getTime() + dayIndex * 86400000);
    const jsDay = date.getDay();
    const daySlots = verfuegbarkeit.filter((v) => v.wochentag === jsDay);

    for (const v of daySlots) {
      const [beginH, beginM] = v.beginn_zeit.split(":").map(Number);
      const [endH, endM] = v.ende_zeit.split(":").map(Number);
      const windowStart = new Date(date);
      windowStart.setHours(beginH, beginM, 0, 0);
      const windowEnd = new Date(date);
      windowEnd.setHours(endH, endM, 0, 0);

      let slotStart = new Date(windowStart);
      while (slotStart.getTime() + 45 * 60000 <= windowEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + 45 * 60000);
        if (slotStart > now && !bookedSet.has(slotStart.toISOString())) {
          slots.push({ beginn: slotStart.toISOString(), ende: slotEnd.toISOString() });
        }
        slotStart = slotEnd;
      }
    }
  }
  return slots;
}

export async function submitAnfrage(formData: FormData) {
  const vorname = (formData.get("vorname") as string)?.trim();
  const nachname = (formData.get("nachname") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const telefon = (formData.get("telefon") as string)?.trim() || null;
  const nachricht = (formData.get("nachricht") as string)?.trim() || null;
  const wunschtermin = (formData.get("wunschtermin") as string) || null;

  if (!vorname || !nachname || !email) {
    return { error: "Bitte Vor- und Nachname sowie E-Mail angeben." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Ungültige E-Mail-Adresse." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("anfragen").insert({
    vorname,
    nachname,
    email,
    telefon,
    nachricht,
    wunschtermin: wunschtermin || null,
  });

  if (error) return { error: "Anfrage konnte nicht gesendet werden. Bitte versuche es erneut." };
  return { success: true };
}

function getMonday(date: Date, offset: number): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
