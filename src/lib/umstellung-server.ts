// ============================================================
// Umstellung vom Lektionspaket aufs Abo
//
// Eine gewöhnliche Planungsrunde setzt nur den Fixplatz eines bestehenden
// Abos. Bei der Umstellung gibt es noch kein Abo: Es entsteht erst hier, aus
// dem, was der Schüler gewählt hat, und dem Termin, den die Zuteilung
// gefunden hat.
//
// ── Warum das nicht in `zuteilungAnwenden` passt ────────────
//
// Jene Funktion überspringt jeden ohne aktives Abo, und das ist dort richtig:
// Wer keines hat, hat nichts, wofür Termine gebucht werden könnten. Bei der
// Umstellung trifft das auf **alle** zu. Dieselbe Funktion zu erweitern hiesse,
// zwei gegensätzliche Regeln in eine Schleife zu schreiben, und die
// gefährlichere der beiden würde irgendwann versehentlich im falschen Fall
// laufen.
//
// ── Was der Preis kostet, steht vorher fest ─────────────────
//
// Beim Ausfüllen kannte der Schüler seinen Wochentag noch nicht. Gerechnet
// wurde deshalb mit dem ungünstigsten seiner angegebenen Tage. Genau diese
// Zahl gilt jetzt weiter, auch wenn der zugeteilte Tag eine Lektion mehr
// hergäbe. Sonst stünde am Ende ein anderer Betrag auf der Rechnung als in
// der Bestätigung, die er abgeschickt hat.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { ABO_LABELS, type AboVariante } from "./abo";
import { schliesseOffeneAusfaelle } from "./ausfall";
import {
  baueVorschau,
  baueVorschauOhneTermin,
  legeMonatsratenAn,
} from "./abo-server";
import { describeFixplatz } from "./fixplatz";
import { bookFixplatzSeries } from "./fixplatz-server";
import type { Rhythmus } from "./rhythmus";
import type { Zuteilung } from "./zuteilung";

export type UmstellungErgebnis = {
  angelegt: number;
  uebersprungen: { name: string; grund: string }[];
  /**
   * Abos, bei denen weniger Termine zustande kamen als zugesichert.
   *
   * Das ist kein Fehler im technischen Sinn: Das Abo läuft, die Rechnung
   * stimmt, nur fehlen Lektionen. Genau deshalb muss es eigens gemeldet
   * werden, sonst fiele es überhaupt nicht auf.
   */
  unvollstaendig: {
    name: string;
    zugesichert: number;
    gebucht: number;
    fehlend: string[];
  }[];
};

/**
 * Der Zeitpunkt, ab dem die Terminserie suchen darf.
 *
 * `bookFixplatzSeries` verlangt 24 Stunden Vorlauf ab `now`. Damit die erste
 * Lektion auf den Stichtag selbst fallen kann und keinen Tag später, wird
 * `now` genau einen Tag davor gesetzt.
 */
export function serienStart(startDatum: string): Date {
  return new Date(
    Date.parse(`${startDatum}T00:00:00.000Z`) - 24 * 3600 * 1000
  );
}

/**
 * Legt für einen Schüler das Abo an und bucht seine Terminserie.
 *
 * Nimmt bewusst kein Paket entgegen, sondern räumt das alte selbst weg: Beides
 * gehört zusammen. Bliebe das alte Paket aktiv, verhinderte die
 * Eindeutigkeitsregel der Datenbank das neue, und der Schüler stünde mit einem
 * abgelaufenen Paket und ohne Abo da.
 */
export async function legeAboAn(
  admin: SupabaseClient,
  params: {
    studentId: string;
    variante: AboVariante;
    rhythmus: Rhythmus;
    wochentag: number;
    beginn: string;
    paritaet: 0 | 1 | null;
    startDatum: string;
    /** Tage, die der Schüler angegeben hat. Bestimmt die zugesicherte Zahl. */
    moeglicheTage: number[];
    autoRenew: boolean;
  }
): Promise<
  | {
      packageId: string;
      /** Zugesicherte Lektionszahl, Grundlage des Preises. */
      lektionen: number;
      /** Tatsächlich gebuchte Termine. */
      gebucht: number;
      /** Termine ohne Platz, als Datum. */
      fehlend: string[];
      /** Wie viele auf einen Ausweichtermin gerückt sind. */
      verschoben: number;
    }
  | { error: string }
> {
  // Zugesicherte Lektionszahl und Preis: dieselbe Rechnung wie im Portal,
  // über den ungünstigsten der angegebenen Tage.
  const zugesichert = await baueVorschauOhneTermin(admin, {
    studentId: params.studentId,
    variante: params.variante,
    rhythmus: params.rhythmus,
    moeglicheTage:
      params.moeglicheTage.length > 0
        ? params.moeglicheTage
        : [params.wochentag],
    periodeStart: params.startDatum,
  });

  if (zugesichert.lektionen < 1) {
    return { error: "In diesem Zeitraum liegen keine Unterrichtstermine." };
  }

  // Altes Paket schliessen und seine offenen Termine absagen. Erst danach das
  // neue anlegen, sonst greift die Regel „ein aktives Paket pro Schüler".
  const { data: alte } = await admin
    .from("packages")
    .select("id")
    .eq("student_id", params.studentId)
    .eq("status", "active");

  for (const alt of alte ?? []) {
    await admin
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("package_id", alt.id)
      .eq("status", "booked")
      .gt("start_at", new Date().toISOString());

    // Offene Ausfälle enden mit dem Paket. Sonst fordert das Portal nach
    // der Umstellung weiter zum Ausweichtermin fürs alte Paket auf.
    await schliesseOffeneAusfaelle(admin, alt.id as string);

    await admin
      .from("packages")
      .update({ status: "expired" })
      .eq("id", alt.id);
  }

  const { data: pkg, error } = await admin
    .from("packages")
    .insert({
      student_id: params.studentId,
      type: params.variante === "halbjahr" ? "10er" : "20er",
      lessons_total: zugesichert.lektionen,
      lessons_used: 0,
      name: `${ABO_LABELS[params.variante]} · ${
        params.rhythmus === "woechentlich" ? "wöchentlich" : "alle zwei Wochen"
      }`,
      price_per_lesson: zugesichert.preisProLektion,
      total_price: zugesichert.gesamtpreis,
      starts_at: new Date(`${params.startDatum}T00:00:00.000Z`).toISOString(),
      expires_at: new Date(
        `${zugesichert.periodeEnde}T23:59:59.000Z`
      ).toISOString(),
      status: "active",
      billing_mode: "raten",
      term_months: zugesichert.laufzeitMonate,
      auto_renew: params.autoRenew,
      deposit_amount: 0,
      instalment_count: zugesichert.laufzeitMonate,
      instalment_amount: zugesichert.monatsbetrag,
      rhythmus: params.rhythmus,
      booking_mode: "fix",
      fixplatz_weekday: params.wochentag,
      fixplatz_time: params.beginn,
      fixplatz_week_parity: params.paritaet,
      flex_surcharge_percent: 0,
      abo_variante: params.variante,
      abo_lektionen: zugesichert.lektionen,
      monatsbetrag: zugesichert.monatsbetrag,
      periode_start: params.startDatum,
      periode_ende: zugesichert.periodeEnde,
    })
    .select("id")
    .single();

  if (error || !pkg) {
    return {
      error:
        error?.code === "23505"
          ? "Es läuft noch ein anderes Paket."
          : "Das Abo konnte nicht angelegt werden.",
    };
  }

  const raten = await legeMonatsratenAn(admin, {
    packageId: pkg.id,
    studentId: params.studentId,
    gesamtpreis: zugesichert.gesamtpreis,
    laufzeitMonate: zugesichert.laufzeitMonate,
    periodeStart: params.startDatum,
  });
  if ("error" in raten) {
    console.error("[umstellung] Monatsraten:", pkg.id, raten.error);
  }

  const serie = await bookFixplatzSeries(admin, {
    studentId: params.studentId,
    packageId: pkg.id,
    wunsch: {
      weekday: params.wochentag,
      time: params.beginn,
      rhythmus: params.rhythmus,
      lessons: zugesichert.lektionen,
    },
    parity: params.paritaet,
    now: serienStart(params.startDatum),
  });

  if ("error" in serie) {
    return { error: serie.error };
  }

  return {
    packageId: pkg.id,
    lektionen: zugesichert.lektionen,
    gebucht: serie.appointmentIds.length,
    // Termine, für die sich kein Platz fand. Sie müssen nach oben
    // durchgereicht werden: Wer 39 Lektionen bezahlt und 34 gebucht bekommt,
    // merkt das erst im Mai, und dann ist die Periode fast vorbei.
    fehlend: serie.offen.map((d) => d.toISOString().slice(0, 10)),
    verschoben: serie.verschoben.length,
  };
}

/** Was die Bestätigungsmail und das PDF brauchen. */
export type Bestaetigungsdaten = {
  studentName: string;
  aboLabel: string;
  fixplatzText: string;
  lektionen: number;
  monatsbetrag: number;
  gesamtpreis: number;
  preisProLektion: number;
  laufzeitMonate: number;
  periodeStart: string;
  periodeEnde: string;
  termine: string[];
  ferientage: { tag: string; grund: string }[];
  autoRenew: boolean;
};

/**
 * Stellt die Bestätigungsdaten aus dem angelegten Abo zusammen.
 *
 * Bewusst aus der **Datenbank** gelesen und nicht aus der Rechnung von vorhin
 * weitergereicht: Was in der Bestätigung steht, muss dem entsprechen, was
 * tatsächlich gespeichert wurde. Sonst bestätigt man dem Schüler eine Zahl,
 * die im System gar nicht existiert.
 */
export async function ladeBestaetigung(
  admin: SupabaseClient,
  packageId: string
): Promise<Bestaetigungsdaten | null> {
  const { data: pkg } = await admin
    .from("packages")
    .select(
      "student_id, abo_variante, rhythmus, abo_lektionen, monatsbetrag, total_price, price_per_lesson, term_months, periode_start, periode_ende, fixplatz_weekday, fixplatz_time, fixplatz_week_parity, auto_renew"
    )
    .eq("id", packageId)
    .maybeSingle();

  if (!pkg) return null;

  const { data: prof } = await admin
    .from("profiles")
    .select("vorname, nachname")
    .eq("id", pkg.student_id)
    .maybeSingle();

  const { data: termine } = await admin
    .from("appointments")
    .select("start_at")
    .eq("package_id", packageId)
    .eq("status", "booked")
    .order("start_at");

  const variante: AboVariante =
    pkg.abo_variante === "jahr" ? "jahr" : "halbjahr";
  const rhythmus: Rhythmus =
    pkg.rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich";

  // Die Ferien noch einmal für den tatsächlichen Tag ausrechnen, damit in der
  // Bestätigung genau die Ausfälle stehen, die diesen Schüler betreffen.
  const konkret = pkg.fixplatz_weekday != null
    ? await baueVorschau(admin, {
        studentId: pkg.student_id as string,
        variante,
        rhythmus,
        bookingMode: "fix",
        weekday: Number(pkg.fixplatz_weekday),
        periodeStart: String(pkg.periode_start),
      })
    : null;

  return {
    studentName:
      `${prof?.vorname ?? ""} ${prof?.nachname ?? ""}`.trim() || "Schüler",
    aboLabel: ABO_LABELS[variante],
    fixplatzText:
      pkg.fixplatz_weekday != null && pkg.fixplatz_time
        ? describeFixplatz(
            Number(pkg.fixplatz_weekday),
            String(pkg.fixplatz_time).slice(0, 5),
            rhythmus,
            (pkg.fixplatz_week_parity as 0 | 1 | null) ?? null
          )
        : "Termin noch offen",
    lektionen: Number(pkg.abo_lektionen ?? 0),
    monatsbetrag: Number(pkg.monatsbetrag ?? 0),
    gesamtpreis: Number(pkg.total_price ?? 0),
    preisProLektion: Number(pkg.price_per_lesson ?? 0),
    laufzeitMonate: Number(pkg.term_months ?? 0),
    periodeStart: String(pkg.periode_start),
    periodeEnde: String(pkg.periode_ende),
    termine: (termine ?? []).map((t) => String(t.start_at)),
    ferientage: konkret?.ferientage ?? [],
    autoRenew: pkg.auto_renew === true,
  };
}

/**
 * Wendet eine ganze Umstellungsrunde an.
 *
 * Fehler bei einem Schüler brechen die Runde nicht ab, sondern werden
 * gesammelt zurückgegeben. Nach einem Abbruch in der Mitte wäre die Hälfte
 * umgestellt und die andere nicht, und beim zweiten Versuch liefe man in die
 * bereits angelegten Abos.
 */
export async function wendeUmstellungAn(
  admin: SupabaseClient,
  params: {
    rundeId: string;
    startDatum: string;
    zuteilungen: Zuteilung[];
    autoRenew: boolean;
    /** Wird je erfolgreichem Abo aufgerufen, für den Mailversand. */
    beiErfolg: (packageId: string, studentId: string) => Promise<void>;
  }
): Promise<UmstellungErgebnis> {
  const uebersprungen: { name: string; grund: string }[] = [];
  const unvollstaendig: UmstellungErgebnis["unvollstaendig"] = [];
  let angelegt = 0;

  const { data: antworten } = await admin
    .from("planungs_antworten")
    .select("student_id, abo_variante, abo_rhythmus")
    .eq("runde_id", params.rundeId);

  const { data: zeiten } = await admin
    .from("student_verfuegbarkeit")
    .select("student_id, wochentag")
    .eq("runde_id", params.rundeId);

  const wahlVon = new Map(
    (antworten ?? []).map((a) => [a.student_id as string, a])
  );
  const tageVon = new Map<string, number[]>();
  for (const z of zeiten ?? []) {
    const id = z.student_id as string;
    tageVon.set(id, [...(tageVon.get(id) ?? []), Number(z.wochentag)]);
  }

  for (const z of params.zuteilungen) {
    const wahl = wahlVon.get(z.schuelerId);

    // Ohne Wahl kein Abo. Das trifft, wer nicht geantwortet hat und trotzdem
    // in der Zuteilung auftaucht, etwa über eine Dauerangabe aus früheren
    // Runden. Ihm still ein Halbjahresabo anzudrehen wäre das Gegenteil von
    // dem, was die Bestätigung im Formular bedeutet.
    if (!wahl?.abo_variante || !wahl?.abo_rhythmus) {
      uebersprungen.push({
        name: z.name,
        grund: "Hat kein Abo gewählt.",
      });
      continue;
    }

    const ergebnis = await legeAboAn(admin, {
      studentId: z.schuelerId,
      variante: wahl.abo_variante as AboVariante,
      rhythmus: wahl.abo_rhythmus as Rhythmus,
      wochentag: z.wochentag,
      beginn: z.beginn,
      paritaet: z.paritaet,
      startDatum: params.startDatum,
      moeglicheTage: [...new Set(tageVon.get(z.schuelerId) ?? [])],
      autoRenew: params.autoRenew,
    });

    if ("error" in ergebnis) {
      uebersprungen.push({ name: z.name, grund: ergebnis.error });
      continue;
    }

    if (ergebnis.gebucht < ergebnis.lektionen) {
      unvollstaendig.push({
        name: z.name,
        zugesichert: ergebnis.lektionen,
        gebucht: ergebnis.gebucht,
        fehlend: ergebnis.fehlend,
      });
    }

    await params.beiErfolg(ergebnis.packageId, z.schuelerId);
    angelegt++;
  }

  return { angelegt, uebersprungen, unvollstaendig };
}
