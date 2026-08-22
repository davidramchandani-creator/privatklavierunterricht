// ============================================================
// Monatsprognose: Daten holen
//
// Sammelt die drei Töpfe (bezahlt / gestellt / erwartet) aus vier Quellen:
// Rechnungen, Lektionen mit Einzelabrechnung, Monatsraten und externen
// Lektionen. Die Regel, welche Lektion überhaupt Geld erwarten lässt,
// steht in prognose.ts — hier wird nur geladen.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { monatsSchluessel, type Monatsabrechnung } from "./abrechnung";
import {
  bauePrognose,
  erwarteterBetragProLektion,
  type ErwarteteEinnahme,
  type Monatsprognose,
} from "./prognose";

/** Grosszügige Grenzen um den Monat; exakt gefiltert wird über den Schlüssel. */
function grenzen(monat: string): { von: Date; bis: Date } {
  const [j, m] = monat.split("-").map(Number);
  return {
    von: new Date(Date.UTC(j, m - 1, 1, -12, 0)),
    bis: new Date(Date.UTC(j, m, 1, 12, 0)),
  };
}

type TerminRow = {
  id: string;
  start_at: string;
  profiles: {
    vorname: string | null;
    nachname: string | null;
    extern: boolean | null;
    ist_test: boolean | null;
    plattform: string | null;
    externer_ertrag: number | string | null;
  } | null;
  packages: {
    billing_mode: string | null;
    price_per_lesson: number | string | null;
  } | null;
};

/** Supabase liefert eingebettete Relationen mal als Objekt, mal als Liste. */
function eins<T>(wert: T | T[] | null | undefined): T | null {
  if (Array.isArray(wert)) return wert[0] ?? null;
  return wert ?? null;
}

export async function ladePrognose(
  admin: SupabaseClient,
  monat: string,
  /** Bereits geladene Abrechnung — liefert den belegten Teil. */
  abrechnung: Monatsabrechnung
): Promise<Monatsprognose> {
  const { von, bis } = grenzen(monat);

  const [
    { data: offeneRechnungen },
    { data: termine },
    { data: raten },
    { data: externZahlungen },
  ] = await Promise.all([
    // Gestellt, aber nicht bezahlt. Archivierte zählen nicht: Sie wurden
    // zurückgezogen, das Geld kommt nicht.
    admin
      .from("invoices")
      .select("amount, due_date, erstellt_am, status, paid_at, profiles!inner(ist_test)")
      .is("paid_at", null)
      .neq("status", "archived")
      .eq("profiles.ist_test", false),
    admin
      .from("appointments")
      .select(
        "id, start_at, profiles!inner(vorname, nachname, extern, ist_test, plattform, externer_ertrag), packages(billing_mode, price_per_lesson)"
      )
      .in("status", ["booked", "completed"])
      .eq("profiles.ist_test", false)
      .gte("start_at", von.toISOString())
      .lt("start_at", bis.toISOString()),
    // Noch nicht fakturierte Raten. Mit Rechnung stehen sie schon im Topf
    // „gestellt" — hier nochmals mitzuzählen wäre doppelt.
    admin
      .from("package_instalments")
      .select("amount, due_date, kind, sequence, status, invoice_id, profiles!inner(vorname, nachname, ist_test)")
      .is("invoice_id", null)
      .neq("status", "cancelled")
      .gte("due_date", von.toISOString().slice(0, 10))
      .lte("due_date", bis.toISOString().slice(0, 10))
      .eq("profiles.ist_test", false),
    admin.from("externe_zahlungen").select("appointment_id"),
  ]);

  // ── Gestellt ──────────────────────────────────────────────
  const gestellt = ((offeneRechnungen ?? []) as unknown as {
    amount: number | string;
    due_date: string | null;
    erstellt_am: string;
  }[])
    .filter((r) => monatsSchluessel(r.due_date ?? r.erstellt_am) === monat)
    .reduce((s, r) => s + Number(r.amount ?? 0), 0);

  // ── Erwartet ──────────────────────────────────────────────
  const schonBezahlt = new Set(
    (externZahlungen ?? []).map((z) => z.appointment_id as string)
  );

  // Welche Lektionen bereits eine lebende Rechnung haben. Dieselbe Regel
  // wie im Zahlungen-Reiter: bezahlt bleibt bezahlt, nur eine unbezahlt
  // archivierte Rechnung gibt die Lektion wieder frei.
  const { data: bestehende } = await admin
    .from("invoices")
    .select("appointment_id, status, paid_at")
    .not("appointment_id", "is", null);
  const fakturiert = new Set(
    (bestehende ?? [])
      .filter((r) => r.status !== "archived" || r.paid_at != null)
      .map((r) => r.appointment_id as string)
  );

  const posten: ErwarteteEinnahme[] = [];

  for (const roh of (termine ?? []) as unknown as TerminRow[]) {
    const profil = eins(roh.profiles);
    const paket = eins(roh.packages);
    if (!profil) continue;

    const name =
      `${profil.vorname ?? ""} ${profil.nachname ?? ""}`.trim() || "Unbekannt";

    if (profil.extern === true) {
      // Extern: die Plattform zahlt pro Lektion. Was David schon bestätigt
      // hat, steckt im belegten Topf und darf hier nicht nochmals stehen.
      if (schonBezahlt.has(roh.id)) continue;
      const betrag = Number(profil.externer_ertrag ?? 0);
      if (!(betrag > 0)) continue;
      posten.push({
        datum: roh.start_at,
        betrag,
        quelle: "extern",
        bezeichnung: profil.plattform ? `${name} (${profil.plattform})` : name,
      });
      continue;
    }

    if (fakturiert.has(roh.id)) continue;
    const betrag = erwarteterBetragProLektion(paket);
    if (betrag <= 0) continue;
    posten.push({
      datum: roh.start_at,
      betrag,
      quelle: "lektion",
      bezeichnung: name,
    });
  }

  for (const roh of (raten ?? []) as unknown as {
    amount: number | string;
    due_date: string;
    kind: string;
    sequence: number;
    profiles: { vorname: string | null; nachname: string | null } | null;
  }[]) {
    const profil = eins(roh.profiles);
    const name =
      `${profil?.vorname ?? ""} ${profil?.nachname ?? ""}`.trim() || "Unbekannt";
    posten.push({
      datum: roh.due_date,
      betrag: Number(roh.amount ?? 0),
      quelle: "rate",
      bezeichnung:
        roh.kind === "deposit" ? `${name} — Anzahlung` : `${name} — Rate ${roh.sequence}`,
    });
  }

  return bauePrognose({
    monat,
    bezahlt: abrechnung.einnahmenTotal,
    gestellt,
    erwartet: posten,
  });
}
