// ============================================================
// Planungsrunde — Serverseite
//
// Der Ablauf einer Runde:
//   1. Runde starten → alle aktiven Schüler bekommen eine Anfrage
//   2. Schüler tragen im Portal ein, wann sie können
//   3. Admin rechnet die Zuteilung
//   4. Admin wendet sie an → Fixplätze und Terminserien entstehen
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { LESSON_DURATION_MIN } from "./booking";
import { fahrzeitMitCache } from "./geo";
import { ladeFahrzeiten, ladeFenster, ladeZuhause } from "./routing-server";
import {
  teileZu,
  type Verfuegbarkeit,
  type ZuteilSchueler,
  type Zuteilungsergebnis,
} from "./zuteilung";
import type { Rhythmus } from "./rhythmus";

export type Runde = {
  id: string;
  titel: string;
  periodeStart: string | null;
  frist: string;
  status: string;
  angewendetAm: string | null;
};

export async function ladeOffeneRunde(
  client: SupabaseClient
): Promise<Runde | null> {
  const { data } = await client
    .from("planungsrunden")
    .select("id, titel, periode_start, frist, status, angewendet_am")
    .eq("status", "offen")
    .order("erstellt_am", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as string,
    titel: data.titel as string,
    periodeStart: data.periode_start as string | null,
    frist: String(data.frist),
    status: data.status as string,
    angewendetAm: data.angewendet_am as string | null,
  };
}

export type AntwortStand = {
  studentId: string;
  name: string;
  email: string;
  geantwortet: boolean;
  geantwortetAm: string | null;
  erinnertAm: string | null;
  fensterAnzahl: number;
  bemerkung: string | null;
};

/**
 * Wer hat geantwortet, wer nicht.
 *
 * Bewusst inklusive derer, die noch nichts eingetragen haben — das ist die
 * eigentlich interessante Liste. Ohne sie müsste David selbst nachhalten,
 * bei wem er nachfragen muss.
 */
export async function ladeAntwortStand(
  admin: SupabaseClient,
  rundeId: string
): Promise<AntwortStand[]> {
  const { data: schueler } = await admin
    .from("profiles")
    .select("id, vorname, nachname, email")
    .eq("role", "student")
    .eq("aktiv", true)
    .order("nachname");

  const ids = (schueler ?? []).map((s) => s.id);
  if (ids.length === 0) return [];

  const [{ data: antworten }, { data: fenster }] = await Promise.all([
    admin
      .from("planungs_antworten")
      .select("student_id, geantwortet_am, erinnert_am, bemerkung")
      .eq("runde_id", rundeId),
    admin
      .from("student_verfuegbarkeit")
      .select("student_id")
      .eq("runde_id", rundeId),
  ]);

  const antwortVon = new Map(
    (antworten ?? []).map((a) => [a.student_id as string, a])
  );
  const fensterZahl = new Map<string, number>();
  for (const f of fenster ?? []) {
    const id = f.student_id as string;
    fensterZahl.set(id, (fensterZahl.get(id) ?? 0) + 1);
  }

  return (schueler ?? []).map((s) => {
    const a = antwortVon.get(s.id);
    return {
      studentId: s.id,
      name: `${s.vorname ?? ""} ${s.nachname ?? ""}`.trim() || "Ohne Namen",
      email: s.email as string,
      geantwortet: a?.geantwortet_am != null,
      geantwortetAm: (a?.geantwortet_am as string) ?? null,
      erinnertAm: (a?.erinnert_am as string) ?? null,
      fensterAnzahl: fensterZahl.get(s.id) ?? 0,
      bemerkung: (a?.bemerkung as string) ?? null,
    };
  });
}

/** Verfügbarkeiten eines Schülers für eine Runde. */
export async function ladeVerfuegbarkeit(
  client: SupabaseClient,
  studentId: string,
  rundeId: string
): Promise<Verfuegbarkeit[]> {
  const { data } = await client
    .from("student_verfuegbarkeit")
    .select("wochentag, fruehestens, spaetestens, praeferenz")
    .eq("student_id", studentId)
    .eq("runde_id", rundeId)
    .order("wochentag");

  return (data ?? []).map((v) => ({
    wochentag: Number(v.wochentag),
    fruehestens: String(v.fruehestens ?? "16:30").slice(0, 5),
    spaetestens: String(v.spaetestens ?? "20:30").slice(0, 5),
    praeferenz: Number(v.praeferenz ?? 2),
  }));
}

export type ZuteilKontext = {
  ergebnis: Zuteilungsergebnis;
  /** Zum Vergleich: was ginge ohne die Verfügbarkeitsangaben? */
  ohneEinschraenkung: number;
  schuelerGesamt: number;
  mitAntwort: number;
};

/**
 * Rechnet die Zuteilung für eine Runde.
 *
 * Gibt zusätzlich aus, was die Fahrzeit **ohne** die Verfügbarkeitsangaben
 * wäre. Die Differenz ist der Preis der Einschränkungen — und damit die
 * Grundlage für die Entscheidung, ob es sich lohnt, bei einzelnen Schülern
 * um mehr Flexibilität zu bitten.
 */
export async function rechneZuteilung(
  admin: SupabaseClient,
  rundeId: string,
  pufferMinuten: number
): Promise<ZuteilKontext> {
  const [zuhause, fenster, fahrzeitCache] = await Promise.all([
    ladeZuhause(admin),
    ladeFenster(admin),
    ladeFahrzeiten(admin),
  ]);
  const fahrzeit = fahrzeitMitCache(fahrzeitCache);

  const { data: profile } = await admin
    .from("profiles")
    .select("id, vorname, nachname, lat, lng")
    .eq("role", "student")
    .eq("aktiv", true);

  const ids = (profile ?? []).map((p) => p.id);
  if (ids.length === 0) {
    return {
      ergebnis: {
        zuteilungen: [],
        nichtZugeteilt: [],
        fahrzeitProWoche: 0,
        wunschErfuellt: 0,
        unveraendert: 0,
      },
      ohneEinschraenkung: 0,
      schuelerGesamt: 0,
      mitAntwort: 0,
    };
  }

  const [{ data: verf }, { data: pakete }] = await Promise.all([
    admin
      .from("student_verfuegbarkeit")
      .select("student_id, wochentag, fruehestens, spaetestens, praeferenz")
      .eq("runde_id", rundeId)
      .in("student_id", ids),
    admin
      .from("packages")
      .select("student_id, rhythmus, fixplatz_weekday, fixplatz_time, status")
      .in("student_id", ids)
      .eq("status", "active"),
  ]);

  const verfVon = new Map<string, Verfuegbarkeit[]>();
  for (const v of verf ?? []) {
    const id = v.student_id as string;
    const liste = verfVon.get(id) ?? [];
    liste.push({
      wochentag: Number(v.wochentag),
      fruehestens: String(v.fruehestens ?? "16:30").slice(0, 5),
      spaetestens: String(v.spaetestens ?? "20:30").slice(0, 5),
      praeferenz: Number(v.praeferenz ?? 2),
    });
    verfVon.set(id, liste);
  }

  const paketVon = new Map(
    (pakete ?? []).map((p) => [p.student_id as string, p])
  );

  const schueler: ZuteilSchueler[] = (profile ?? []).map((p) => {
    const paket = paketVon.get(p.id);
    return {
      id: p.id,
      name: `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || "Ohne Namen",
      lat: p.lat == null ? NaN : Number(p.lat),
      lng: p.lng == null ? NaN : Number(p.lng),
      rhythmus: (paket?.rhythmus === "zweiwoechentlich"
        ? "zweiwoechentlich"
        : "woechentlich") as Rhythmus,
      lektionMinuten: LESSON_DURATION_MIN,
      verfuegbarkeiten: verfVon.get(p.id) ?? [],
      bisher:
        paket?.fixplatz_weekday != null && paket?.fixplatz_time
          ? {
              wochentag: Number(paket.fixplatz_weekday),
              zeit: String(paket.fixplatz_time),
            }
          : null,
    };
  });

  const ergebnis = teileZu({
    zuhause: { lat: zuhause.lat, lng: zuhause.lng },
    schueler,
    fenster,
    pufferMinuten,
    fahrzeit,
  });

  // Vergleichsrechnung: alle können überall. Zeigt, was die Einschränkungen
  // kosten – nicht als Vorwurf, sondern als Entscheidungsgrundlage.
  const alleFenster: Verfuegbarkeit[] = fenster.map((f) => ({
    wochentag: f.wochentag,
    fruehestens: f.beginn,
    spaetestens: f.ende,
    praeferenz: 2,
  }));
  const frei = teileZu({
    zuhause: { lat: zuhause.lat, lng: zuhause.lng },
    schueler: schueler.map((s) => ({ ...s, verfuegbarkeiten: alleFenster, bisher: null })),
    fenster,
    pufferMinuten,
    fahrzeit,
  });

  return {
    ergebnis,
    ohneEinschraenkung: frei.fahrzeitProWoche,
    schuelerGesamt: schueler.length,
    mitAntwort: schueler.filter((s) => s.verfuegbarkeiten.length > 0).length,
  };
}
