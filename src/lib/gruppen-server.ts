// ============================================================
// Feste Gruppen, Serverseite: Serie prüfen, Gruppe anlegen, Lektion absagen
//
// Eine Gruppe besteht aus einem Eintrag in `gruppen` und pro Mitglied einem
// gewöhnlichen Abo (`packages.gruppe_id`) mit eigenen Terminen
// (`appointments.gruppe_id`). Alle Mitglieder haben dieselben Zeiten.
//
// Bewusst kein Ausweichen: Beim Einzelabo darf ein belegter Termin auf einen
// freien Platz in derselben Woche rutschen. Bei einer Gruppe müsste dieser
// Platz für zwei oder drei Personen passen, und das weiss nur David. Darum
// gilt hier: Entweder ist jeder Termin der Serie frei, oder es wird nichts
// angelegt.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { ABO_LABELS, type AboVariante } from "./abo";
import { baueVorschau, legeMonatsratenAn } from "./abo-server";
import type { AvailabilityContext } from "./booking";
import { loadAvailabilityContext } from "./booking-server";
import { sendEmailNow } from "./emails-outbox";
import {
  describeFixplatz,
  firstSeriesStart,
  fixplatzSeriesStarts,
  pruefeFixplatzSerie,
  type Ferienzeitraum,
  type FixplatzWunsch,
} from "./fixplatz";
import { syncAppointmentToCalendar } from "./google-calendar";
import { gruppenLektionspreis, gruppenMinuten, gruppenNameAus, pruefeMitglieder } from "./gruppen";
import { GRUPPENUNTERRICHT } from "./gruppenunterricht";
import { scheduleLessonReminders } from "./reminders";
import type { Rhythmus } from "./rhythmus";
import { BASIS_URL } from "./seo";

export type GruppenEingabe = {
  mitglieder: string[];
  name?: string | null;
  variante: AboVariante;
  rhythmus: Rhythmus;
  weekday: number;
  time: string;
  parity: 0 | 1 | null;
  periodeStart: string;
  /**
   * Lektionspreis pro Person, wenn David vom Standard abweicht. Ohne Angabe
   * gilt der Gruppenpreis aus lib/gruppenunterricht.
   */
  preisProLektion?: number | null;
  autoRenew: boolean;
  mailsSenden: boolean;
  notiz?: string | null;
  /** Erster möglicher Termin: der Tag vor dem Periodenstart (wie beim Abo). */
  now: Date;
};

/** Jeder Tag, rund um die Uhr: Für Gruppen zählen keine Arbeitszeiten. */
const GANZER_TAG = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((t) => [t, [{ start: "00:00", end: "23:59" }]])
) as NonNullable<AvailabilityContext["availabilityWindows"]>;

type Mitglied = { id: string; vorname: string; nachname: string; payment_method: string | null };

/**
 * Rechnet die gemeinsame Serie durch, ohne etwas zu schreiben.
 *
 * Geprüft wird gegen alles, was Davids Zeit belegt: Termine, Sperren,
 * Abwesenheiten, Probelektionen, Arbeitszeiten. Abwesenheiten einzelner
 * Schüler zählen nicht, die Lektion findet für die anderen trotzdem statt.
 * Wie beim Abo, das David selbst einträgt, zählen nur echte
 * Überschneidungen (keine Pause dazugerechnet).
 */
export async function planeGruppenSerie(
  admin: SupabaseClient,
  params: {
    ersterSchueler: string;
    wunsch: FixplatzWunsch;
    parity: 0 | 1 | null;
    minuten: number;
    now: Date;
  }
): Promise<{ starts: Date[]; belegt: Date[] } | { error: string }> {
  const { wunsch, parity, minuten, now } = params;

  let ersterStart: Date;
  try {
    ersterStart = firstSeriesStart(wunsch, now, parity);
  } catch {
    return { error: "Für diesen Wochentag lässt sich kein Starttermin finden." };
  }

  const { data: ferienRoh } = await admin
    .from("schulferien")
    .select("start_datum, end_datum")
    .gte("end_datum", ersterStart.toISOString().slice(0, 10));
  const ferien: Ferienzeitraum[] = (ferienRoh ?? []).map((f) => ({
    start: String(f.start_datum),
    ende: String(f.end_datum),
  }));

  // Der erste Termin darf nicht in den Ferien liegen (wie beim Einzelabo).
  const tag0 = ersterStart.toISOString().slice(0, 10);
  if (ferien.some((f) => tag0 >= f.start && tag0 <= f.ende)) {
    const spaeter = fixplatzSeriesStarts({ ...wunsch, lessons: 1 }, ersterStart, ferien);
    if (spaeter.length > 0) ersterStart = spaeter[0];
  }

  const starts = fixplatzSeriesStarts(wunsch, ersterStart, ferien);
  if (starts.length === 0) {
    return { error: "Für diesen Wochentag lässt sich kein Starttermin finden." };
  }
  const bis = new Date(starts[starts.length - 1].getTime() + minuten * 60000 + 86400000);

  const ctx = await loadAvailabilityContext(admin, params.ersterSchueler, 0, ersterStart, bis, now, {
    skipLeadTime: true,
    kalenderJetzt: true,
  });
  ctx.bufferMin = 0;
  ctx.appointments = ctx.appointments.map((t) => ({ ...t, bufferMinutes: 0 }));
  ctx.absences = ctx.absences.filter((a) => a.scope === "admin");
  // Die Zeit wählt David selbst. Seine Arbeitszeiten (admin_verfuegbarkeit)
  // sind eine Vorgabe für Buchungen von Schülern, keine Sperre für ihn.
  // Am 15. November 2026 wurde Donnerstag 12:30 als „belegt" abgewiesen,
  // nur weil die Arbeitszeit am Donnerstag erst um 13:30 beginnt. Es zählen
  // nur echte Kollisionen: Termine, Sperren, Abwesenheiten, Probelektionen.
  ctx.availabilityWindows = GANZER_TAG;

  const pruefung = pruefeFixplatzSerie(wunsch, ersterStart, ctx, minuten, ferien);
  return {
    starts: pruefung.slots.map((s) => s.start),
    belegt: pruefung.belegte.map((s) => s.start),
  };
}

const zeitText = (d: Date) =>
  d.toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Legt eine Gruppe an: pro Mitglied ein Abo zum Gruppenpreis mit Raten und
 * derselben Terminserie von 60 Minuten.
 *
 * Erst wird alles geprüft (Mitglieder frei, jeder Termin frei), dann
 * geschrieben. Scheitert das Schreiben mittendrin, wird zurückgebaut, damit
 * keine halbe Gruppe stehen bleibt.
 */
export async function legeGruppeAn(
  admin: SupabaseClient,
  e: GruppenEingabe
): Promise<{ gruppeId: string; lektionen: number } | { error: string }> {
  const groesse = pruefeMitglieder(e.mitglieder);
  if (typeof groesse !== "number") return groesse;
  const ids = e.mitglieder.map((m) => m.trim());

  // ── Mitglieder prüfen ─────────────────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("id, vorname, nachname, payment_method, extern, aktiv")
    .in("id", ids);
  const nachId = new Map((profile ?? []).map((p) => [p.id as string, p]));
  const mitglieder: Mitglied[] = [];
  for (const id of ids) {
    const p = nachId.get(id);
    if (!p) return { error: "Ein ausgewählter Schüler wurde nicht gefunden." };
    const name = `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim();
    if (p.extern === true) {
      return { error: `${name} ist extern angelegt. Externe bekommen kein Abo.` };
    }
    mitglieder.push({
      id,
      vorname: String(p.vorname ?? ""),
      nachname: String(p.nachname ?? ""),
      payment_method: (p.payment_method as string | null) ?? null,
    });
  }

  const { data: laufende } = await admin
    .from("packages")
    .select("student_id")
    .in("student_id", ids)
    .eq("status", "active");
  if ((laufende ?? []).length > 0) {
    const namen = (laufende ?? [])
      .map((l) => mitglieder.find((m) => m.id === l.student_id)?.vorname)
      .filter(Boolean)
      .join(", ");
    return {
      error: `${namen} hat schon ein laufendes Abo oder Paket. Erst beenden, dann in die Gruppe.`,
    };
  }

  // ── Rechnen ───────────────────────────────────────────────
  const minuten = gruppenMinuten(groesse);
  const preis = e.preisProLektion ?? gruppenLektionspreis(groesse, e.variante);
  if (!Number.isFinite(preis) || preis <= 0) {
    return { error: "Bitte einen Preis über 0 Franken angeben." };
  }

  const vorschau = await baueVorschau(admin, {
    studentId: ids[0],
    variante: e.variante,
    rhythmus: e.rhythmus,
    bookingMode: "fix",
    weekday: e.weekday,
    periodeStart: e.periodeStart,
    preisProLektion: preis,
  });
  if (vorschau.lektionen < 1) {
    return { error: "In diesem Zeitraum liegen keine Unterrichtstermine." };
  }

  const wunsch: FixplatzWunsch = {
    weekday: e.weekday,
    time: e.time,
    rhythmus: e.rhythmus,
    lessons: vorschau.lektionen,
  };
  const plan = await planeGruppenSerie(admin, {
    ersterSchueler: ids[0],
    wunsch,
    parity: e.parity,
    minuten,
    now: e.now,
  });
  if ("error" in plan) return plan;
  if (plan.belegt.length > 0) {
    return {
      error: `${plan.belegt.length} von ${plan.starts.length} Terminen sind belegt oder gesperrt: ${plan.belegt
        .map(zeitText)
        .join(", ")}. Nichts angelegt, keine Mail. Bitte eine andere Zeit wählen oder die Termine zuerst freimachen.`,
    };
  }
  if (plan.starts.length < vorschau.lektionen) {
    return {
      error: `Es passen nur ${plan.starts.length} von ${vorschau.lektionen} Terminen in die Periode. Nichts angelegt.`,
    };
  }

  // ── Schreiben ─────────────────────────────────────────────
  const name =
    e.name?.trim() || gruppenNameAus(mitglieder.map((m) => m.vorname));
  const { data: gruppe, error: gErr } = await admin
    .from("gruppen")
    .insert({
      name,
      groesse,
      abo_variante: e.variante,
      rhythmus: e.rhythmus,
      fixplatz_weekday: e.weekday,
      fixplatz_time: e.time,
      fixplatz_week_parity: e.parity,
      lektion_minuten: minuten,
      periode_start: e.periodeStart,
      notiz: e.notiz?.trim() || null,
    })
    .select("id")
    .single();
  if (gErr || !gruppe) return { error: "Die Gruppe konnte nicht angelegt werden." };

  const rueckbau = async () => {
    // Termine und Raten hängen an den Abos, die Abos an der Gruppe.
    const { data: pk } = await admin.from("packages").select("id").eq("gruppe_id", gruppe.id);
    const pkIds = (pk ?? []).map((p) => p.id as string);
    await admin.from("appointments").delete().eq("gruppe_id", gruppe.id);
    if (pkIds.length) {
      await admin.from("package_instalments").delete().in("package_id", pkIds);
      await admin.from("packages").delete().in("id", pkIds);
    }
    await admin.from("gruppen").delete().eq("id", gruppe.id);
  };

  const label = GRUPPENUNTERRICHT[groesse].label.toLowerCase();
  const rhythmusText = e.rhythmus === "woechentlich" ? "wöchentlich" : "alle zwei Wochen";
  const starts = plan.starts.slice(0, vorschau.lektionen);
  const alleTermine: { id: string; student_id: string; start_at: string }[] = [];

  for (const m of mitglieder) {
    const { data: pkg, error } = await admin
      .from("packages")
      .insert({
        student_id: m.id,
        type: e.variante === "halbjahr" ? "10er" : "20er",
        lessons_total: vorschau.lektionen,
        lessons_used: 0,
        name: `${ABO_LABELS[e.variante]} · ${rhythmusText} · Gruppe ${label}`,
        price_per_lesson: vorschau.preisProLektion,
        total_price: vorschau.gesamtpreis,
        payment_method: m.payment_method === "twint" ? "twint" : "qr",
        starts_at: new Date(`${e.periodeStart}T00:00:00.000Z`).toISOString(),
        expires_at: new Date(`${vorschau.periodeEnde}T23:59:59.000Z`).toISOString(),
        status: "active",
        billing_mode: "raten",
        term_months: vorschau.laufzeitMonate,
        auto_renew: e.autoRenew,
        deposit_amount: 0,
        instalment_count: vorschau.laufzeitMonate,
        instalment_amount: vorschau.monatsbetrag,
        rhythmus: e.rhythmus,
        booking_mode: "fix",
        fixplatz_weekday: e.weekday,
        fixplatz_time: e.time,
        fixplatz_week_parity: e.parity,
        flex_surcharge_percent: 0,
        abo_variante: e.variante,
        abo_lektionen: vorschau.lektionen,
        monatsbetrag: vorschau.monatsbetrag,
        periode_start: e.periodeStart,
        periode_ende: vorschau.periodeEnde,
        bindung_bis: vorschau.bindungBis,
        gruppe_id: gruppe.id,
      })
      .select("id")
      .single();
    if (error || !pkg) {
      await rueckbau();
      return {
        error:
          error?.code === "23505"
            ? `${m.vorname} hat inzwischen ein laufendes Abo. Nichts angelegt.`
            : `Das Abo für ${m.vorname} konnte nicht angelegt werden. Nichts angelegt.`,
      };
    }

    const raten = await legeMonatsratenAn(admin, {
      packageId: pkg.id,
      studentId: m.id,
      gesamtpreis: vorschau.gesamtpreis,
      laufzeitMonate: vorschau.laufzeitMonate,
      periodeStart: e.periodeStart,
    });
    if ("error" in raten) {
      await rueckbau();
      return { error: `Die Raten für ${m.vorname} konnten nicht angelegt werden. Nichts angelegt.` };
    }

    const seriesId = crypto.randomUUID();
    const { data: termine, error: tErr } = await admin
      .from("appointments")
      .insert(
        starts.map((s) => ({
          student_id: m.id,
          package_id: pkg.id,
          start_at: s.toISOString(),
          end_at: new Date(s.getTime() + minuten * 60000).toISOString(),
          status: "booked",
          source: "direct",
          series_id: seriesId,
          is_fixplatz: true,
          gruppe_id: gruppe.id,
        }))
      )
      .select("id, student_id, start_at");
    if (tErr || !termine) {
      await rueckbau();
      return { error: `Die Termine für ${m.vorname} konnten nicht angelegt werden. Nichts angelegt.` };
    }
    alleTermine.push(...(termine as typeof alleTermine));
  }

  // ── Nach dem Schreiben: fehlertolerant ────────────────────
  for (const t of alleTermine) {
    await scheduleLessonReminders(admin, t);
  }
  // Ein Event pro Lektion: Der Sync eines Termins richtet die ganze
  // Gruppenlektion ein, also genügt ein Mitglied.
  for (const t of alleTermine.filter((t) => t.student_id === ids[0])) {
    await syncAppointmentToCalendar(admin, t.id);
  }

  if (e.mailsSenden) {
    const platz = describeFixplatz(e.weekday, e.time, e.rhythmus, e.parity);
    for (const m of mitglieder) {
      const andere = mitglieder.filter((x) => x.id !== m.id).map((x) => x.vorname);
      const { data: pkg } = await admin
        .from("packages")
        .select("id")
        .eq("student_id", m.id)
        .eq("gruppe_id", gruppe.id)
        .maybeSingle();
      await sendEmailNow(admin, "abo_gestartet", {
        student_id: m.id,
        student_name: `${m.vorname} ${m.nachname}`.trim() || undefined,
        abo_label: `${ABO_LABELS[e.variante]} (Gruppe ${label})`,
        rhythmus_text: e.rhythmus === "woechentlich" ? "jede Woche" : "alle zwei Wochen",
        fixplatz_text: `${platz}, ${minuten} Minuten, zusammen mit ${gruppenNameAus(andere)}`,
        lektionen: vorschau.lektionen,
        monatsbetrag: vorschau.monatsbetrag,
        laufzeit_monate: vorschau.laufzeitMonate,
        periode_start: e.periodeStart,
        periode_ende: vorschau.periodeEnde,
        // Wie beim Abo als Tage. Lektionen liegen abends, der UTC-Tag ist
        // derselbe wie der Zürcher.
        termine: starts.map((s) => s.toISOString().slice(0, 10)),
        ferientage: vorschau.ferientage,
        auto_renew: e.autoRenew,
        pdf_url: pkg ? `${BASIS_URL}/api/abo/${pkg.id}/bestaetigung` : undefined,
      });
    }
  }

  return { gruppeId: gruppe.id as string, lektionen: vorschau.lektionen };
}
