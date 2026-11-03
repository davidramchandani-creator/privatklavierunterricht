import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { LESSON_DURATION_MIN, STUDIO_PAUSE_MIN } from "./booking";
import { findeFixplaetze } from "./fixplatz-suche";
import { platzstufe, zaehlePlaetze, type Platzstatus } from "./platzstatus";

export const PLATZSTATUS_TAG = "platzstatus";

/**
 * Wie viele Lektionen alle zwei Wochen geprüft werden. Sechs sind zwölf
 * Wochen: lang genug, dass ein Platz nicht nur nächste Woche frei ist,
 * kurz genug, dass Davids nächster Stundenplan (neues Semester) die Zahl
 * nicht verfälscht.
 */
const PRUEF_LEKTIONEN = 6;

/**
 * Ein Platz zählt als frei, wenn mindestens 5 von 6 Terminen frei sind.
 * Ein einzelner Eintrag in Davids Kalender soll keinen ganzen Platz
 * verschwinden lassen, dafür gibt es Ausweichtermine.
 */
const MINDEST_QUOTE = 0.8;

async function berechne(): Promise<Platzstatus> {
  const admin = createAdminClient();

  const [angebote, { count }] = await Promise.all([
    findeFixplaetze(admin, {
      // Keine Person: eine neue Anmeldung, die ins Studio kommt.
      studentId: "",
      rhythmus: "zweiwoechentlich",
      lessons: PRUEF_LEKTIONEN,
      mindestQuote: MINDEST_QUOTE,
    }).catch(() => []),
    admin
      .from("warteliste")
      .select("id", { count: "exact", head: true })
      .in("status", ["wartend", "angeboten"]),
  ]);

  const freiePlaetze = zaehlePlaetze(angebote, LESSON_DURATION_MIN + STUDIO_PAUSE_MIN);
  return {
    freiePlaetze,
    wartende: count ?? 0,
    stufe: platzstufe(freiePlaetze),
  };
}

/**
 * Der Platzstatus für die Webseite, eine Stunde zwischengespeichert.
 *
 * Die Berechnung prüft jede mögliche Startzeit über zwölf Wochen und ist
 * zu teuer für jeden Seitenaufruf. Nach einer Buchung oder einer neuen
 * Wartelisten-Anmeldung wird der Speicher über `PLATZSTATUS_TAG` geleert.
 */
export const ladePlatzstatus = unstable_cache(berechne, ["platzstatus-v1"], {
  revalidate: 3600,
  tags: [PLATZSTATUS_TAG],
});
