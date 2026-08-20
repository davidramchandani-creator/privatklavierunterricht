import { createAdminClient } from "@/lib/supabase/server";
import { ladeAbrechnung, ladeJahr } from "@/lib/abrechnung-server";
import { monatsSchluessel } from "@/lib/abrechnung";
import AbrechnungBoard from "./_components/AbrechnungBoard";

/**
 * Monatsabrechnung für die Steuererklärung.
 *
 * Einnahmen kommen aus dem System, Ausgaben trägt David hier ein. Kurz vor
 * Monatsende erinnert ihn eine Mail daran — nicht aus Ordnungsliebe,
 * sondern weil im Februar niemand mehr weiss, wofür die Tankquittung vom
 * 12. war.
 */
export default async function AbrechnungPage({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string; jahr?: string }>;
}) {
  const params = await searchParams;
  const admin = await createAdminClient();

  const jetzt = new Date();
  const monat =
    params.monat && /^\d{4}-\d{2}$/.test(params.monat)
      ? params.monat
      : monatsSchluessel(jetzt);
  const jahr = Number(params.jahr) || Number(monat.slice(0, 4));

  const [abrechnung, jahresMonate, { data: abschluss }] = await Promise.all([
    ladeAbrechnung(admin, monat),
    ladeJahr(admin, jahr),
    admin
      .from("monatsabschluss")
      .select("monat, ausgaben_erfasst")
      .eq("monat", `${monat}-01`)
      .maybeSingle(),
  ]);

  return (
    <AbrechnungBoard
      monat={monat}
      jahr={jahr}
      abrechnung={abrechnung}
      jahresMonate={jahresMonate}
      erfasst={abschluss?.ausgaben_erfasst === true}
    />
  );
}
