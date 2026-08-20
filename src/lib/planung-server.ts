// ============================================================
// Planungsrunde, Serverseite
//
// Der Ablauf einer Runde:
//   1. Runde starten → alle aktiven Schüler bekommen eine Anfrage
//   2. Schüler tragen im Portal ein, wann sie können
//   3. Admin rechnet die Zuteilung
//   4. Admin wendet sie an → Fixplätze und Terminserien entstehen
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { istTest, type Kreis } from "./kreis";
import { LESSON_DURATION_MIN } from "./booking";
import { fahrzeitMitCache } from "./geo";
import { ladeFahrzeiten, ladeFenster, ladeZuhause } from "./routing-server";
import {
  findeEinpassung,
  teileZu,
  type BestehenderTermin,
  type Einpassung,
  type Verfuegbarkeit,
  type ZuteilSchueler,
  type Zuteilungsergebnis,
} from "./zuteilung";
import type { Rhythmus } from "./rhythmus";

/**
 * Art einer Runde.
 *
 * `termine` fragt nur nach Zeiten, für Schüler, die schon ein Abo haben.
 * `umstellung` fragt zusätzlich nach dem Abo selbst und legt es beim Anwenden
 * an. Das ist der Weg vom alten Lektionspaket ins Abo-Modell.
 */
export type Rundenart = "termine" | "umstellung";

export type Runde = {
  id: string;
  titel: string;
  periodeStart: string | null;
  frist: string;
  status: string;
  angewendetAm: string | null;
  art: Rundenart;
  /** Tag, an dem die Abos beginnen. Nur bei `umstellung` gesetzt. */
  startDatum: string | null;
};

const RUNDE_FELDER =
  "id, titel, periode_start, frist, status, angewendet_am, art, start_datum";

function alsRunde(data: Record<string, unknown>): Runde {
  return {
    id: data.id as string,
    titel: data.titel as string,
    periodeStart: (data.periode_start as string | null) ?? null,
    frist: String(data.frist),
    status: data.status as string,
    angewendetAm: (data.angewendet_am as string | null) ?? null,
    art: (data.art === "umstellung" ? "umstellung" : "termine") as Rundenart,
    startDatum: (data.start_datum as string | null) ?? null,
  };
}

export async function ladeOffeneRunde(
  client: SupabaseClient
): Promise<Runde | null> {
  const { data } = await client
    .from("planungsrunden")
    .select(RUNDE_FELDER)
    .eq("status", "offen")
    // Einzelanfragen laufen daneben her und blockieren keine Runde.
    .is("nur_student_id", null)
    .order("erstellt_am", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return alsRunde(data as Record<string, unknown>);
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
  /** Nur bei Umstellungsrunden: was der Schüler gewählt hat. */
  aboVariante: "halbjahr" | "jahr" | null;
  aboRhythmus: Rhythmus | null;
};

/**
 * Wer hat geantwortet, wer nicht.
 *
 * Bewusst inklusive derer, die noch nichts eingetragen haben. Das ist die
 * eigentlich interessante Liste. Ohne sie müsste David selbst nachhalten,
 * bei wem er nachfragen muss.
 */
export async function ladeAntwortStand(
  admin: SupabaseClient,
  rundeId: string
): Promise<AntwortStand[]> {
  // Wie bei der Zuteilung: der Kreis richtet sich nach der Runde. Sonst
  // stünden im Probelauf die echten Schüler als „hat nicht geantwortet" da
  // und die Erinnerung ginge an sie.
  const { data: rundeInfo } = await admin
    .from("planungsrunden")
    .select("nur_test")
    .eq("id", rundeId)
    .maybeSingle();

  const { data: schueler } = await admin
    .from("profiles")
    .select("id, vorname, nachname, email")
    .eq("role", "student")
    .eq("aktiv", true)
    .eq("ist_test", rundeInfo?.nur_test === true)
    .order("nachname");

  const ids = (schueler ?? []).map((s) => s.id);
  if (ids.length === 0) return [];

  const [{ data: antworten }, { data: fenster }] = await Promise.all([
    admin
      .from("planungs_antworten")
      .select(
        "student_id, geantwortet_am, erinnert_am, bemerkung, abo_variante, abo_rhythmus"
      )
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
      aboVariante:
        a?.abo_variante === "halbjahr" || a?.abo_variante === "jahr"
          ? a.abo_variante
          : null,
      aboRhythmus:
        a?.abo_rhythmus === "woechentlich" || a?.abo_rhythmus === "zweiwoechentlich"
          ? (a.abo_rhythmus as Rhythmus)
          : null,
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

/**
 * Der laufende Stundenplan: alle Schüler mit gesetztem Fixplatz.
 *
 * Grundlage fürs Einpassen einzelner Schüler mitten in der Periode, dort
 * wird nichts umgestellt, sondern nur gesucht, wo der Neue am wenigsten
 * zusätzliche Fahrzeit kostet.
 */
export async function ladeBestehendenPlan(
  admin: SupabaseClient,
  kreis: Kreis = "echt"
): Promise<BestehenderTermin[]> {
  const { data } = await admin
    .from("packages")
    .select(
      "student_id, fixplatz_weekday, fixplatz_time, fixplatz_week_parity, rhythmus, profiles!inner(vorname, nachname, lat, lng, ist_test, aktiv)"
    )
    .eq("status", "active")
    .eq("booking_mode", "fix")
    // Ein Testschüler wird gegen den Testplan eingepasst, nicht gegen die
    // echten Termine, sonst wäre die Zusatzfahrzeit frei erfunden.
    .eq("profiles.ist_test", istTest(kreis))
    // Wer nicht mehr unterrichtet wird, belegt auch keinen Platz mehr.
    //
    // Ohne diese Bedingung blockierte ein stillgelegter Schüler, dessen
    // Paket noch auf „aktiv" steht, weiterhin seine Uhrzeit. Der Platz wäre
    // in Wirklichkeit frei, im Plan aber besetzt — und niemand käme darauf,
    // dort nachzusehen.
    .eq("profiles.aktiv", true)
    .not("fixplatz_weekday", "is", null);

  const termine: BestehenderTermin[] = [];
  for (const p of data ?? []) {
    const prof = (
      Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
    ) as { vorname: string; nachname: string; lat: number | null; lng: number | null } | null;
    if (!prof || prof.lat == null || prof.lng == null) continue;

    termine.push({
      schuelerId: p.student_id as string,
      name: `${prof.vorname ?? ""} ${prof.nachname ?? ""}`.trim() || "Ohne Namen",
      lat: Number(prof.lat),
      lng: Number(prof.lng),
      wochentag: Number(p.fixplatz_weekday),
      beginn: String(p.fixplatz_time).slice(0, 5),
      lektionMinuten: LESSON_DURATION_MIN,
      paritaet:
        p.fixplatz_week_parity == null
          ? null
          : ((Number(p.fixplatz_week_parity) === 1 ? 1 : 0) as 0 | 1),
    });
  }
  return termine;
}

export type EinpassKontext = {
  vorschlaege: Einpassung[];
  schuelerName: string;
  hatZeiten: boolean;
};

/**
 * Offene Einzelanfrage an genau diesen Schüler.
 *
 * Eine Einzelanfrage ist technisch eine Runde mit einem einzigen Adressaten.
 * Dadurch funktionieren Formular, Speichern und Zuteilungsrechnung
 * unverändert, nur der Kreis ist kleiner.
 */
export async function ladeOffeneEinzelanfrage(
  client: SupabaseClient,
  studentId: string
): Promise<Runde | null> {
  const { data } = await client
    .from("planungsrunden")
    .select(RUNDE_FELDER)
    .eq("status", "offen")
    .eq("nur_student_id", studentId)
    .order("erstellt_am", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return alsRunde(data as Record<string, unknown>);
}

/**
 * Sucht die besten Plätze für einen einzelnen Schüler im laufenden Plan.
 *
 * Nimmt seine Verfügbarkeiten, bevorzugt die der offenen Runde, sonst die
 * Dauerangabe aus dem Abo-Abschluss.
 */
export async function findeEinpassungFuer(
  admin: SupabaseClient,
  studentId: string,
  pufferMinuten: number
): Promise<EinpassKontext | { error: string }> {
  // Der Kreis ergibt sich aus dem Schüler selbst: ein Testschüler wird gegen
  // den Testplan eingepasst, ein echter gegen den echten. So kann man es
  // nicht falsch aufrufen.
  const { data: wer } = await admin
    .from("profiles")
    .select("ist_test")
    .eq("id", studentId)
    .maybeSingle();
  const kreis: Kreis = wer?.ist_test ? "test" : "echt";

  const [zuhause, fenster, fahrzeitCache, bestehend] = await Promise.all([
    ladeZuhause(admin),
    ladeFenster(admin),
    ladeFahrzeiten(admin),
    ladeBestehendenPlan(admin, kreis),
  ]);

  const { data: prof } = await admin
    .from("profiles")
    .select("id, vorname, nachname, lat, lng")
    .eq("id", studentId)
    .maybeSingle();
  if (!prof) return { error: "Schüler nicht gefunden." };
  if (prof.lat == null || prof.lng == null) {
    return {
      error:
        "Für diesen Schüler fehlen die Koordinaten. Bitte zuerst die Adresse auflösen lassen.",
    };
  }

  const { data: verf } = await admin
    .from("student_verfuegbarkeit")
    .select("wochentag, fruehestens, spaetestens, praeferenz, runde_id")
    .eq("student_id", studentId);

  // Rundenspezifische Angaben schlagen die Dauerangabe.
  const mitRunde = (verf ?? []).filter((v) => v.runde_id != null);
  const roh = mitRunde.length > 0 ? mitRunde : (verf ?? []);

  const verfuegbarkeiten: Verfuegbarkeit[] = roh.map((v) => ({
    wochentag: Number(v.wochentag),
    fruehestens: String(v.fruehestens ?? "16:30").slice(0, 5),
    spaetestens: String(v.spaetestens ?? "20:30").slice(0, 5),
    praeferenz: Number(v.praeferenz ?? 2),
  }));

  const name = `${prof.vorname ?? ""} ${prof.nachname ?? ""}`.trim() || "Schüler";

  if (verfuegbarkeiten.length === 0) {
    return { vorschlaege: [], schuelerName: name, hatZeiten: false };
  }

  const { data: paket } = await admin
    .from("packages")
    .select("rhythmus")
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  const vorschlaege = findeEinpassung({
    zuhause: { lat: zuhause.lat, lng: zuhause.lng },
    neuer: {
      id: studentId,
      name,
      lat: Number(prof.lat),
      lng: Number(prof.lng),
      rhythmus: (paket?.rhythmus === "zweiwoechentlich"
        ? "zweiwoechentlich"
        : "woechentlich") as Rhythmus,
      lektionMinuten: LESSON_DURATION_MIN,
      verfuegbarkeiten,
    },
    // Der Schüler selbst darf nicht als eigener Nachbar auftauchen.
    bestehend: bestehend.filter((b) => b.schuelerId !== studentId),
    fenster,
    pufferMinuten,
    fahrzeit: fahrzeitMitCache(fahrzeitCache),
  });

  return { vorschlaege, schuelerName: name, hatZeiten: true };
}

export type ZuteilKontext = {
  ergebnis: Zuteilungsergebnis;
  /** Zum Vergleich: was ginge ohne die Verfügbarkeitsangaben? */
  ohneEinschraenkung: number;
  schuelerGesamt: number;
  mitAntwort: number;
  /**
   * Schüler mit laufendem Abo, die noch keinen Termin haben. Sie zahlen
   * bereits, sie dürfen in keiner Runde untergehen.
   */
  wartend: { name: string; hatZeiten: boolean }[];
};

/**
 * Rechnet die Zuteilung für eine Runde.
 *
 * Gibt zusätzlich aus, was die Fahrzeit **ohne** die Verfügbarkeitsangaben
 * wäre. Die Differenz ist der Preis der Einschränkungen, und damit die
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

  // Der Kreis richtet sich nach der Runde: ein Probelauf rechnet
  // ausschliesslich mit Testschülern, eine echte Runde lässt sie aus. Ohne
  // diese Grenze würde ein Probelauf beim Anwenden die echten Schüler
  // umbuchen, der teuerste denkbare Fehler an dieser Stelle.
  const { data: rundeInfo } = await admin
    .from("planungsrunden")
    .select("nur_test, art")
    .eq("id", rundeId)
    .maybeSingle();
  const nurTest = rundeInfo?.nur_test === true;
  const istUmstellung = rundeInfo?.art === "umstellung";

  const { data: profile } = await admin
    .from("profiles")
    .select("id, vorname, nachname, lat, lng")
    .eq("role", "student")
    .eq("aktiv", true)
    .eq("ist_test", nurTest);

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
      wartend: [],
    };
  }

  const [{ data: verf }, { data: dauerhaft }, { data: pakete }, { data: wahlen }] =
    await Promise.all([
    admin
      .from("student_verfuegbarkeit")
      .select("student_id, wochentag, fruehestens, spaetestens, praeferenz")
      .eq("runde_id", rundeId)
      .in("student_id", ids),
    // Dauerangaben aus dem Abo-Abschluss (ohne Runde). Sie greifen, wenn
    // jemand zur laufenden Runde nichts eingetragen hat, sonst müsste er
    // dieselben Zeiten zweimal angeben und fiele sonst grundlos heraus.
    admin
      .from("student_verfuegbarkeit")
      .select("student_id, wochentag, fruehestens, spaetestens, praeferenz")
      .is("runde_id", null)
      .in("student_id", ids),
      admin
        .from("packages")
        .select("student_id, rhythmus, fixplatz_weekday, fixplatz_time, status")
        .in("student_id", ids)
        .eq("status", "active"),
      // Bei einer Umstellung gibt es noch kein Abo, aus dem sich der Rhythmus
      // ablesen liesse. Er steht in der Antwort des Schülers.
      admin
        .from("planungs_antworten")
        .select("student_id, abo_rhythmus")
        .eq("runde_id", rundeId)
        .in("student_id", ids),
    ]);

  const alsFenster = (v: {
    wochentag: number;
    fruehestens: unknown;
    spaetestens: unknown;
    praeferenz: unknown;
  }): Verfuegbarkeit => ({
    wochentag: Number(v.wochentag),
    fruehestens: String(v.fruehestens ?? "16:30").slice(0, 5),
    spaetestens: String(v.spaetestens ?? "20:30").slice(0, 5),
    praeferenz: Number(v.praeferenz ?? 2),
  });

  const verfVon = new Map<string, Verfuegbarkeit[]>();
  for (const v of verf ?? []) {
    const id = v.student_id as string;
    const liste = verfVon.get(id) ?? [];
    liste.push(alsFenster(v));
    verfVon.set(id, liste);
  }
  // Nur für Schüler ohne Rundenantwort ergänzen, nicht zusätzlich.
  for (const v of dauerhaft ?? []) {
    const id = v.student_id as string;
    if ((verf ?? []).some((x) => x.student_id === id)) continue;
    const liste = verfVon.get(id) ?? [];
    liste.push(alsFenster(v));
    verfVon.set(id, liste);
  }

  const paketVon = new Map(
    (pakete ?? []).map((p) => [p.student_id as string, p])
  );
  const wahlVon = new Map(
    (wahlen ?? []).map((w) => [w.student_id as string, w.abo_rhythmus as string | null])
  );

  const schueler: ZuteilSchueler[] = (profile ?? []).map((p) => {
    const paket = paketVon.get(p.id);

    // Bei der Umstellung zählt, was der Schüler gewählt hat. Das alte Paket
    // steht zwar noch da, sein Rhythmus ist aber der von gestern: Wer
    // wöchentlich hatte und neu alle zwei Wochen will, bekäme sonst einen
    // wöchentlichen Platz reserviert und die halbe Zeit stünde leer.
    const gewaehlt = istUmstellung ? wahlVon.get(p.id) : null;
    const rhythmusQuelle = gewaehlt ?? paket?.rhythmus;

    return {
      id: p.id,
      name: `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || "Ohne Namen",
      lat: p.lat == null ? NaN : Number(p.lat),
      lng: p.lng == null ? NaN : Number(p.lng),
      rhythmus: (rhythmusQuelle === "zweiwoechentlich"
        ? "zweiwoechentlich"
        : "woechentlich") as Rhythmus,
      lektionMinuten: LESSON_DURATION_MIN,
      verfuegbarkeiten: verfVon.get(p.id) ?? [],
      // Bei der Umstellung gibt es bewusst kein „bisher". Die alten Termine
      // waren frei gebucht, kein fester Platz; sie zu bevorzugen hiesse, den
      // Zufall von damals in den neuen Stundenplan zu übernehmen.
      bisher:
        !istUmstellung && paket?.fixplatz_weekday != null && paket?.fixplatz_time
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
  // kosten, nicht als Vorwurf, sondern als Entscheidungsgrundlage.
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

  // Wer bezahlt schon, hat aber noch keinen Termin? Diese Liste ist das
  // Wichtigste an der ganzen Ansicht, hier darf niemand durchrutschen.
  //
  // Bei einer Umstellung ist die Frage eine andere: Dort hat noch niemand ein
  // Abo, und wer wartet, ist wer noch nichts gewählt hat. Ohne diese
  // Unterscheidung wäre die Liste bei der Umstellung entweder leer oder
  // vollständig, und damit in beiden Fällen nutzlos.
  const mitAbo = new Set((pakete ?? []).map((p) => p.student_id as string));
  const wartend = istUmstellung
    ? schueler
        .filter((s) => !wahlVon.get(s.id))
        .map((s) => ({ name: s.name, hatZeiten: s.verfuegbarkeiten.length > 0 }))
    : schueler
        .filter((s) => mitAbo.has(s.id) && s.bisher == null)
        .map((s) => ({ name: s.name, hatZeiten: s.verfuegbarkeiten.length > 0 }));

  return {
    ergebnis,
    ohneEinschraenkung: frei.fahrzeitProWoche,
    schuelerGesamt: schueler.length,
    mitAntwort: schueler.filter((s) => s.verfuegbarkeiten.length > 0).length,
    wartend,
  };
}
