"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  type CalDate,
  DEFAULT_BUFFER_MIN,
  addDaysCal,
  utcToZonedDate,
  weekdayOf,
  zonedToUtc,
} from "@/lib/booking";
import { loadAvailabilityContext } from "@/lib/booking-server";
import { gapAwareSlots, DEFAULT_BLOCK_SETTINGS } from "@/lib/booking-gap";
import { sendEmail } from "@/lib/email-sender";
import { renderEmail } from "@/lib/email-templates";
import { dispatchPush } from "@/lib/email-dispatch";

export type PublicSlot = {
  beginn: string;
  ende: string;
};

export async function getPublicSlots(weekOffset: number): Promise<PublicSlot[]> {
  const admin = await createAdminClient();
  const now = new Date();

  // Montag der Zielwoche (Zürcher Kalenderdatum)
  const todayCal = utcToZonedDate(now);
  const w = weekdayOf(todayCal); // 0=So … 6=Sa
  const mondayOffset = w === 0 ? -6 : 1 - w;
  const fromCal: CalDate = addDaysCal(todayCal, mondayOffset + weekOffset * 7);

  const fromInstant = zonedToUtc(fromCal.y, fromCal.m, fromCal.d, 0, 0);
  const toInstant = new Date(fromInstant.getTime() + 7 * 86400000);

  // Kein eingeloggter Schüler → leere studentId; Puffer = Default (15 Min)
  const ctx = await loadAvailabilityContext(
    admin,
    "",
    DEFAULT_BUFFER_MIN,
    fromInstant,
    toInstant,
    now
  );

  const settings =
    (ctx as { blockSettings?: typeof DEFAULT_BLOCK_SETTINGS }).blockSettings ??
    DEFAULT_BLOCK_SETTINGS;

  return gapAwareSlots(fromCal, 7, ctx, settings).map((s) => ({
    beginn: s.start.toISOString(),
    ende: s.end.toISOString(),
  }));
}

/**
 * Nächster freier Termin (für Hero/Marketing). Sucht vier Wochen voraus.
 *
 * Bewusst **ein** Kontext für den ganzen Zeitraum statt vier für je eine
 * Woche. Vorher lief die Schleife Woche für Woche und lud jedes Mal alles
 * neu — Termine, Abwesenheiten, Sperren, Regeln, Verfügbarkeit. Das waren
 * vier Runden à sieben Abfragen, nur um am Ende meist den ersten Slot der
 * ersten Woche zurückzugeben. Auf der Startseite lag das komplett vor dem
 * ersten Byte.
 */
export async function getNextPublicSlot(): Promise<PublicSlot | null> {
  const admin = await createAdminClient();
  const now = new Date();
  const todayCal = utcToZonedDate(now);

  const w = weekdayOf(todayCal);
  const mondayOffset = w === 0 ? -6 : 1 - w;
  const fromCal: CalDate = addDaysCal(todayCal, mondayOffset);
  const fromInstant = zonedToUtc(fromCal.y, fromCal.m, fromCal.d, 0, 0);
  const TAGE = 28;
  const toInstant = new Date(fromInstant.getTime() + TAGE * 86400000);

  const ctx = await loadAvailabilityContext(
    admin,
    "",
    DEFAULT_BUFFER_MIN,
    fromInstant,
    toInstant,
    now
  );

  const settings =
    (ctx as { blockSettings?: typeof DEFAULT_BLOCK_SETTINGS }).blockSettings ??
    DEFAULT_BLOCK_SETTINGS;

  const slots = gapAwareSlots(fromCal, TAGE, ctx, settings)
    .filter((s) => s.start.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (slots.length === 0) return null;
  return {
    beginn: slots[0].start.toISOString(),
    ende: slots[0].end.toISOString(),
  };
}

export async function submitAnfrage(formData: FormData) {
  const vorname = (formData.get("vorname") as string)?.trim();
  const nachname = (formData.get("nachname") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const telefon = (formData.get("telefon") as string)?.trim() || null;
  const nachricht = (formData.get("nachricht") as string)?.trim();
  const wunschtermin = (formData.get("wunschtermin") as string) || null;

  if (!vorname || !nachname || !email) {
    return { error: "Bitte Vor- und Nachname sowie E-Mail angeben." };
  }
  // Die Nachricht ist Pflicht: Ohne sie steht David vor einer Anfrage, bei
  // der er nicht weiss, ob es um ein sechsjähriges Kind oder einen
  // Wiedereinsteiger geht, und muss erst zurückfragen, bevor er antworten
  // kann. Das Pflichtfeld im Formular allein genügt nicht, es lässt sich
  // abschalten.
  if (!nachricht) {
    return { error: "Bitte schreib kurz, worum es geht." };
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

  const mailPayload = { vorname, nachname, email, telefon, nachricht, wunschtermin };

  // Bestätigungs-Mail an den Anfragenden.
  const confirmTpl = renderEmail("anfrage_received", mailPayload);
  if (confirmTpl) {
    await sendEmail({ to: email, subject: confirmTpl.subject, html: confirmTpl.html }).catch(
      () => null
    );
  }

  // Benachrichtigungs-Mail an den Admin.
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const adminTpl = renderEmail("anfrage_admin", mailPayload);
    if (adminTpl) {
      await sendEmail({ to: adminEmail, subject: adminTpl.subject, html: adminTpl.html }).catch(
        () => null
      );
    }
  }

  // Push an den Admin (zusätzlich zur Mail).
  const adminClient = await createAdminClient();
  await dispatchPush(adminClient, "anfrage_admin", {
    ...mailPayload,
    quelle: "probelektion",
  });

  return { success: true };
}
