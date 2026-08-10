// ============================================================
// Abo-Modell — Serverseite
//
// Lädt Ferien und Preise, baut Angebote, legt Abos an.
// Die Rechnung selbst steht in abo.ts und kommt ohne DB aus.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  baueAboAngebot,
  baueMonatsraten,
  type AboAngebot,
  type AboVariante,
  type Ferienzeitraum,
} from "./abo";
import { priceWithBookingMode, type BookingMode, type Rhythmus } from "./rhythmus";

/** Alle hinterlegten Ferienzeiträume, optional ab einem Datum. */
export async function ladeFerien(
  admin: SupabaseClient,
  abDatum?: string
): Promise<Ferienzeitraum[]> {
  let query = admin
    .from("schulferien")
    .select("bezeichnung, start_datum, end_datum")
    .order("start_datum");

  if (abDatum) query = query.gte("end_datum", abDatum);

  const { data } = await query;
  return (data ?? []).map((f) => ({
    bezeichnung: f.bezeichnung as string,
    start: String(f.start_datum),
    ende: String(f.end_datum),
  }));
}

export type AboPreise = {
  halbjahr: number;
  jahr: number;
  wegaufschlag: number;
};

/**
 * Preise eines Schülers. Der Wegaufschlag kommt pro Lektion dazu — bei einem
 * Jahresabo mit 39 Lektionen macht er den Unterschied zwischen kostendeckend
 * und draufzahlen.
 */
export async function ladeAboPreise(
  admin: SupabaseClient,
  studentId: string
): Promise<AboPreise> {
  const { data } = await admin
    .from("profiles")
    .select("price_halbjahr, price_jahr, travel_surcharge")
    .eq("id", studentId)
    .maybeSingle();

  return {
    halbjahr: Number(data?.price_halbjahr ?? 70),
    jahr: Number(data?.price_jahr ?? 65),
    wegaufschlag: Number(data?.travel_surcharge ?? 0),
  };
}

/**
 * Lektionspreis für eine Abo-Variante, inklusive Wegaufschlag und – bei
 * flexibler Buchung – Aufschlag.
 */
export function aboLektionspreis(
  preise: AboPreise,
  variante: AboVariante,
  bookingMode: BookingMode
): number {
  const basis =
    (variante === "halbjahr" ? preise.halbjahr : preise.jahr) +
    preise.wegaufschlag;
  return priceWithBookingMode(basis, bookingMode);
}

export type AboVorschau = AboAngebot & {
  bookingMode: BookingMode;
  monatsraten: { sequenz: number; betrag: number; faellig: string }[];
};

/**
 * Vollständiges Angebot für einen konkreten Schüler und Fixplatz.
 *
 * Wird sowohl im Portal (Vorschau vor dem Kauf) als auch beim Anlegen
 * verwendet — damit steht in der Vorschau garantiert dieselbe Zahl wie
 * nachher auf der Rechnung.
 */
export async function baueVorschau(
  admin: SupabaseClient,
  params: {
    studentId: string;
    variante: AboVariante;
    rhythmus: Rhythmus;
    bookingMode: BookingMode;
    weekday: number;
    periodeStart: string;
  }
): Promise<AboVorschau> {
  const [preise, ferien] = await Promise.all([
    ladeAboPreise(admin, params.studentId),
    ladeFerien(admin, params.periodeStart),
  ]);

  const angebot = baueAboAngebot({
    variante: params.variante,
    rhythmus: params.rhythmus,
    weekday: params.weekday,
    periodeStart: params.periodeStart,
    preisProLektion: aboLektionspreis(preise, params.variante, params.bookingMode),
    ferien,
  });

  return {
    ...angebot,
    bookingMode: params.bookingMode,
    monatsraten: baueMonatsraten(
      angebot.gesamtpreis,
      angebot.laufzeitMonate,
      angebot.periodeStart
    ),
  };
}

/**
 * Nächster sinnvoller Periodenstart.
 *
 * Der Erste des kommenden Monats — nicht der heutige Tag. Ein Abo, das am
 * 17. beginnt und am 16. endet, macht die Monatsabrechnung unnötig krumm
 * und ist auf jeder Rechnung schwerer zu lesen.
 */
export function naechsterPeriodenstart(heute: string): string {
  const [y, m] = heute.split("-").map(Number);
  const naechster = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  return `${naechster.y}-${String(naechster.m).padStart(2, "0")}-01`;
}

/**
 * Legt die Monatsraten eines Abos in `package_instalments` an.
 *
 * Bewusst dieselbe Tabelle wie beim alten Ratenmodell: der ganze
 * Zahlungs-Workflow (Rechnung stellen, „ich habe bezahlt“, Admin bestätigt,
 * überfällig markieren) hängt daran und funktioniert unverändert weiter.
 * Ein Abo ist zahlungstechnisch nichts anderes als ein Plan mit gleich
 * hohen Monatsbeträgen und ohne Anzahlung.
 */
export async function legeMonatsratenAn(
  admin: SupabaseClient,
  params: {
    packageId: string;
    studentId: string;
    gesamtpreis: number;
    laufzeitMonate: number;
    periodeStart: string;
  }
): Promise<{ anzahl: number } | { error: string }> {
  const raten = baueMonatsraten(
    params.gesamtpreis,
    params.laufzeitMonate,
    params.periodeStart
  );

  const { error } = await admin.from("package_instalments").insert(
    raten.map((r) => ({
      package_id: params.packageId,
      student_id: params.studentId,
      sequence: r.sequenz,
      // Es gibt keine Anzahlung mehr – jeder Monat ist eine gleichwertige
      // Rate. `kind` bleibt trotzdem gesetzt, weil die Spalte es verlangt.
      kind: "rate",
      amount: r.betrag,
      due_date: r.faellig,
      status: "open",
    }))
  );

  if (error) return { error: error.message };
  return { anzahl: raten.length };
}
