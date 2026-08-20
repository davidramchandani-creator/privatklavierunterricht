// ============================================================
// Monatsabrechnung: Daten holen
//
// Einnahmen kommen aus zwei Quellen, die bewusst getrennt bleiben:
//   1. Bezahlte Rechnungen — echte Zahlungen mit Datum
//   2. Externe Schüler — hochgerechnet aus gehaltenen Lektionen mal
//      hinterlegtem Ertrag, weil diese Zahlungen über die Plattform laufen
//      und hier nie auftauchen
//
// Die zweite Zahl ist eine Schätzung und wird auch so ausgewiesen. Sie
// einfach in die Summe zu werfen wäre bequem und falsch: David muss beim
// Ausfüllen der Steuererklärung wissen, welche Zahl belegt ist.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  baueAbrechnung,
  monatsSchluessel,
  type Ausgabe,
  type AusgabeKategorie,
  type Einnahme,
  type Monatsabrechnung,
} from "./abrechnung";

/** Erster und letzter Moment eines Monats (YYYY-MM) in UTC. */
function monatsGrenzen(monat: string): { von: Date; bis: Date } {
  const [j, m] = monat.split("-").map(Number);
  // Zürich ist UTC+1/+2; ein Tag Puffer an beiden Enden, gefiltert wird
  // danach exakt über monatsSchluessel().
  return {
    von: new Date(Date.UTC(j, m - 1, 1, -12, 0)),
    bis: new Date(Date.UTC(j, m, 1, 12, 0)),
  };
}

export async function ladeAbrechnung(
  admin: SupabaseClient,
  monat: string
): Promise<Monatsabrechnung> {
  const { von, bis } = monatsGrenzen(monat);

  const [{ data: rechnungen }, { data: ausgabenRows }, { data: externeTermine }] =
    await Promise.all([
      admin
        .from("invoices")
        .select("amount, paid_at, invoice_number, description, profiles(vorname, nachname)")
        .not("paid_at", "is", null)
        .gte("paid_at", von.toISOString())
        .lt("paid_at", bis.toISOString()),
      admin
        .from("betriebsausgaben")
        .select("id, datum, kategorie, betrag, notiz")
        .gte("datum", von.toISOString().slice(0, 10))
        .lte("datum", bis.toISOString().slice(0, 10)),
      // Gehaltene Lektionen externer Schüler. `booked` zählt mit, sobald
      // der Termin vorbei ist — bei Externen wird selten nachgepflegt, und
      // eine gehaltene Lektion ist auch ohne Statuswechsel Einkommen.
      admin
        .from("appointments")
        .select("start_at, status, profiles!inner(vorname, nachname, extern, plattform, externer_ertrag)")
        .eq("profiles.extern", true)
        .in("status", ["booked", "completed"])
        .gte("start_at", von.toISOString())
        .lt("start_at", bis.toISOString()),
    ]);

  type RechnungRow = {
    amount: number | string;
    paid_at: string;
    invoice_number: string | null;
    description: string | null;
    profiles?: { vorname?: string | null; nachname?: string | null } | null;
  };
  type ExternRow = {
    start_at: string;
    profiles: {
      vorname?: string | null;
      nachname?: string | null;
      plattform?: string | null;
      externer_ertrag?: number | string | null;
    };
  };

  const jetzt = new Date();

  const einnahmen: Einnahme[] = [
    ...((rechnungen ?? []) as unknown as RechnungRow[]).map((r) => ({
      datum: r.paid_at,
      betrag: Number(r.amount ?? 0),
      quelle: "rechnung" as const,
      bezeichnung:
        `${r.profiles?.vorname ?? ""} ${r.profiles?.nachname ?? ""}`.trim() ||
        r.description ||
        r.invoice_number ||
        "Rechnung",
    })),
    ...((externeTermine ?? []) as unknown as ExternRow[])
      // Nur was schon stattgefunden hat. Ein Termin nächste Woche ist noch
      // kein Einkommen, auch wenn er im selben Monat liegt.
      .filter((t) => new Date(t.start_at) <= jetzt)
      .filter((t) => Number(t.profiles?.externer_ertrag ?? 0) > 0)
      .map((t) => ({
        datum: t.start_at,
        betrag: Number(t.profiles.externer_ertrag),
        quelle: "extern" as const,
        bezeichnung: `${t.profiles.vorname ?? ""} ${t.profiles.nachname ?? ""}`.trim() +
          (t.profiles.plattform ? ` (${t.profiles.plattform})` : ""),
      })),
  ];

  const ausgaben: Ausgabe[] = ((ausgabenRows ?? []) as unknown as {
    id: string;
    datum: string;
    kategorie: string;
    betrag: number | string;
    notiz: string | null;
  }[]).map((a) => ({
    id: a.id,
    datum: a.datum,
    kategorie: a.kategorie as AusgabeKategorie,
    betrag: Number(a.betrag),
    notiz: a.notiz,
  }));

  return baueAbrechnung({ monat, einnahmen, ausgaben });
}

/** Alle Monate eines Jahres, für die Jahresübersicht und den CSV-Export. */
export async function ladeJahr(
  admin: SupabaseClient,
  jahr: number
): Promise<Monatsabrechnung[]> {
  const monate = Array.from(
    { length: 12 },
    (_, i) => `${jahr}-${String(i + 1).padStart(2, "0")}`
  );
  // Nacheinander statt parallel: zwölf Monate mal drei Abfragen auf einmal
  // ist ein unnötiger Schwall auf die Datenbank, und schnell genug ist es
  // ohnehin.
  const ergebnis: Monatsabrechnung[] = [];
  for (const m of monate) ergebnis.push(await ladeAbrechnung(admin, m));
  return ergebnis;
}

/**
 * Erinnert David an die Ausgaben, wenn der Monat zu Ende geht.
 *
 * Läuft täglich über den Cron. Sendet höchstens einmal pro Monat — die
 * Sperre steht in `monatsabschluss.erinnert_am`, sonst kämen in den letzten
 * fünf Tagen fünf identische Mails.
 */
export async function erinnereAnAusgaben(
  admin: SupabaseClient,
  jetzt: Date = new Date()
): Promise<{ gesendet: boolean; grund?: string }> {
  const { istErinnerungsTag } = await import("./abrechnung");
  if (!istErinnerungsTag(jetzt)) {
    return { gesendet: false, grund: "noch nicht so weit" };
  }

  const monat = monatsSchluessel(jetzt);
  const monatsErster = `${monat}-01`;

  const { data: abschluss } = await admin
    .from("monatsabschluss")
    .select("monat, erinnert_am, ausgaben_erfasst")
    .eq("monat", monatsErster)
    .maybeSingle();

  if (abschluss?.erinnert_am) {
    return { gesendet: false, grund: "schon erinnert" };
  }
  if (abschluss?.ausgaben_erfasst) {
    return { gesendet: false, grund: "Ausgaben schon erfasst" };
  }

  const abrechnung = await ladeAbrechnung(admin, monat);
  const { sendEmailNow } = await import("./emails-outbox");
  await sendEmailNow(admin, "ausgaben_erinnerung", {
    monat,
    einnahmen: abrechnung.einnahmenTotal,
    ausgaben_bisher: abrechnung.ausgabenTotal,
    anzahl_ausgaben: abrechnung.ausgaben.length,
  });

  await admin.from("monatsabschluss").upsert(
    {
      monat: monatsErster,
      erinnert_am: new Date().toISOString(),
      ausgaben_erfasst: abschluss?.ausgaben_erfasst ?? false,
    },
    { onConflict: "monat" }
  );

  return { gesendet: true };
}
