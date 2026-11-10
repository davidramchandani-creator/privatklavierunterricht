"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email-sender";
import { renderEmail } from "@/lib/email-templates";
import { PLATZSTATUS_TAG } from "@/lib/platzstatus-server";
import { ladeStudioAdresse } from "@/lib/studio";
import { inhaberTeacherId } from "@/lib/lehrperson-kontext";
import { istGanztaegig } from "@/lib/booking-server";
import { zonedToUtc } from "@/lib/booking";
import {
  deleteProbelektionEvent,
  syncProbelektionToCalendar,
} from "@/lib/google-calendar";
import {
  pruefeProbelektion,
  ueberschneidungen,
  type Belegung,
  type ProbelektionEingabe,
} from "@/lib/probelektion";

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
  revalidatePath("/admin/anfragen");
  revalidatePath("/admin/kalender");
  updateTag(PLATZSTATUS_TAG);
}

const fmtZeit = (d: Date) =>
  new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" }).format(d);

/** Was zur gleichen Zeit schon in Davids Kalender steht. */
async function belegungen(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  start: Date,
  ende: Date
): Promise<Belegung[]> {
  const inhaber = await inhaberTeacherId(admin);
  const von = new Date(start.getTime() - 86_400_000).toISOString();
  const bis = new Date(ende.getTime() + 86_400_000).toISOString();
  const tag = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(d);

  let lektionen = admin
    .from("appointments")
    .select("start_at, end_at, profiles(vorname, nachname)")
    .in("status", ["booked", "pending"])
    .gte("start_at", von)
    .lte("start_at", bis);
  let probe = admin
    .from("probelektionen")
    .select("start_at, end_at, vorname, nachname")
    .eq("status", "geplant")
    .gte("start_at", von)
    .lte("start_at", bis);
  let sperren = admin
    .from("time_blocks")
    .select("date, start_time, end_time, title, quelle")
    .gte("date", tag(start))
    .lte("date", tag(ende));
  if (inhaber) {
    lektionen = lektionen.eq("teacher_id", inhaber);
    probe = probe.eq("teacher_id", inhaber);
    sperren = sperren.eq("teacher_id", inhaber);
  }
  const [l, p, s] = await Promise.all([lektionen, probe, sperren]);

  const aus: Belegung[] = [];
  for (const a of (l.data ?? []) as Array<{ start_at: string; end_at: string; profiles: unknown }>) {
    const prof = (Array.isArray(a.profiles) ? a.profiles[0] : a.profiles) as
      | { vorname?: string; nachname?: string }
      | null;
    aus.push({
      start: new Date(a.start_at),
      ende: new Date(a.end_at),
      was: `Lektion ${prof?.vorname ?? ""} ${prof?.nachname ?? ""}`.trim(),
    });
  }
  for (const a of (p.data ?? []) as Array<{ start_at: string; end_at: string; vorname: string; nachname: string }>) {
    aus.push({
      start: new Date(a.start_at),
      ende: new Date(a.end_at),
      was: `Probelektion ${a.vorname} ${a.nachname}`.trim(),
    });
  }
  for (const b of (s.data ?? []) as Array<{
    date: string;
    start_time: string;
    end_time: string;
    title: string | null;
    quelle: string | null;
  }>) {
    if (b.quelle === "apple" && istGanztaegig(b)) continue;
    const [y, m, d] = b.date.split("-").map(Number);
    const [sh, sm] = b.start_time.split(":").map(Number);
    const [eh, em] = b.end_time.split(":").map(Number);
    aus.push({
      start: zonedToUtc(y, m, d, sh, sm),
      ende: zonedToUtc(y, m, d, eh, em),
      was: b.title ? `Sperre „${b.title}“` : "Sperre",
    });
  }
  return ueberschneidungen(start, ende, aus);
}

export type ProbelektionErgebnis =
  | { ok: true; mail: "gesendet" | "keine" | "fehlgeschlagen" }
  | { ok: false; fehler: string; konflikte?: string[] };

/**
 * Probelektion eintragen. Überschneidet sie sich mit etwas, wird zuerst
 * nachgefragt (`trotzdem`), denn David trägt manchmal bewusst etwas ein,
 * das er im Apple-Kalender schon notiert hat.
 */
export async function probelektionEintragen(
  eingabe: ProbelektionEingabe & { anfrageId?: string | null; trotzdem?: boolean }
): Promise<ProbelektionErgebnis> {
  const verboten = await assertAdmin();
  if (verboten) return { ok: false, fehler: verboten.error };

  const geprueft = pruefeProbelektion(eingabe);
  if (!geprueft.ok) return { ok: false, fehler: geprueft.fehler };

  const admin = await createAdminClient();

  if (!eingabe.trotzdem) {
    const konflikte = await belegungen(admin, geprueft.start, geprueft.ende);
    if (konflikte.length > 0) {
      return {
        ok: false,
        fehler: "Zu dieser Zeit ist schon etwas eingetragen.",
        konflikte: konflikte.map((k) => `${k.was}, ${fmtZeit(k.start)} bis ${fmtZeit(k.ende)}`),
      };
    }
  }

  const supabase = await createClient();
  const { data: neu, error } = await supabase
    .from("probelektionen")
    .insert({
      anfrage_id: eingabe.anfrageId || null,
      vorname: eingabe.vorname.trim(),
      nachname: eingabe.nachname.trim(),
      email: eingabe.email.trim() || null,
      telefon: eingabe.telefon.trim() || null,
      start_at: geprueft.start.toISOString(),
      end_at: geprueft.ende.toISOString(),
      notiz: eingabe.notiz.trim() || null,
    })
    .select("id")
    .single();
  if (error || !neu) return { ok: false, fehler: "Die Probelektion konnte nicht gespeichert werden." };

  if (eingabe.anfrageId) {
    await supabase.from("anfragen").update({ status: "bearbeitet" }).eq("id", eingabe.anfrageId);
  }

  await syncProbelektionToCalendar(admin, neu.id);

  let mail: "gesendet" | "keine" | "fehlgeschlagen" = "keine";
  if (eingabe.mailSenden && eingabe.email.trim()) {
    const vorlage = renderEmail("probelektion_bestaetigt", {
      vorname: eingabe.vorname.trim(),
      start_at: geprueft.start.toISOString(),
      minuten: Math.round((geprueft.ende.getTime() - geprueft.start.getTime()) / 60_000),
      ort: await ladeStudioAdresse(admin),
    });
    if (vorlage) {
      const r = await sendEmail({
        to: eingabe.email.trim(),
        subject: vorlage.subject,
        html: vorlage.html,
      }).then(
        () => true,
        () => false
      );
      mail = r ? "gesendet" : "fehlgeschlagen";
      if (r) {
        await supabase
          .from("probelektionen")
          .update({ mail_gesendet_am: new Date().toISOString() })
          .eq("id", neu.id);
      }
    }
  }

  neuLaden();
  return { ok: true, mail };
}

/** Probelektion absagen: Zeit wird wieder frei, Google-Eintrag verschwindet. */
export async function probelektionAbsagen(id: string): Promise<{ ok: boolean; fehler?: string }> {
  const verboten = await assertAdmin();
  if (verboten) return { ok: false, fehler: verboten.error };

  const supabase = await createClient();
  const { error } = await supabase.from("probelektionen").update({ status: "abgesagt" }).eq("id", id);
  if (error) return { ok: false, fehler: "Konnte nicht abgesagt werden." };

  const admin = await createAdminClient();
  await deleteProbelektionEvent(admin, id);
  neuLaden();
  return { ok: true };
}
