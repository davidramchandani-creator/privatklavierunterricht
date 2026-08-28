// ============================================================
// Die Erinnerung, nach der Lektion etwas einzutragen
//
// ── Warum nicht exakt 15 Minuten nach jeder Stunde ──────────
//
// Weil es nichts gibt, das dann laufen würde. Der Vercel-Hobby-Plan erlaubt
// nur **tägliche** Cron-Ausdrücke; alles Häufigere lehnt Vercel ab, und zwar
// stillschweigend das ganze Deployment (das hat uns schon einmal zwei Tage
// gekostet, siehe docs/CI-CD.md).
//
// Also einmal am Abend, nach dem letzten möglichen Unterrichtsende, eine
// Mitteilung über alle Lektionen des Tages. Das ist sogar das angenehmere
// Verhalten: ein Klingeln statt vier.
//
// Wer es wirklich nach jeder einzelnen Stunde will, hängt einen externen
// Aufrufer (cron-job.org o. ä.) auf dieselbe Route. Diese Funktion ist darauf
// vorbereitet — sie schickt nie zweimal am selben Tag dieselbe Mitteilung und
// verträgt es, im Viertelstundentakt aufgerufen zu werden.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToAdmin } from "./push";
import { ladeOffeneNotizen } from "./lektionsnotizen-server";
import { utcToZonedDate } from "./booking";

/** Zürcher Kalendertag als YYYY-MM-DD. */
function tag(d: Date): string {
  const c = utcToZonedDate(d);
  return `${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;
}

const SCHLUESSEL = "notiz_erinnerung";

export type ErinnerungsErgebnis = {
  gesendet: boolean;
  offen: number;
  grund?: string;
};

/**
 * Erinnert an Lektionen ohne Eintrag.
 *
 * Höchstens einmal je Kalendertag und nur, wenn tatsächlich etwas offen ist.
 * Eine Mitteilung, die auch dann kommt, wenn nichts zu tun ist, wird nach
 * zwei Wochen weggewischt, ohne gelesen zu werden — und dann ist auch die
 * wichtige weg.
 */
export async function erinnereAnNotizen(
  admin: SupabaseClient,
  jetzt: Date = new Date()
): Promise<ErinnerungsErgebnis> {
  const heute = tag(jetzt);

  const { data: stand } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", SCHLUESSEL)
    .maybeSingle();

  if ((stand?.value as { tag?: string } | null)?.tag === heute) {
    return { gesendet: false, offen: 0, grund: "heute schon erinnert" };
  }

  const offen = await ladeOffeneNotizen(admin, jetzt);
  if (offen.length === 0) {
    // Bewusst **kein** Vermerk: Wenn um 21 Uhr nichts offen ist, um 22 Uhr
    // aber schon (nachgetragener Termin), soll die Erinnerung noch kommen
    // können. Der Vermerk entsteht erst mit dem Versand.
    return { gesendet: false, offen: 0, grund: "nichts offen" };
  }

  const namen = offen.slice(0, 3).map((l) => l.name).join(", ");
  const rest = offen.length > 3 ? ` und ${offen.length - 3} weitere` : "";

  await sendPushToAdmin(admin, {
    title:
      offen.length === 1 ? "Was lief in der Lektion?" : "Was lief heute?",
    body:
      offen.length === 1
        ? `${namen} — kurz eintragen?`
        : `${namen}${rest} — kurz eintragen?`,
    url: "/admin/lektionen",
    // Gleicher tag: Eine zweite Mitteilung ersetzt die erste, statt sich zu
    // stapeln.
    tag: "lektionsnotizen",
  });

  await admin
    .from("app_settings")
    .upsert({ key: SCHLUESSEL, value: { tag: heute } }, { onConflict: "key" });

  return { gesendet: true, offen: offen.length };
}
