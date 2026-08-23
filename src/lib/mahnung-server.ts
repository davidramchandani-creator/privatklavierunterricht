// ============================================================
// Mahnwesen: offene Rechnungen nachfassen
//
// Läuft täglich im Cron. Die Fristen und die Entscheidung liegen in
// mahnung.ts, hier nur Laden, Senden, Vermerken.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { entscheide, type OffeneRechnung } from "./mahnung";

type RechnungRow = {
  id: string;
  status: string;
  amount: number | string;
  due_date: string | null;
  erstellt_am: string;
  invoice_number: string | null;
  description: string | null;
  lesson_date: string | null;
  student_id: string;
  mahnstufe: number | null;
  erinnert_am: string | null;
  bestaetigung_erinnert_am: string | null;
  profiles?: {
    vorname: string | null;
    nachname: string | null;
    ist_test: boolean | null;
    extern: boolean | null;
  } | null;
};

export type MahnErgebnis = {
  erinnert: number;
  adminHinweise: number;
};

/**
 * Fasst offene Rechnungen nach.
 *
 * Testschüler und Externe bleiben aussen vor: Testdaten dürfen niemandem
 * schreiben, und Externe bekommen aus diesem System grundsätzlich keine
 * Post — ihre Zahlungen laufen über die Plattform.
 */
export async function mahneOffeneRechnungen(
  admin: SupabaseClient,
  jetzt: Date = new Date()
): Promise<MahnErgebnis> {
  const { data } = await admin
    .from("invoices")
    .select(
      "id, status, amount, due_date, erstellt_am, invoice_number, description, lesson_date, student_id, mahnstufe, erinnert_am, bestaetigung_erinnert_am, profiles!inner(vorname, nachname, ist_test, extern)"
    )
    .is("paid_at", null)
    .in("status", ["unpaid", "pending_confirmation"])
    .eq("profiles.ist_test", false)
    .eq("profiles.extern", false);

  const rows = (data ?? []) as unknown as RechnungRow[];
  if (rows.length === 0) return { erinnert: 0, adminHinweise: 0 };

  const { sendEmailNow } = await import("./emails-outbox");

  let erinnert = 0;
  let adminHinweise = 0;

  for (const r of rows) {
    const zustand: OffeneRechnung = {
      id: r.id,
      status: r.status,
      faellig: r.due_date,
      erstellt: r.erstellt_am,
      mahnstufe: Number(r.mahnstufe ?? 0),
      erinnertAm: r.erinnert_am,
      bestaetigungErinnertAm: r.bestaetigung_erinnert_am,
    };
    const was = entscheide(zustand, jetzt);
    if (was.art === "keine") continue;

    const name =
      `${r.profiles?.vorname ?? ""} ${r.profiles?.nachname ?? ""}`.trim() ||
      "Unbekannt";
    const bezeichnung =
      r.description || r.invoice_number || "Klavierunterricht";

    if (was.art === "schueler_erinnern") {
      await sendEmailNow(admin, "zahlung_erinnerung", {
        student_id: r.student_id,
        student_name: name,
        betrag: Number(r.amount ?? 0),
        bezeichnung,
        invoice_number: r.invoice_number,
        lesson_date: r.lesson_date,
        faellig: r.due_date,
        stufe: was.stufe,
      });
      await admin
        .from("invoices")
        .update({
          mahnstufe: was.stufe,
          erinnert_am: jetzt.toISOString(),
        })
        .eq("id", r.id);
      erinnert++;

      // Nach der zweiten Erinnerung übernimmt David. Ohne diesen Hinweis
      // wüsste er nicht, dass das System aufgehört hat nachzufassen.
      if (was.stufe === 2) {
        await sendEmailNow(admin, "zahlung_ueberfaellig_admin", {
          student_id: r.student_id,
          student_name: name,
          betrag: Number(r.amount ?? 0),
          bezeichnung,
          invoice_number: r.invoice_number,
          faellig: r.due_date,
        });
        adminHinweise++;
      }
      continue;
    }

    // Gemeldete Zahlung wartet auf Bestätigung.
    await sendEmailNow(admin, "bestaetigung_offen_admin", {
      student_id: r.student_id,
      student_name: name,
      betrag: Number(r.amount ?? 0),
      bezeichnung,
      invoice_number: r.invoice_number,
    });
    await admin
      .from("invoices")
      .update({ bestaetigung_erinnert_am: jetzt.toISOString() })
      .eq("id", r.id);
    adminHinweise++;
  }

  return { erinnert, adminHinweise };
}
