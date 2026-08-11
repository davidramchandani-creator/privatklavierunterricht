import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Welche Schüler eine Berechnung betrifft.
 *
 * Test- und echte Schüler dürfen nie in derselben Rechnung landen. Nicht aus
 * Ordnungsliebe: eine Route über fünf erfundene und sieben echte Adressen
 * ergibt Fahrzeiten, Gruppen und Empfehlungen, die für keinen der beiden
 * Fälle stimmen. Das Ergebnis sähe plausibel aus und wäre trotzdem falsch —
 * die unangenehmste Sorte Fehler.
 *
 * Darum ein Begriff statt eines Filters an jeder einzelnen Abfragestelle:
 * wer eine neue Auswertung baut, muss sich entscheiden, statt es zu vergessen.
 */
export type Kreis = "echt" | "test";

export function istTest(kreis: Kreis): boolean {
  return kreis === "test";
}

/**
 * Womit gerechnet wird, wenn niemand etwas anderes sagt.
 *
 * Solange Testschüler existieren, ist ein Testlauf im Gange — dann ist die
 * Testsicht die richtige Vorgabe. Sind keine da, gibt es nichts zu
 * verwechseln.
 */
export async function standardKreis(admin: SupabaseClient): Promise<Kreis> {
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("ist_test", true);

  return (count ?? 0) > 0 ? "test" : "echt";
}

export const KREIS_LABEL: Record<Kreis, string> = {
  echt: "Echte Schüler",
  test: "Testschüler",
};
