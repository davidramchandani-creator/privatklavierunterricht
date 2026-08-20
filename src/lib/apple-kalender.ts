// ============================================================
// Apple-Kalender abrufen und als Sperrzeit eintragen
//
// David trägt Privates in seinen Apple-Kalender ein; ein öffentlicher
// iCal-Link wird hier regelmässig geholt und in `time_blocks` übersetzt.
// Damit greift die Sperre überall, wo `time_blocks` schon gelesen wird:
// Buchungs-Engine, Routenplanung, Zuteilung.
//
// Streng einseitig: Es wird nur gelesen. Nichts wird in Apples Kalender
// geschrieben oder dort gelöscht.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalisiereIcalUrl, parseIcal, type IcalTermin } from "./ical";

export const EINSTELLUNG_APPLE = "apple_kalender";


export type AppleEinstellung = {
  url: string;
  /** Titel im System. Der echte Termintitel bleibt privat, wenn das gewünscht ist. */
  titelUebernehmen: boolean;
  zuletztAbgerufen?: string | null;
  letzterFehler?: string | null;
  anzahl?: number | null;
};

/** Wie weit im Voraus Termine übernommen werden. */
export const VORLAUF_TAGE = 180;
/** Wie weit zurück. Vergangenes sperrt nichts mehr, ein Tag genügt für Übergänge. */
export const RUECKBLICK_TAGE = 1;

export async function ladeAppleEinstellung(
  admin: SupabaseClient
): Promise<AppleEinstellung | null> {
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", EINSTELLUNG_APPLE)
    .maybeSingle();

  const wert = data?.value as Partial<AppleEinstellung> | undefined;
  if (!wert?.url) return null;
  return {
    url: wert.url,
    titelUebernehmen: wert.titelUebernehmen !== false,
    zuletztAbgerufen: wert.zuletztAbgerufen ?? null,
    letzterFehler: wert.letzterFehler ?? null,
    anzahl: wert.anzahl ?? null,
  };
}

async function speichereEinstellung(
  admin: SupabaseClient,
  wert: AppleEinstellung
): Promise<void> {
  await admin
    .from("app_settings")
    .upsert({ key: EINSTELLUNG_APPLE, value: wert }, { onConflict: "key" });
}

/** Zürcher Datum und Uhrzeit eines Instants, für time_blocks (date + time). */
function zuercherTeile(d: Date): { datum: string; zeit: string } {
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  const [datum, zeit] = s.split(" ");
  return { datum, zeit: zeit.slice(0, 5) };
}

type Block = {
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  quelle: "apple";
  extern_uid: string;
};

/**
 * Einen Termin in Tagesblöcke zerlegen.
 *
 * Über Mitternacht laufende Termine müssen aufgeteilt werden, weil
 * `time_blocks` ein Datum plus zwei Uhrzeiten hält. Ohne Aufteilung ergäbe
 * ein Termin von 22:00 bis 01:00 den Block „22:00–01:00", und das ist für
 * jede Kollisionsprüfung ein leeres Intervall — die Sperre verpuffte
 * lautlos.
 */
export function alsBloecke(termin: IcalTermin, titel: string): Block[] {
  const bloecke: Block[] = [];

  if (termin.ganztaegig) {
    // Ganztägig: jeden betroffenen Tag komplett sperren.
    //
    // Hier bewusst UTC statt Zürcher Ortszeit: Ganztagestermine sind im
    // iCal reine Datumsangaben ohne Uhrzeit und werden als UTC-Mitternacht
    // eingelesen. Durch die Zürcher Zeitzone gedreht rutschte das Ende auf
    // 02:00 des Folgetags — und ein dreitägiger Termin sperrte vier Tage.
    const start = termin.start.toISOString().slice(0, 10);
    // DTEND ist bei Ganztagesterminen exklusiv: Der letzte gesperrte Tag
    // ist der Tag davor.
    const endeExklusiv = new Date(termin.ende.getTime() - 1)
      .toISOString()
      .slice(0, 10);
    let tag = start;
    let schutz = 0;
    while (tag <= endeExklusiv && schutz++ < 90) {
      bloecke.push({
        title: titel,
        date: tag,
        start_time: "00:00",
        end_time: "23:59",
        quelle: "apple",
        extern_uid: termin.uid,
      });
      const d = new Date(`${tag}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      tag = d.toISOString().slice(0, 10);
    }
    return bloecke;
  }

  const a = zuercherTeile(termin.start);
  const b = zuercherTeile(termin.ende);

  if (a.datum === b.datum) {
    // Gleicher Tag, aber Ende gleich Start (Null-Dauer) wäre wirkungslos.
    if (a.zeit === b.zeit) return [];
    return [
      {
        title: titel,
        date: a.datum,
        start_time: a.zeit,
        end_time: b.zeit,
        quelle: "apple",
        extern_uid: termin.uid,
      },
    ];
  }

  // Über Mitternacht: erster Tag bis 23:59, Zwischentage ganz, letzter ab 00:00.
  bloecke.push({
    title: titel,
    date: a.datum,
    start_time: a.zeit,
    end_time: "23:59",
    quelle: "apple",
    extern_uid: termin.uid,
  });

  const d = new Date(`${a.datum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  let tag = d.toISOString().slice(0, 10);
  let schutz = 0;
  while (tag < b.datum && schutz++ < 30) {
    bloecke.push({
      title: titel,
      date: tag,
      start_time: "00:00",
      end_time: "23:59",
      quelle: "apple",
      extern_uid: termin.uid,
    });
    const n = new Date(`${tag}T12:00:00Z`);
    n.setUTCDate(n.getUTCDate() + 1);
    tag = n.toISOString().slice(0, 10);
  }

  if (b.zeit !== "00:00") {
    bloecke.push({
      title: titel,
      date: b.datum,
      start_time: "00:00",
      end_time: b.zeit,
      quelle: "apple",
      extern_uid: termin.uid,
    });
  }

  return bloecke;
}

export type AbgleichErgebnis = {
  termine: number;
  bloecke: number;
  entfernt: number;
};

/**
 * Kalender holen und die Sperrzeiten neu schreiben.
 *
 * Vorgehen: alle `quelle='apple'`-Blöcke im Zeitfenster löschen und frisch
 * anlegen. Ein Abgleich Zeile für Zeile wäre sparsamer, aber deutlich
 * fehleranfälliger — ein gelöschter oder verschobener Kalendereintrag
 * müsste dabei zuverlässig erkannt werden, sonst bliebe eine Sperre für
 * einen Termin stehen, den es nicht mehr gibt.
 *
 * Handgemachte Blöcke (`quelle='manuell'`) werden nie angefasst.
 */
export async function gleicheAppleKalenderAb(
  admin: SupabaseClient,
  optionen: { fetchImpl?: typeof fetch } = {}
): Promise<AbgleichErgebnis | { error: string }> {
  const einstellung = await ladeAppleEinstellung(admin);
  if (!einstellung) return { error: "Kein Kalender hinterlegt." };

  const url = normalisiereIcalUrl(einstellung.url);
  if (!/^https?:\/\//i.test(url)) {
    return { error: "Der Link muss mit webcal:// oder https:// beginnen." };
  }

  const holen = optionen.fetchImpl ?? fetch;
  let text: string;
  try {
    const antwort = await holen(url, {
      headers: { Accept: "text/calendar" },
      // Ein hängender Abruf darf den Cron nicht aufhalten.
      signal: AbortSignal.timeout(20000),
    });
    if (!antwort.ok) {
      const fehler = `Der Kalender antwortete mit ${antwort.status}.`;
      await speichereEinstellung(admin, { ...einstellung, letzterFehler: fehler });
      return { error: fehler };
    }
    text = await antwort.text();
  } catch (e) {
    const fehler =
      e instanceof Error && e.name === "TimeoutError"
        ? "Der Kalender antwortete nicht innert 20 Sekunden."
        : "Der Kalender liess sich nicht abrufen.";
    await speichereEinstellung(admin, { ...einstellung, letzterFehler: fehler });
    return { error: fehler };
  }

  if (!text.includes("BEGIN:VCALENDAR")) {
    const fehler =
      "Unter diesem Link steht kein Kalender. In der Kalender-App den Kalender freigeben und den Link kopieren.";
    await speichereEinstellung(admin, { ...einstellung, letzterFehler: fehler });
    return { error: fehler };
  }

  const jetzt = new Date();
  const von = new Date(jetzt.getTime() - RUECKBLICK_TAGE * 86400000);
  const bis = new Date(jetzt.getTime() + VORLAUF_TAGE * 86400000);

  const termine = parseIcal(text, von, bis);

  const bloecke: Block[] = [];
  for (const t of termine) {
    // Der echte Titel ist Davids Privatsache. Wer ihn nicht im System haben
    // will, bekommt „Privat" — gesperrt wird trotzdem.
    const titel = einstellung.titelUebernehmen ? t.titel : "Privat";
    bloecke.push(...alsBloecke(t, titel));
  }

  const vonDatum = von.toISOString().slice(0, 10);
  const bisDatum = bis.toISOString().slice(0, 10);

  const { data: geloescht } = await admin
    .from("time_blocks")
    .delete()
    .eq("quelle", "apple")
    .gte("date", vonDatum)
    .lte("date", bisDatum)
    .select("id");

  // Doppelte (uid, date) fallen sonst über den Unique-Index: Ein Termin,
  // der zweimal am selben Tag steht, ist für eine Sperre ohnehin dasselbe.
  const einmalig = new Map<string, Block>();
  for (const b of bloecke) einmalig.set(`${b.extern_uid}|${b.date}`, b);
  const zuSchreiben = [...einmalig.values()];

  if (zuSchreiben.length > 0) {
    const { error } = await admin.from("time_blocks").insert(zuSchreiben);
    if (error) {
      await speichereEinstellung(admin, {
        ...einstellung,
        letzterFehler: "Die Sperrzeiten liessen sich nicht speichern.",
      });
      return { error: "Die Sperrzeiten liessen sich nicht speichern." };
    }
  }

  await speichereEinstellung(admin, {
    ...einstellung,
    zuletztAbgerufen: new Date().toISOString(),
    letzterFehler: null,
    anzahl: zuSchreiben.length,
  });

  return {
    termine: termine.length,
    bloecke: zuSchreiben.length,
    entfernt: geloescht?.length ?? 0,
  };
}

/** Kalender abmelden: Einstellung und alle importierten Sperren weg. */
export async function trenneAppleKalender(
  admin: SupabaseClient
): Promise<{ entfernt: number }> {
  const { data } = await admin
    .from("time_blocks")
    .delete()
    .eq("quelle", "apple")
    .select("id");
  await admin.from("app_settings").delete().eq("key", EINSTELLUNG_APPLE);
  return { entfernt: data?.length ?? 0 };
}
