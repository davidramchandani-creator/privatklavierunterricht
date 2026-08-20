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
import { standardKreis, type Kreis } from "@/lib/kreis";
import { schlageOptimierungen, type Optimierung } from "@/lib/optimierung";
import {
  geokodiereOffene,
  ladePlanEingabe,
  setzeFahrzeitManuell,
  setzeZuhause,
  speicherePlan,
} from "@/lib/routing-server";

/**
 * Alle Aktionen hier verändern oder lesen Daten aller Schüler. Server Actions
 * sind unabhängig von der Seitennavigation aufrufbar, die Rollenprüfung muss
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
  /**
   * Was sich an der Verfügbarkeit ändern liesse und was es brächte. Immer
   * auf Basis **aller** Fenster gerechnet, nicht der empfohlenen Auswahl —
   * sonst würde „Tag streichen" doppelt gemoppelt mit der Empfehlung.
   */
  optimierungen: Optimierung[];
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
  kreis?: Kreis;
}): Promise<PlanErgebnis | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const kreis = optionen.kreis ?? (await standardKreis(admin));
  const kontext = await ladePlanEingabe(admin, {
    nurFixplatz: optionen.nurFixplatz,
    pufferMinuten: optionen.pufferMinuten,
    kreis,
  });

  if (kontext.eingabe.schueler.length === 0) {
    if (kreis === "test") {
      return {
        error:
          "Es gibt keine Testschüler. Lege sie unter Testmodus an oder wechsle auf die echten Schüler.",
      };
    }
    return {
      error: optionen.nurFixplatz
        ? "Es gibt noch keine Schüler mit Fixplatz."
        : "Es sind keine aktiven Schüler vorhanden.",
    };
  }

  // Erst die Varianten rechnen, dann den Hauptplan — und zwar den der
  // **empfohlenen** Variante.
  //
  // Vorher zeigte die Seite den Plan über alle verfügbaren Tage, direkt
  // unter einer Tabelle, die weniger Tage empfahl: oben „2 Tage (Mo, Di)
  // empfohlen", darunter ein 3-Tage-Plan mit Donnerstag. Zwei Antworten auf
  // dieselbe Frage auf einem Bildschirm — die Tabelle wirkte kaputt.
  //
  // Jetzt gilt: Der grosse Plan ist die Empfehlung. Wer eine andere
  // Variante sehen will, findet sie in der Tabelle samt Kennzahlen. Gibt es
  // keine Empfehlung (in jeder Variante fiele jemand heraus), bleibt der
  // Plan über alle Tage — Kapazität vor Effizienz.
  const varianten = vergleicheTagesanzahl(kontext.eingabe);
  const empfehlung = empfohleneVariante(varianten);

  const fensterFuerPlan =
    empfehlung && empfehlung.wochentage.length > 0
      ? kontext.eingabe.fenster.filter((f) =>
          empfehlung.wochentage.includes(f.wochentag)
        )
      : kontext.eingabe.fenster;

  const eingabe = { ...kontext.eingabe, fenster: fensterFuerPlan };
  const plan = planeRouten(eingabe);
  const vergleich = vergleicheMitUnsortiert(plan, eingabe);

  // Auf allen Fenstern rechnen, nicht auf der empfohlenen Auswahl: Die
  // Vorschläge sollen Davids tatsächliche Verfügbarkeit verbessern, nicht
  // die bereits gefilterte.
  const optimierungen = schlageOptimierungen(kontext.eingabe);

  return {
    plan,
    vergleich,
    varianten,
    empfehlung,
    optimierungen,
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

/**
 * Eine Fahrzeit von Hand korrigieren.
 *
 * Daves Ortskenntnis schlägt jede Schätzung: Wenn er weiss, dass eine Strecke
 * um 17 Uhr zwanzig Minuten dauert, ist das der richtige Wert. Der Eintrag
 * gilt ab dem nächsten Rechnen und bleibt dauerhaft gespeichert.
 */
export async function fahrzeitKorrigieren(params: {
  vonLat: number;
  vonLng: number;
  nachLat: number;
  nachLng: number;
  minuten: number;
}): Promise<{ success: true; error: undefined } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  if (!Number.isFinite(params.minuten) || params.minuten < 0) {
    return { error: "Bitte eine Zeit in Minuten angeben." };
  }
  if (params.minuten > 180) {
    return { error: "Über drei Stunden Fahrzeit ist vermutlich ein Vertipper." };
  }
  for (const w of [params.vonLat, params.vonLng, params.nachLat, params.nachLng]) {
    if (!Number.isFinite(w)) return { error: "Ungültige Koordinaten." };
  }

  const admin = await createAdminClient();
  await setzeFahrzeitManuell(
    admin,
    { lat: params.vonLat, lng: params.vonLng },
    { lat: params.nachLat, lng: params.nachLng },
    params.minuten
  );

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
