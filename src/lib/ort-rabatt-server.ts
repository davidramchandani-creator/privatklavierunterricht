import type { SupabaseClient } from "@supabase/supabase-js";
import { roundRappen } from "./subscription";
import { umrechnenBeiWechsel } from "./ort-rabatt";

/**
 * Wechsel zwischen Hausbesuch und Unterricht bei David: laufende Preise
 * sofort anpassen. (Angabe David, 28. Oktober 2026: „Sofort für offene
 * Raten".)
 *
 * Angepasst wird, was noch nicht gestellt ist:
 *   - Raten mit Status `open` (geplant, noch keine Rechnung)
 *   - der Preis pro Lektion des laufenden Pakets oder Abos, damit künftige
 *     Einzelabrechnungen den neuen Preis haben
 *   - Gesamtpreis und Monatsbetrag, damit Bestätigung und PDF stimmen
 *
 * Bereits gestellte oder bezahlte Raten und Rechnungen bleiben, wie sie
 * sind. Eine Rechnung, die draussen ist, wird nicht nachträglich geändert.
 */
export async function wendeOrtWechselAn(
  admin: SupabaseClient,
  studentId: string,
  kommtJetztZuDavid: boolean
): Promise<{ raten: number; pakete: number }> {
  const { data: pakete } = await admin
    .from("packages")
    .select("id, price_per_lesson, abo_variante")
    .eq("student_id", studentId)
    .in("status", ["active", "scheduled"]);

  let raten = 0;
  for (const p of pakete ?? []) {
    const { data: zeilen } = await admin
      .from("package_instalments")
      .select("id, amount, status, due_date")
      .eq("package_id", p.id)
      .neq("status", "cancelled")
      .order("sequence");

    let ersteOffene: number | null = null;
    let summe = 0;
    for (const z of zeilen ?? []) {
      let betrag = Number(z.amount);
      if (z.status === "open") {
        betrag = umrechnenBeiWechsel(betrag, kommtJetztZuDavid);
        await admin.from("package_instalments").update({ amount: betrag }).eq("id", z.id);
        raten++;
        if (ersteOffene === null) ersteOffene = betrag;
      }
      summe += betrag;
    }

    const aenderung: Record<string, unknown> = {
      price_per_lesson: umrechnenBeiWechsel(Number(p.price_per_lesson ?? 0), kommtJetztZuDavid),
    };
    if ((zeilen ?? []).length > 0) {
      aenderung.total_price = roundRappen(summe);
      if (p.abo_variante && ersteOffene !== null) aenderung.monatsbetrag = ersteOffene;
    }
    await admin.from("packages").update(aenderung).eq("id", p.id);
  }

  return { raten, pakete: (pakete ?? []).length };
}
