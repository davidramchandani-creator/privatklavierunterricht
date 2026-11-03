// ============================================================
// Laufende Abos auf den Semesterrhythmus umstellen
//
// David, 3. November 2026: Abos laufen ab jetzt bis Semesterende. Die vor
// der Umstellung abgeschlossenen gehen bis Mitte März; sie werden aufs Ende
// des Semesters gekürzt, in dem sie begonnen haben.
//
// Ablauf in zwei Schritten, und der zweite nur auf Davids Klick:
//
//   1. `planeUmstellung`  rechnet für jedes laufende Abo, was sich ändert.
//                         Schreibt nichts.
//   2. `fuehreUmstellungAus` setzt es für einen Schüler um: Termine,
//                         Laufzeit, Raten, und auf Wunsch die Mail.
//
// Die Lektionszahl ist die vertragliche: alle Termine des festen Platzes vom
// Beginn bis Semesterende, ohne unterrichtsfreie Zeiten. Raten, die schon
// bezahlt oder gestellt sind, bleiben; der Rest des neuen Gesamtpreises
// verteilt sich gleichmässig auf die offenen Raten bis Semesterende.
// Offene Raten nach dem Semesterende fallen weg. Bei einem Jahresabo kommen
// die Raten fürs zweite Semester mit dessen Verlängerung, sobald der neue
// Termin feststeht (Antwort David: „pro Semester neu rechnen").
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { aboPeriode, ABO_LABELS, type AboVariante, type Semester } from "./abo";
import { ladeFerien, ladeSemester } from "./abo-server";
import { describeFixplatz } from "./fixplatz";
import { planeFixplatzSerie } from "./fixplatz-server";
import { LESSON_DURATION_MIN } from "./booking";
import { roundRappen, todayInZurich } from "./subscription";
import { serienStart } from "./umstellung-server";
import { syncAppointmentToCalendar } from "./google-calendar";
import { cancelLessonReminders, scheduleLessonReminders } from "./reminders";
import { sendEmailNow } from "./emails-outbox";
import { setzeExternenTermin } from "./externe-server";

export type UmstellungRate = { id: string; faellig: string; betragAlt: number; betragNeu: number };

export type UmstellungZeile = {
  packageId: string;
  studentId: string;
  name: string;
  variante: AboVariante;
  abo: string;
  platz: string;
  /** Schon umgestellt oder nichts zu tun. */
  erledigt: boolean;
  /** Warum diese Zeile nicht umgestellt werden kann. */
  hinderung: string | null;
  semester: string;
  endeAlt: string;
  endeNeu: string;
  bindungBis: string;
  preisProLektion: number;
  lektionenAlt: number;
  lektionenNeu: number;
  gesamtAlt: number;
  gesamtNeu: number;
  bezahlt: number;
  rateAlt: number;
  rateNeu: number;
  /** Alle Raten nach der Umstellung, bezahlte und offene. */
  ratenAnzahl: number;
  raten: UmstellungRate[];
  ratenWeg: number;
  termineAbsagen: string[];
  termineNeu: string[];
  unterrichtsfrei: { bezeichnung: string; start: string; ende: string }[];
};

export type ExternZeile = {
  studentId: string;
  name: string;
  wochentag: number;
  zeit: string;
  paritaet: 0 | 1 | null;
  zeitUngerade: string | null;
  termineImFreien: string[];
};

type Pkg = {
  id: string;
  student_id: string;
  abo_variante: string | null;
  rhythmus: string | null;
  fixplatz_weekday: number | null;
  fixplatz_time: string | null;
  fixplatz_week_parity: number | null;
  fixplatz_time_ungerade: string | null;
  periode_start: string | null;
  periode_ende: string | null;
  abo_lektionen: number | null;
  price_per_lesson: number | string | null;
  total_price: number | string | null;
  monatsbetrag: number | string | null;
  profiles: { vorname: string | null; nachname: string | null } | null;
};

const zeitKurz = (d: Date) =>
  d.toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function verteile(betrag: number, anzahl: number): number[] {
  if (anzahl <= 0) return [];
  const nominal = roundRappen(betrag / anzahl);
  const out: number[] = [];
  let verteilt = 0;
  for (let i = 0; i < anzahl; i++) {
    const b = i === anzahl - 1 ? roundRappen(betrag - verteilt) : nominal;
    out.push(b);
    verteilt = roundRappen(verteilt + b);
  }
  return out;
}

/** Rechnet eine Zeile. Liefert zusätzlich, was gebucht werden müsste. */
async function rechneZeile(
  admin: SupabaseClient,
  pkg: Pkg,
  semester: Semester[],
  jetzt: Date
): Promise<{ zeile: UmstellungZeile; neu: Date[]; absagenIds: string[] }> {
  const variante: AboVariante = pkg.abo_variante === "jahr" ? "jahr" : "halbjahr";
  const rhythmus = pkg.rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich";
  const start = String(pkg.periode_start);
  const name = `${pkg.profiles?.vorname ?? ""} ${pkg.profiles?.nachname ?? ""}`.trim();
  const ppl = Number(pkg.price_per_lesson ?? 0);
  const parity = (pkg.fixplatz_week_parity ?? null) as 0 | 1 | null;
  const zeit = String(pkg.fixplatz_time ?? "").slice(0, 5);
  const zweite = pkg.fixplatz_time_ungerade ? String(pkg.fixplatz_time_ungerade).slice(0, 5) : null;

  const periode = aboPeriode({ variante, start, semester });
  const basis: UmstellungZeile = {
    packageId: pkg.id,
    studentId: pkg.student_id,
    name,
    variante,
    abo: ABO_LABELS[variante],
    platz:
      pkg.fixplatz_weekday != null && zeit
        ? describeFixplatz(Number(pkg.fixplatz_weekday), zeit, rhythmus, parity, zweite)
        : "ohne festen Platz",
    erledigt: false,
    hinderung: null,
    semester: periode?.semester.bezeichnung ?? "",
    endeAlt: String(pkg.periode_ende),
    endeNeu: periode?.ende ?? String(pkg.periode_ende),
    bindungBis: periode?.bindungBis ?? String(pkg.periode_ende),
    preisProLektion: ppl,
    lektionenAlt: Number(pkg.abo_lektionen ?? 0),
    lektionenNeu: Number(pkg.abo_lektionen ?? 0),
    gesamtAlt: Number(pkg.total_price ?? 0),
    gesamtNeu: Number(pkg.total_price ?? 0),
    bezahlt: 0,
    rateAlt: Number(pkg.monatsbetrag ?? 0),
    rateNeu: Number(pkg.monatsbetrag ?? 0),
    ratenAnzahl: 0,
    raten: [],
    ratenWeg: 0,
    termineAbsagen: [],
    termineNeu: [],
    unterrichtsfrei: [],
  };

  if (!periode) {
    return { zeile: { ...basis, hinderung: "Kein Semester für den Abo-Beginn hinterlegt." }, neu: [], absagenIds: [] };
  }
  if (String(pkg.periode_ende) <= periode.ende) {
    return { zeile: { ...basis, erledigt: true }, neu: [], absagenIds: [] };
  }
  if (pkg.fixplatz_weekday == null || !zeit) {
    return { zeile: { ...basis, hinderung: "Abo ohne festen Platz, bitte von Hand anpassen." }, neu: [], absagenIds: [] };
  }

  const ferien = await ladeFerien(admin, start);
  basis.unterrichtsfrei = ferien
    .filter((f) => f.ende >= todayInZurich(jetzt) && f.start <= periode.ende)
    .map((f) => ({ bezeichnung: f.bezeichnung, start: f.start, ende: f.ende }));

  // Bestehende Termine dieses Abos, ohne Zusatzlektionen.
  const { data: vorhandene } = await admin
    .from("appointments")
    .select("id, start_at, status")
    .eq("package_id", pkg.id)
    .eq("zusatzlektion", false)
    .in("status", ["booked", "completed", "no_show"]);

  // Die Serie vom Abo-Beginn bis Semesterende, mit den neuen
  // unterrichtsfreien Zeiten. Bestehende Termine zählen nicht als belegt,
  // sie sind ja diese Serie.
  const plan = await planeFixplatzSerie(admin, {
    studentId: pkg.student_id,
    wunsch: {
      weekday: Number(pkg.fixplatz_weekday),
      time: zeit,
      timeUngerade: zweite,
      rhythmus,
      lessons: 120,
    },
    parity,
    now: serienStart(start),
    ohneTermine: (vorhandene ?? []).map((t) => t.id as string),
    ohnePuffer: true,
  });
  if ("error" in plan) {
    return { zeile: { ...basis, hinderung: plan.error }, neu: [], absagenIds: [] };
  }

  const endeInstant = Date.parse(`${periode.ende}T23:59:59Z`);
  const imSemester = (d: Date) => d.getTime() <= endeInstant;
  const soll = plan.zuBuchen.filter((t) => imSemester(t.original ?? t.start));
  const offen = plan.offen.filter(imSemester).filter((d) => d.getTime() > jetzt.getTime());
  if (offen.length > 0) {
    return {
      zeile: {
        ...basis,
        hinderung: `Für ${offen.length} Termine findet sich kein Platz: ${offen.map(zeitKurz).join(", ")}.`,
      },
      neu: [],
      absagenIds: [],
    };
  }

  const lektionenNeu = soll.length;
  const gesamtNeu = roundRappen(lektionenNeu * ppl);

  // Termine abgleichen, nur in der Zukunft.
  const zukunft = (vorhandene ?? []).filter(
    (t) => t.status === "booked" && Date.parse(String(t.start_at)) > jetzt.getTime()
  );
  const sollZukunft = soll.map((t) => t.start).filter((d) => d.getTime() > jetzt.getTime());
  const sollZeiten = new Set(sollZukunft.map((d) => d.getTime()));
  const istZeiten = new Set(zukunft.map((t) => Date.parse(String(t.start_at))));
  const absagen = zukunft.filter((t) => !sollZeiten.has(Date.parse(String(t.start_at))));
  const neu = sollZukunft.filter((d) => !istZeiten.has(d.getTime()));

  // Raten.
  const { data: raten } = await admin
    .from("package_instalments")
    .select("id, amount, due_date, status")
    .eq("package_id", pkg.id)
    .order("sequence");
  const fest = (raten ?? []).filter((r) => r.status !== "open");
  const offeneRaten = (raten ?? []).filter((r) => r.status === "open");
  const bleiben = offeneRaten.filter((r) => String(r.due_date) <= periode.ende);
  const weg = offeneRaten.length - bleiben.length;
  const bezahlt = roundRappen(fest.reduce((s, r) => s + Number(r.amount), 0));
  const rest = roundRappen(gesamtNeu - bezahlt);

  let hinderung: string | null = null;
  if (rest < 0) {
    hinderung = `Schon CHF ${(-rest).toFixed(2)} zu viel bezahlt. Gutschrift aufs nächste Semester von Hand.`;
  } else if (rest > 0 && bleiben.length === 0) {
    hinderung = "Keine offene Rate mehr bis Semesterende. Bitte von Hand verrechnen.";
  }
  const neueBetraege = verteile(Math.max(0, rest), bleiben.length);

  return {
    zeile: {
      ...basis,
      hinderung,
      lektionenNeu,
      gesamtNeu,
      bezahlt,
      rateNeu: neueBetraege[0] ?? 0,
      ratenAnzahl: fest.length + bleiben.length,
      raten: bleiben.map((r, i) => ({
        id: r.id as string,
        faellig: String(r.due_date),
        betragAlt: Number(r.amount),
        betragNeu: neueBetraege[i] ?? 0,
      })),
      ratenWeg: weg,
      termineAbsagen: absagen.map((t) => zeitKurz(new Date(String(t.start_at)))),
      termineNeu: neu.map(zeitKurz),
    },
    neu,
    absagenIds: absagen.map((t) => t.id as string),
  };
}

const PKG_FELDER =
  "id, student_id, abo_variante, rhythmus, fixplatz_weekday, fixplatz_time, fixplatz_week_parity, fixplatz_time_ungerade, periode_start, periode_ende, abo_lektionen, price_per_lesson, total_price, monatsbetrag, profiles!inner(vorname, nachname, ist_test)";

/** Alle laufenden Abos mit Monatsraten, gerechnet, nichts geschrieben. */
export async function planeUmstellung(
  admin: SupabaseClient,
  jetzt: Date = new Date()
): Promise<{ zeilen: UmstellungZeile[]; externe: ExternZeile[] }> {
  const semester = await ladeSemester(admin);
  const { data } = await admin
    .from("packages")
    .select(PKG_FELDER)
    .eq("status", "active")
    .eq("billing_mode", "raten")
    .not("abo_variante", "is", null)
    .eq("profiles.ist_test", false);

  const zeilen: UmstellungZeile[] = [];
  for (const pkg of (data ?? []) as unknown as Pkg[]) {
    zeilen.push((await rechneZeile(admin, pkg, semester, jetzt)).zeile);
  }
  zeilen.sort((a, b) => a.name.localeCompare(b.name));

  // Externe: kein Abo, aber Termine in Ferien und Praktikum.
  const ferien = await ladeFerien(admin, todayInZurich(jetzt));
  const { data: vereinbarungen } = await admin
    .from("externe_vereinbarungen")
    .select("student_id, wochentag, zeit, woche_paritaet, zeit_ungerade, profiles!inner(vorname, nachname, ist_test)")
    .eq("aktiv", true)
    .eq("profiles.ist_test", false);
  const externe: ExternZeile[] = [];
  for (const v of (vereinbarungen ?? []) as unknown as Array<{
    student_id: string;
    wochentag: number;
    zeit: string;
    woche_paritaet: number | null;
    zeit_ungerade: string | null;
    profiles: { vorname: string | null; nachname: string | null };
  }>) {
    const { data: termine } = await admin
      .from("appointments")
      .select("start_at")
      .eq("student_id", v.student_id)
      .eq("status", "booked")
      .gt("start_at", jetzt.toISOString());
    const imFreien = (termine ?? [])
      .map((t) => new Date(String(t.start_at)))
      .filter((d) => {
        const tag = todayInZurich(d);
        return ferien.some((f) => tag >= f.start && tag <= f.ende);
      });
    externe.push({
      studentId: v.student_id,
      name: `${v.profiles.vorname ?? ""} ${v.profiles.nachname ?? ""}`.trim(),
      wochentag: Number(v.wochentag),
      zeit: String(v.zeit).slice(0, 5),
      paritaet: (v.woche_paritaet ?? null) as 0 | 1 | null,
      zeitUngerade: v.zeit_ungerade ? String(v.zeit_ungerade).slice(0, 5) : null,
      termineImFreien: imFreien.map(zeitKurz),
    });
  }
  externe.sort((a, b) => a.name.localeCompare(b.name));
  return { zeilen, externe };
}

/** Ein Abo umstellen. Erst rechnen, dann schreiben, dann (auf Wunsch) Mail. */
export async function fuehreUmstellungAus(
  admin: SupabaseClient,
  packageId: string,
  mitMail: boolean,
  jetzt: Date = new Date()
): Promise<{ ok: true; zeile: UmstellungZeile; mail: boolean } | { error: string }> {
  const semester = await ladeSemester(admin);
  const { data } = await admin.from("packages").select(PKG_FELDER).eq("id", packageId).maybeSingle();
  if (!data) return { error: "Abo nicht gefunden." };
  const pkg = data as unknown as Pkg;

  const { zeile, neu, absagenIds } = await rechneZeile(admin, pkg, semester, jetzt);
  if (zeile.erledigt) return { error: "Dieses Abo ist schon umgestellt." };
  if (zeile.hinderung) return { error: zeile.hinderung };

  // 1. Termine: absagen, was wegfällt; buchen, was dazukommt.
  for (const id of absagenIds) {
    await admin.from("appointments").update({ status: "cancelled" }).eq("id", id);
    await cancelLessonReminders(admin, id);
    await syncAppointmentToCalendar(admin, id);
  }
  if (neu.length > 0) {
    const { data: serie } = await admin
      .from("appointments")
      .select("series_id")
      .eq("package_id", pkg.id)
      .not("series_id", "is", null)
      .limit(1)
      .maybeSingle();
    const seriesId = (serie?.series_id as string | undefined) ?? crypto.randomUUID();
    const { data: angelegt, error } = await admin
      .from("appointments")
      .insert(
        neu.map((d) => ({
          student_id: pkg.student_id,
          package_id: pkg.id,
          start_at: d.toISOString(),
          end_at: new Date(d.getTime() + LESSON_DURATION_MIN * 60000).toISOString(),
          status: "booked",
          source: "direct",
          series_id: seriesId,
          is_fixplatz: true,
        }))
      )
      .select("id, start_at");
    if (error) return { error: "Die neuen Termine konnten nicht angelegt werden." };
    for (const t of angelegt ?? []) {
      await scheduleLessonReminders(admin, {
        id: t.id as string,
        student_id: pkg.student_id,
        start_at: String(t.start_at),
      });
      await syncAppointmentToCalendar(admin, t.id as string);
    }
  }

  // 2. Abo: Laufzeit, Lektionen, Preis, Bindung.
  await admin
    .from("packages")
    .update({
      periode_ende: zeile.endeNeu,
      expires_at: `${zeile.endeNeu}T23:59:59.000Z`,
      abo_lektionen: zeile.lektionenNeu,
      lessons_total: zeile.lektionenNeu,
      total_price: zeile.gesamtNeu,
      monatsbetrag: zeile.rateNeu,
      bindung_bis: zeile.bindungBis,
      term_months: zeile.ratenAnzahl,
    })
    .eq("id", pkg.id);

  // 3. Raten: offene neu verteilen, die nach Semesterende entfallen.
  for (const r of zeile.raten) {
    await admin.from("package_instalments").update({ amount: r.betragNeu }).eq("id", r.id);
  }
  await admin
    .from("package_instalments")
    .delete()
    .eq("package_id", pkg.id)
    .eq("status", "open")
    .gt("due_date", zeile.endeNeu);

  // 4. Mail.
  if (mitMail) {
    await sendEmailNow(admin, "semester_umstellung", umstellungsMailDaten(zeile));
  }
  return { ok: true, zeile, mail: mitMail };
}

/** Was die Mail braucht. Eigene Funktion, damit Vorschau und Versand gleich sind. */
export function umstellungsMailDaten(zeile: UmstellungZeile): Record<string, unknown> {
  return {
    student_id: zeile.studentId,
    student_name: zeile.name,
    jahresabo: zeile.variante === "jahr",
    periode_ende: zeile.endeNeu,
    bindung_bis: zeile.bindungBis,
    lektionen: zeile.lektionenNeu,
    monatsbetrag_neu: zeile.rateNeu,
    monatsbetrag_alt: zeile.rateAlt,
    unterrichtsfrei: zeile.unterrichtsfrei,
    // Von David freigegebener Satz (3. November 2026).
    zusatz: "Dafür bin ich in den Sportferien da.",
  };
}

/** Externe Termine nach den neuen unterrichtsfreien Zeiten neu legen. */
export async function stelleExternUm(
  admin: SupabaseClient,
  studentId: string,
  jetzt: Date = new Date()
): Promise<{ ok: true; termine: number } | { error: string }> {
  const { data: v } = await admin
    .from("externe_vereinbarungen")
    .select("wochentag, zeit, woche_paritaet, zeit_ungerade")
    .eq("student_id", studentId)
    .eq("aktiv", true)
    .maybeSingle();
  if (!v) return { error: "Keine aktive Vereinbarung." };
  const r = await setzeExternenTermin(admin, {
    studentId,
    wochentag: Number(v.wochentag),
    beginn: String(v.zeit).slice(0, 5),
    paritaet: (v.woche_paritaet ?? null) as 0 | 1 | null,
    beginnUngerade: v.zeit_ungerade ? String(v.zeit_ungerade).slice(0, 5) : null,
    abDatum: todayInZurich(jetzt),
  });
  if ("error" in r) return r;
  return { ok: true, termine: r.termine };
}
