// ============================================================
// Routenplaner, Serverseite
//
// Holt die Daten zusammen, die der Planer braucht, und speichert Ergebnisse.
// Die eigentliche Rechnung steht in routing.ts und kommt ohne DB aus.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { AVAILABILITY, DEFAULT_BUFFER_MIN, LESSON_DURATION_MIN } from "./booking";
import { fahrzeitMitCache, punktSchluessel, type Punkt } from "./geo";
import { geocode, geokodierungAktuell } from "./geocoding";
import type { PlanEingabe, PlanSchueler, Tagesfenster } from "./routing";
import type { Rhythmus } from "./rhythmus";
import { istTest, type Kreis } from "./kreis";

/**
 * Daves Ausgangspunkt. Steht in den Einstellungen, damit er nicht im Code
 * festgenagelt ist, mit der Rechnungsadresse als Vorgabe.
 */
export const STANDARD_ZUHAUSE: Punkt = { lat: 47.5266, lng: 8.6706 };
export const STANDARD_ZUHAUSE_ADRESSE = "Sattleracherstrasse 59, 8413 Neftenbach";

const EINSTELLUNG_ZUHAUSE = "routenplanung_zuhause";

type ZuhauseEinstellung = {
  adresse: string;
  lat: number;
  lng: number;
};

export async function ladeZuhause(
  admin: SupabaseClient
): Promise<ZuhauseEinstellung> {
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", EINSTELLUNG_ZUHAUSE)
    .maybeSingle();

  const wert = data?.value as Partial<ZuhauseEinstellung> | undefined;
  if (
    wert &&
    Number.isFinite(Number(wert.lat)) &&
    Number.isFinite(Number(wert.lng))
  ) {
    return {
      adresse: wert.adresse ?? STANDARD_ZUHAUSE_ADRESSE,
      lat: Number(wert.lat),
      lng: Number(wert.lng),
    };
  }
  return { adresse: STANDARD_ZUHAUSE_ADRESSE, ...STANDARD_ZUHAUSE };
}

export async function setzeZuhause(
  admin: SupabaseClient,
  adresse: string
): Promise<{ ok: true; treffer: ZuhauseEinstellung } | { error: string }> {
  const treffer = await geocode(adresse);
  if (!treffer) {
    return {
      error:
        "Diese Adresse liess sich nicht auflösen. Bitte mit Strasse, Hausnummer, PLZ und Ort schreiben.",
    };
  }
  const wert: ZuhauseEinstellung = {
    adresse,
    lat: treffer.lat,
    lng: treffer.lng,
  };
  await admin
    .from("app_settings")
    .upsert({ key: EINSTELLUNG_ZUHAUSE, value: wert, updated_at: new Date().toISOString() });
  return { ok: true, treffer: wert };
}

// ── Unterrichtsfenster ─────────────────────────────────────

/**
 * Die vom Admin gepflegten Unterrichtszeiten. Ohne Eintrag gelten die
 * Standardfenster aus der Buchungs-Engine (Mo, Do 16:30–20:30, Fr 16:30–18:00).
 */
export async function ladeFenster(
  admin: SupabaseClient
): Promise<Tagesfenster[]> {
  const { data } = await admin
    .from("admin_verfuegbarkeit")
    .select(
      "wochentag, beginn_zeit, ende_zeit, aktiv, start_adresse, start_lat, start_lng"
    )
    .eq("aktiv", true)
    .order("wochentag");

  if (data && data.length > 0) {
    return data.map((r) => ({
      wochentag: Number(r.wochentag),
      beginn: String(r.beginn_zeit).slice(0, 5),
      ende: String(r.ende_zeit).slice(0, 5),
      // Nur wenn beides da ist. Die Datenbank stellt das zwar sicher,
      // aber der Planer soll hier nicht raten müssen.
      start:
        r.start_lat != null && r.start_lng != null
          ? { lat: Number(r.start_lat), lng: Number(r.start_lng) }
          : null,
      startName: (r.start_adresse as string | null) ?? null,
    }));
  }

  return Object.entries(AVAILABILITY).flatMap(([tag, fenster]) =>
    fenster.map((f) => ({
      wochentag: Number(tag),
      beginn: f.start,
      ende: f.end,
    }))
  );
}

// ── Fahrzeiten ─────────────────────────────────────────────

/**
 * Lädt gespeicherte Fahrzeiten. Alles, was nicht drinsteht, wird geschätzt.
 * der Planer funktioniert also auch mit leerem Cache.
 */
export async function ladeFahrzeiten(
  admin: SupabaseClient
): Promise<Map<string, number>> {
  const { data } = await admin
    .from("travel_times")
    .select("from_lat, from_lng, to_lat, to_lng, duration_seconds, quelle")
    .limit(5000);

  const cache = new Map<string, number>();
  for (const r of data ?? []) {
    const key =
      `${punktSchluessel({ lat: Number(r.from_lat), lng: Number(r.from_lng) })}|` +
      `${punktSchluessel({ lat: Number(r.to_lat), lng: Number(r.to_lng) })}`;
    cache.set(key, Number(r.duration_seconds));
  }
  return cache;
}

/**
 * Trägt eine von Hand korrigierte Fahrzeit ein.
 *
 * Daves Ortskenntnis schlägt jede Schätzung: wenn er weiss, dass eine Strecke
 * um 17 Uhr zwanzig Minuten dauert, ist das der richtige Wert.
 */
export async function setzeFahrzeitManuell(
  admin: SupabaseClient,
  von: Punkt,
  nach: Punkt,
  minuten: number
): Promise<void> {
  await admin.from("travel_times").upsert(
    {
      from_lat: Number(von.lat.toFixed(5)),
      from_lng: Number(von.lng.toFixed(5)),
      to_lat: Number(nach.lat.toFixed(5)),
      to_lng: Number(nach.lng.toFixed(5)),
      duration_seconds: Math.round(minuten * 60),
      quelle: "manuell",
    },
    { onConflict: "from_lat,from_lng,to_lat,to_lng" }
  );
}

// ── Schüler ────────────────────────────────────────────────

export type SchuelerRohdaten = {
  id: string;
  name: string;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  geocodeAdresse: string | null;
  rhythmus: Rhythmus;
  bookingMode: string;
  hatAktivesPaket: boolean;
  moeglicheTage: number[];
  /** Zeiten je Wochentag, der genaue Fall. */
  fenster: { wochentag: number; fruehestens: string; spaetestens: string }[];
};

/**
 * Alle aktiven Schüler samt Adresse, Rhythmus und persönlicher Verfügbarkeit.
 *
 * Der Rhythmus kommt aus dem aktiven Paket. Wer keines hat, wird als
 * wöchentlich geführt, für die Planung ist das die vorsichtigere Annahme,
 * weil sie mehr Platz reserviert.
 */
export async function ladeSchueler(
  admin: SupabaseClient,
  kreis: Kreis = "echt"
): Promise<SchuelerRohdaten[]> {
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, vorname, nachname, adresse, lat, lng, geocode_adresse, aktiv, role, hausbesuch"
    )
    .eq("role", "student")
    .eq("aktiv", true)
    // Aus der Planung genommen: Diesem Schüler wird kein Platz gesucht.
    // Ein bereits gesetzter fester Termin blockiert weiterhin, der kommt
    // über `ladeBestehendenPlan` und ist von diesem Schalter unberührt.
    .eq("planung_aktiv", true)
    // Test und Ernst nie vermischen, sonst rechnet die Route über erfundene
    // und echte Adressen zugleich und stimmt für keinen der beiden Fälle.
    .eq("ist_test", istTest(kreis))
    .order("nachname");

  const ids = (profile ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const [{ data: pakete }, { data: verfuegbar }, { data: vereinbarungen }] =
    await Promise.all([
      admin
        .from("packages")
        .select("student_id, rhythmus, booking_mode, status")
        .in("student_id", ids)
        .eq("status", "active"),
      admin
        .from("student_verfuegbarkeit")
        .select("student_id, wochentag, fruehestens, spaetestens")
        .in("student_id", ids),
      // Externe haben kein Paket, ihr Rhythmus steht in der Vereinbarung.
      //
      // Ohne diese Abfrage galten sie alle als wöchentlich — der Planer
      // reservierte jede Woche einen Platz für jemanden, der alle zwei
      // Wochen kommt, und rechnete die Fahrzeit doppelt.
      admin
        .from("externe_vereinbarungen")
        .select("student_id, rhythmus")
        .eq("aktiv", true)
        .in("student_id", ids),
    ]);

  const externerRhythmus = new Map<string, string | null>();
  for (const v of vereinbarungen ?? []) {
    externerRhythmus.set(v.student_id as string, v.rhythmus as string | null);
  }

  const paketVon = new Map<string, { rhythmus: string | null; booking_mode: string }>();
  for (const p of pakete ?? []) {
    paketVon.set(p.student_id, {
      rhythmus: p.rhythmus,
      booking_mode: p.booking_mode ?? "flex",
    });
  }

  // Zeiten bleiben nach Wochentag getrennt.
  //
  // Vorher wurde daraus eine einzige engste Grenze gerechnet. Das ist falsch,
  // sobald jemand an verschiedenen Tagen verschieden kann: „Di ab 18:00" und
  // „Fr bis 18:00" ergaben zusammengezogen 18:00 bis 18:00, ein Fenster von
  // null Minuten. Der Schüler verschwand lautlos aus dem Plan mit der Meldung,
  // er sei an keinem Tag verfügbar, obwohl er dienstags den ganzen Abend Zeit
  // hat.
  const verfuegbarVon = new Map<
    string,
    { wochentag: number; fruehestens: string; spaetestens: string }[]
  >();
  for (const v of verfuegbar ?? []) {
    const bisher = verfuegbarVon.get(v.student_id) ?? [];
    bisher.push({
      wochentag: Number(v.wochentag),
      fruehestens: String(v.fruehestens ?? "00:00").slice(0, 5),
      spaetestens: String(v.spaetestens ?? "23:59").slice(0, 5),
    });
    verfuegbarVon.set(v.student_id, bisher);
  }

  // Wer zu David kommt, kostet keine Fahrt.
  //
  // Rechnerisch sitzt er dafür an Davids Adresse: Die Lektion belegt ihre
  // Zeit wie jede andere, aber Hin- und Rückweg sind null. Ihn ganz
  // wegzulassen wäre der naheliegende, aber falsche Weg — dann sähe die
  // Stunde frei aus und der Planer legte jemanden quer durch den Kanton
  // darauf.
  const zuhause = await ladeZuhause(admin);

  return (profile ?? []).map((p) => {
    const paket = paketVon.get(p.id);
    const v = verfuegbarVon.get(p.id);
    const kommtZuDavid = p.hausbesuch === false;
    return {
      id: p.id,
      name: `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || "Ohne Namen",
      adresse: p.adresse,
      lat: kommtZuDavid ? zuhause.lat : p.lat == null ? null : Number(p.lat),
      lng: kommtZuDavid ? zuhause.lng : p.lng == null ? null : Number(p.lng),
      geocodeAdresse: p.geocode_adresse,
      // Paket zuerst, dann die externe Vereinbarung. Wer beides nicht hat,
      // gilt als wöchentlich — das ist die vorsichtigere Annahme, sie
      // reserviert mehr Platz.
      rhythmus: ((paket?.rhythmus ?? externerRhythmus.get(p.id)) ===
      "zweiwoechentlich"
        ? "zweiwoechentlich"
        : "woechentlich") as Rhythmus,
      bookingMode: paket?.booking_mode ?? "flex",
      hatAktivesPaket: paket != null,
      moeglicheTage: [...new Set((v ?? []).map((f) => f.wochentag))],
      fenster: v ?? [],
    };
  });
}

/**
 * Geokodiert alle Schüler, deren Koordinaten fehlen oder veraltet sind.
 * Gibt zurück, was geklappt hat und was nicht. Fehlschläge müssen sichtbar
 * werden, sonst fehlt jemand still im Plan.
 */
export async function geokodiereOffene(
  admin: SupabaseClient
): Promise<{ erledigt: number; fehlgeschlagen: { name: string; adresse: string }[] }> {
  // kreis-uebergreifend: Adressen auflösen gilt für alle. Testadressen
  // brauchen genauso Koordinaten, sonst fällt der Testschüler still aus dem
  // Plan, und das Auflösen wertet nichts aus, es füllt nur Stammdaten.
  const { data: profile } = await admin
    .from("profiles")
    .select("id, vorname, nachname, adresse, lat, lng, geocode_adresse")
    .eq("role", "student")
    .eq("aktiv", true);

  const offen = (profile ?? []).filter(
    (p) => p.adresse && !geokodierungAktuell(p)
  );

  let erledigt = 0;
  const fehlgeschlagen: { name: string; adresse: string }[] = [];

  for (let i = 0; i < offen.length; i++) {
    const p = offen[i];
    const treffer = await geocode(p.adresse!);
    const name = `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim();

    if (!treffer) {
      fehlgeschlagen.push({ name, adresse: p.adresse! });
    } else {
      await admin
        .from("profiles")
        .update({
          lat: treffer.lat,
          lng: treffer.lng,
          geocoded_am: new Date().toISOString(),
          geocode_quelle: treffer.quelle,
          geocode_adresse: p.adresse,
        })
        .eq("id", p.id);
      erledigt++;
    }

    // Nominatim erlaubt eine Anfrage pro Sekunde. Auch wenn geo.admin
    // grosszügiger ist: seriell und gedrosselt bleibt fair.
    if (i < offen.length - 1) await new Promise((r) => setTimeout(r, 1100));
  }

  return { erledigt, fehlgeschlagen };
}

// ── Planeingabe zusammenbauen ──────────────────────────────

export type PlanKontext = {
  eingabe: PlanEingabe;
  zuhauseAdresse: string;
  ohneKoordinaten: SchuelerRohdaten[];
};

export async function ladePlanEingabe(
  admin: SupabaseClient,
  optionen: {
    nurFixplatz?: boolean;
    pufferMinuten?: number;
    kreis?: Kreis;
  } = {}
): Promise<PlanKontext> {
  const kreis = optionen.kreis ?? "echt";
  const [zuhause, fenster, schuelerRoh, fahrzeitCache] = await Promise.all([
    ladeZuhause(admin),
    ladeFenster(admin),
    ladeSchueler(admin, kreis),
    ladeFahrzeiten(admin),
  ]);

  const gefiltert = optionen.nurFixplatz
    ? schuelerRoh.filter((s) => s.bookingMode === "fix")
    : schuelerRoh;

  const ohneKoordinaten = gefiltert.filter((s) => s.lat == null || s.lng == null);

  const schueler: PlanSchueler[] = gefiltert.map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat ?? NaN,
    lng: s.lng ?? NaN,
    rhythmus: s.rhythmus,
    lektionMinuten: LESSON_DURATION_MIN,
    moeglicheTage: s.moeglicheTage,
    fenster: s.fenster,
  }));

  return {
    eingabe: {
      zuhause: { lat: zuhause.lat, lng: zuhause.lng },
      schueler,
      fenster,
      pufferMinuten: optionen.pufferMinuten ?? DEFAULT_BUFFER_MIN,
      fahrzeit: fahrzeitMitCache(fahrzeitCache),
    },
    zuhauseAdresse: zuhause.adresse,
    ohneKoordinaten,
  };
}

// ── Pläne speichern ────────────────────────────────────────

export async function speicherePlan(
  admin: SupabaseClient,
  titel: string,
  plan: unknown,
  kennzahlen: { fahrzeitSekunden: number; lektionen: number }
): Promise<string | null> {
  const { data } = await admin
    .from("routenplaene")
    .insert({
      titel,
      plan: plan as Record<string, unknown>,
      gesamt_fahrzeit_sekunden: Math.round(kennzahlen.fahrzeitSekunden),
      lektionen_anzahl: Math.round(kennzahlen.lektionen),
    })
    .select("id")
    .single();
  return data?.id ?? null;
}
