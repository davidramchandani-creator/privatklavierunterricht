// ============================================================
// Briefings: Daten holen und verschicken
//
// Zwei Rhythmen, zwei Fragen:
//
//   Montag        Was steht diese Woche an, und was liegt quer?
//   Monatsanfang  Was hat der abgeschlossene Monat gebracht?
//
// Die Regeln, was überhaupt hineingehört, stehen in briefing.ts.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ABO_LAEUFT_AUS_TAGE,
  baueWochenbriefing,
  STILL_SEIT_WOCHEN,
  veraenderungProzent,
  type Monatsbriefing,
  type Wochenbriefing,
} from "./briefing";
import { ladeAbrechnung } from "./abrechnung-server";
import { monatsSchluessel } from "./abrechnung";
import { addDaysCal, utcToZonedDate, weekdayOf } from "./booking";

/** Zürcher Datum eines Instants als YYYY-MM-DD. */
function tag(d: Date): string {
  const c = utcToZonedDate(d);
  return `${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;
}

/**
 * Montag der Woche, in der `d` liegt — als Zürcher Kalendertag.
 *
 * Über die geprüften Kalenderhelfer statt über Millisekunden-Arithmetik:
 * An den Zeitumstellungswochenenden hat eine Woche 167 oder 169 Stunden,
 * und „minus n mal 86400000" landet dann einen Tag daneben.
 */
function montagVon(d: Date): string {
  const heute = utcToZonedDate(d);
  const wt = weekdayOf(heute); // 0 = Sonntag
  const zurueck = wt === 0 ? 6 : wt - 1;
  const c = addDaysCal(heute, -zurueck);
  return `${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;
}

const kurz = (iso: string) =>
  new Date(iso).toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
  });

export async function ladeWochenbriefing(
  admin: SupabaseClient,
  jetzt: Date = new Date()
): Promise<Wochenbriefing> {
  const montag = montagVon(jetzt);
  const wocheVon = new Date(`${montag}T00:00:00.000Z`);
  const wocheBis = new Date(wocheVon.getTime() + 7 * 86400000);
  const stillGrenze = new Date(
    jetzt.getTime() - STILL_SEIT_WOCHEN * 7 * 86400000
  );
  const auslaufGrenze = new Date(
    jetzt.getTime() + ABO_LAEUFT_AUS_TAGE * 86400000
  );

  const [
    { count: lektionen },
    { data: offene },
    { count: wartet },
    { data: aktive },
    { data: letzteTermine },
    { data: abos },
    { count: anfragen },
  ] = await Promise.all([
    admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "booked")
      .gte("start_at", wocheVon.toISOString())
      .lt("start_at", wocheBis.toISOString()),
    admin
      .from("invoices")
      .select("amount, profiles!inner(ist_test)")
      .is("paid_at", null)
      .eq("status", "unpaid")
      .eq("profiles.ist_test", false),
    admin
      .from("invoices")
      .select("id, profiles!inner(ist_test)", { count: "exact", head: true })
      .is("paid_at", null)
      .eq("status", "pending_confirmation")
      .eq("profiles.ist_test", false),
    admin
      .from("profiles")
      .select("id, vorname, nachname")
      .eq("role", "student")
      .eq("aktiv", true)
      .eq("ist_test", false)
      .eq("extern", false),
    admin
      .from("appointments")
      .select("student_id, start_at")
      .in("status", ["booked", "completed"])
      .gte("start_at", stillGrenze.toISOString()),
    admin
      .from("packages")
      .select("periode_ende, profiles!inner(vorname, nachname, ist_test)")
      .eq("status", "active")
      .eq("profiles.ist_test", false)
      .not("periode_ende", "is", null)
      .lte("periode_ende", tag(auslaufGrenze))
      .gte("periode_ende", tag(jetzt)),
    admin
      .from("anfragen")
      .select("id", { count: "exact", head: true })
      .eq("status", "neu"),
  ]);

  const offeneRows = (offene ?? []) as unknown as { amount: number | string }[];
  const betrag = offeneRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);

  // Wer hat in den letzten Wochen gar nichts gebucht? Über die Termine
  // gerechnet, nicht über das Paket: Ein laufendes Abo sagt nichts darüber,
  // ob jemand tatsächlich noch kommt.
  const hatTermin = new Set(
    ((letzteTermine ?? []) as { student_id: string }[]).map((t) => t.student_id)
  );
  const stille = ((aktive ?? []) as {
    id: string;
    vorname: string | null;
    nachname: string | null;
  }[])
    .filter((p) => !hatTermin.has(p.id))
    .map((p) => `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || "Unbekannt");

  const auslaufend = ((abos ?? []) as unknown as {
    periode_ende: string;
    profiles: { vorname: string | null; nachname: string | null };
  }[]).map((a) => ({
    name:
      `${a.profiles?.vorname ?? ""} ${a.profiles?.nachname ?? ""}`.trim() ||
      "Unbekannt",
    bis: kurz(a.periode_ende),
  }));

  return baueWochenbriefing({
    woche: montag,
    lektionen: lektionen ?? 0,
    offeneZahlungen: { anzahl: offeneRows.length, betrag },
    wartetAufBestaetigung: wartet ?? 0,
    stilleSchueler: stille,
    abosLaufenAus: auslaufend,
    unbeantworteteAnfragen: anfragen ?? 0,
  });
}

export async function ladeMonatsbriefing(
  admin: SupabaseClient,
  monat: string
): Promise<Monatsbriefing> {
  const [j, m] = monat.split("-").map(Number);
  const vormonat = `${m === 1 ? j - 1 : j}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;

  const [dieser, vorher] = await Promise.all([
    ladeAbrechnung(admin, monat),
    ladeAbrechnung(admin, vormonat),
  ]);

  const von = new Date(Date.UTC(j, m - 1, 1, -12, 0));
  const bis = new Date(Date.UTC(j, m, 1, 12, 0));

  const [{ count: lektionen }, { data: offene }] = await Promise.all([
    admin
      .from("appointments")
      .select("id, profiles!inner(ist_test)", { count: "exact", head: true })
      .in("status", ["booked", "completed"])
      .eq("profiles.ist_test", false)
      .gte("start_at", von.toISOString())
      .lt("start_at", bis.toISOString()),
    admin
      .from("invoices")
      .select("amount, profiles!inner(ist_test)")
      .is("paid_at", null)
      .in("status", ["unpaid", "pending_confirmation"])
      .eq("profiles.ist_test", false),
  ]);

  const offeneRows = (offene ?? []) as unknown as { amount: number | string }[];

  return {
    monat,
    einnahmen: dieser.einnahmenTotal,
    ausgaben: dieser.ausgabenTotal,
    ergebnis: dieser.ergebnis,
    lektionen: lektionen ?? 0,
    gegenVormonat:
      Math.round((dieser.einnahmenTotal - vorher.einnahmenTotal) * 100) / 100,
    geschaetzt: dieser.einnahmenGeschaetzt,
    offeneRechnungen: {
      anzahl: offeneRows.length,
      betrag: offeneRows.reduce((s, r) => s + Number(r.amount ?? 0), 0),
    },
  };
}

/**
 * Verschickt das Wochenbriefing, wenn Montag ist und es etwas zu sagen gibt.
 *
 * Die Sperre gegen Doppelversand liegt in `app_settings`, nicht in einer
 * eigenen Tabelle: Es ist ein einzelnes Datum, und eine Tabelle mit einer
 * Zeile ist kein Fortschritt.
 */
export async function verschickeWochenbriefing(
  admin: SupabaseClient,
  jetzt: Date = new Date()
): Promise<{ gesendet: boolean; grund?: string }> {
  const heute = tag(jetzt);
  const montag = montagVon(jetzt);
  if (heute !== montag) return { gesendet: false, grund: "nicht Montag" };

  const { data: stand } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "briefing_woche")
    .maybeSingle();
  const zuletzt = (stand?.value as { woche?: string } | null)?.woche;
  if (zuletzt === montag) return { gesendet: false, grund: "schon gesendet" };

  const briefing = await ladeWochenbriefing(admin, jetzt);

  // Auch bei einer stillen Woche vermerken, dass geprüft wurde — sonst
  // versucht es der Cron am selben Montag stündlich erneut.
  await admin
    .from("app_settings")
    .upsert({ key: "briefing_woche", value: { woche: montag } }, { onConflict: "key" });

  if (!briefing.lohntSich) {
    return { gesendet: false, grund: "nichts zu berichten" };
  }

  const { sendEmailNow } = await import("./emails-outbox");
  await sendEmailNow(admin, "wochenbriefing", {
    woche: briefing.woche,
    lektionen: briefing.lektionen,
    punkte: briefing.punkte.map((p) => p.text),
  });
  return { gesendet: true };
}

/** Verschickt das Monatsbriefing am ersten Tag des Monats. */
export async function verschickeMonatsbriefing(
  admin: SupabaseClient,
  jetzt: Date = new Date()
): Promise<{ gesendet: boolean; grund?: string }> {
  const heute = tag(jetzt);
  if (!heute.endsWith("-01")) return { gesendet: false, grund: "nicht der Erste" };

  // Der abgeschlossene Monat, nicht der angebrochene.
  const gestern = new Date(jetzt.getTime() - 86400000);
  const monat = monatsSchluessel(gestern);

  const { data: stand } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "briefing_monat")
    .maybeSingle();
  if ((stand?.value as { monat?: string } | null)?.monat === monat) {
    return { gesendet: false, grund: "schon gesendet" };
  }

  const briefing = await ladeMonatsbriefing(admin, monat);

  await admin
    .from("app_settings")
    .upsert({ key: "briefing_monat", value: { monat } }, { onConflict: "key" });

  const { sendEmailNow } = await import("./emails-outbox");
  await sendEmailNow(admin, "monatsbriefing", {
    monat: briefing.monat,
    einnahmen: briefing.einnahmen,
    ausgaben: briefing.ausgaben,
    ergebnis: briefing.ergebnis,
    lektionen: briefing.lektionen,
    gegen_vormonat: briefing.gegenVormonat,
    prozent: veraenderungProzent(
      briefing.einnahmen,
      briefing.einnahmen - briefing.gegenVormonat
    ),
    geschaetzt: briefing.geschaetzt,
    offen_anzahl: briefing.offeneRechnungen.anzahl,
    offen_betrag: briefing.offeneRechnungen.betrag,
  });
  return { gesendet: true };
}
