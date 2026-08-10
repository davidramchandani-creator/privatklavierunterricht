"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  empfohleneVariante,
  planeRouten,
  vergleicheMitUnsortiert,
  vergleicheTagesanzahl,
  type Routenplan,
  type TagesanzahlVariante,
  type Vergleich,
} from "@/lib/routing";
import {
  geokodiereOffene,
  ladePlanEingabe,
  setzeZuhause,
  speicherePlan,
} from "@/lib/routing-server";

/**
 * Alle Aktionen hier verändern oder lesen Daten aller Schüler. Server Actions
 * sind unabhängig von der Seitennavigation aufrufbar — die Rollenprüfung muss
 * also in jeder einzelnen stehen, nicht nur in der Middleware.
 */
async function assertAdmin(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profil?.role !== "admin") return { error: "Keine Berechtigung." };
  return null;
}

export type PlanErgebnis = {
  plan: Routenplan;
  vergleich: Vergleich;
  varianten: TagesanzahlVariante[];
  empfehlung: TagesanzahlVariante | null;
  zuhauseAdresse: string;
  ohneKoordinaten: { name: string; adresse: string | null }[];
};

/**
 * Rechnet den Wochenplan durch.
 *
 * Das Ergebnis ist ein **Vorschlag**: es wird nichts gebucht und nichts
 * verändert. Erst „Als Fixplätze übernehmen“ macht daraus Termine.
 */
export async function berechnePlan(optionen: {
  nurFixplatz?: boolean;
  pufferMinuten?: number;
}): Promise<PlanErgebnis | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const kontext = await ladePlanEingabe(admin, {
    nurFixplatz: optionen.nurFixplatz,
    pufferMinuten: optionen.pufferMinuten,
  });

  if (kontext.eingabe.schueler.length === 0) {
    return {
      error: optionen.nurFixplatz
        ? "Es gibt noch keine Schüler mit Fixplatz."
        : "Es sind keine aktiven Schüler vorhanden.",
    };
  }

  const plan = planeRouten(kontext.eingabe);
  const vergleich = vergleicheMitUnsortiert(plan, kontext.eingabe);
  const varianten = vergleicheTagesanzahl(kontext.eingabe);

  return {
    plan,
    vergleich,
    varianten,
    empfehlung: empfohleneVariante(varianten),
    zuhauseAdresse: kontext.zuhauseAdresse,
    ohneKoordinaten: kontext.ohneKoordinaten.map((s) => ({
      name: s.name,
      adresse: s.adresse,
    })),
  };
}

/**
 * Holt fehlende Koordinaten nach. Läuft absichtlich gedrosselt und kann bei
 * vielen Schülern eine Weile dauern.
 */
export async function adressenGeokodieren(): Promise<
  { erledigt: number; fehlgeschlagen: { name: string; adresse: string }[] } | { error: string }
> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const ergebnis = await geokodiereOffene(admin);
  revalidatePath("/admin/routenplanung");
  return ergebnis;
}

/** Ausgangspunkt der Routen setzen (Daves Adresse). */
export async function zuhauseSetzen(
  adresse: string
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  if (!adresse.trim()) return { error: "Bitte eine Adresse angeben." };

  const admin = await createAdminClient();
  const ergebnis = await setzeZuhause(admin, adresse.trim());
  if ("error" in ergebnis) return ergebnis;

  revalidatePath("/admin/routenplanung");
  return { success: true, error: undefined };
}

/** Einen berechneten Plan zum Nachschlagen ablegen. */
export async function planSpeichern(
  titel: string,
  plan: Routenplan
): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const id = await speicherePlan(admin, titel || "Wochenplan", plan, {
    fahrzeitSekunden: plan.fahrzeitProWoche,
    lektionen: plan.lektionenProWoche,
  });
  if (!id) return { error: "Der Plan konnte nicht gespeichert werden." };

  revalidatePath("/admin/routenplanung");
  return { success: true, error: undefined };
}
