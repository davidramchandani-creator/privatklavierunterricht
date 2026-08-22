// ============================================================
// Monatsabrechnung: Daten holen
//
// Einnahmen kommen aus drei Quellen:
//   1. Bezahlte Rechnungen — echte Zahlungen mit Datum
//   2. Bestätigte externe Zahlungen — David hat den Eingang von der
//      Plattform selbst erfasst, ebenso belegt wie eine Rechnung
//   3. Noch nicht bestätigte externe Lektionen — hochgerechnet aus
//      gehaltenen Lektionen mal hinterlegtem Ertrag
//
// Die dritte Zahl ist eine Schätzung, bleibt getrennt und geht nicht ins
// Total. Sie einfach mitzuaddieren wäre bequem und falsch: David muss beim
// Ausfüllen der Steuererklärung wissen, welche Zahl belegt ist.
//
// Testschüler bleiben überall draussen. Ein Probelauf darf die Zahlen für
// die Steuererklärung nicht anfassen.
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

  const [
    { data: rechnungen },
    { data: ausgabenRows },
    { data: externeTermine },
    { data: externeZahlungen },
  ] = await Promise.all([
    admin
      .from("invoices")
      .select(
        "amount, paid_at, invoice_number, description, profiles!inner(vorname, nachname, ist_test)"
      )
      .not("paid_at", "is", null)
      .eq("profiles.ist_test", false)
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
      .select(
        "id, start_at, status, profiles!inner(vorname, nachname, extern, ist_test, plattform, externer_ertrag)"
      )
      .eq("profiles.extern", true)
      .eq("profiles.ist_test", false)
      .in("status", ["booked", "completed"])
      .gte("start_at", von.toISOString())
      .lt("start_at", bis.toISOString()),
    // Bestätigte Eingänge. Nach Zahlungsdatum gefiltert wie die
    // Rechnungen — die Lektion kann in einem anderen Monat liegen.
    admin
      .from("externe_zahlungen")
      .select(
        "appointment_id, betrag, bezahlt_am, profiles!inner(vorname, nachname, plattform, ist_test)"
      )
      .eq("profiles.ist_test", false)
      .gte("bezahlt_am", von.toISOString())
      .lt("bezahlt_am", bis.toISOString()),
  ]);

  type RechnungRow = {
    amount: number | string;
    paid_at: string;
    invoice_number: string | null;
    description: string | null;
    profiles?: { vorname?: string | null; nachname?: string | null } | null;
  };
  type ExternRow = {
    id: string;
    start_at: string;
    profiles: {
      vorname?: string | null;
      nachname?: string | null;
      plattform?: string | null;
      externer_ertrag?: number | string | null;
    };
  };
  type ZahlungRow = {
    appointment_id: string;
    betrag: number | string;
    bezahlt_am: string;
    profiles?: {
      vorname?: string | null;
      nachname?: string | null;
      plattform?: string | null;
    } | null;
  };

  const jetzt = new Date();
  const zahlungen = (externeZahlungen ?? []) as unknown as ZahlungRow[];
  // Welche Lektionen bereits bestätigt sind. Ohne diese Sperre stünde eine
  // bestätigte Lektion zweimal da: einmal als echte Zahlung, einmal als
  // Schätzung derselben Lektion.
  const bestaetigt = new Set(zahlungen.map((z) => z.appointment_id));

  const einnahmen: Einnahme[] = [
    ...((rechnungen ?? []) as unknown as RechnungRow[]).map((r) => ({
      datum: r.paid_at,
      betrag: Number(r.amount ?? 0),
      quelle: "rechnung" as const,
      belegt: true,
      bezeichnung:
        `${r.profiles?.vorname ?? ""} ${r.profiles?.nachname ?? ""}`.trim() ||
        r.description ||
        r.invoice_number ||
        "Rechnung",
    })),
    ...zahlungen.map((z) => ({
      // Nach Zahlungseingang, nicht nach Lektionsdatum — dieselbe Regel wie
      // bei den Rechnungen.
      datum: z.bezahlt_am,
      betrag: Number(z.betrag ?? 0),
      quelle: "extern" as const,
      belegt: true,
      bezeichnung:
        `${z.profiles?.vorname ?? ""} ${z.profiles?.nachname ?? ""}`.trim() +
        (z.profiles?.plattform ? ` (${z.profiles.plattform})` : ""),
    })),
    ...((externeTermine ?? []) as unknown as ExternRow[])
      .filter((t) => !bestaetigt.has(t.id))
      // Nur was schon stattgefunden hat. Ein Termin nächste Woche ist noch
      // kein Einkommen, auch wenn er im selben Monat liegt.
      .filter((t) => new Date(t.start_at) <= jetzt)
      .filter((t) => Number(t.profiles?.externer_ertrag ?? 0) > 0)
      .map((t) => ({
        datum: t.start_at,
        betrag: Number(t.profiles.externer_ertrag),
        quelle: "extern" as const,
        belegt: false,
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
