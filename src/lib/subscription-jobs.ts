/**
 * Abo-Automatik.
 *
 * Läuft im bestehenden 5-Minuten-Cron mit und erledigt vier Dinge:
 *  1. Fällige Raten in Rechnung stellen.
 *  2. Nicht bezahlte Raten nach Ablauf der Zahlungsfrist als überfällig markieren.
 *  3. Vorwarnung verschicken, bevor sich ein Abo automatisch verlängert.
 *  4. Abgelaufene Abos verlängern (auto_renew) bzw. verfallen lassen.
 *
 * Alles ist idempotent: Raten mit Rechnung werden übersprungen, Vorwarnungen
 * über `renewal_notice_sent_at` einmalig gehalten, und der partielle
 * Unique-Index `packages_one_active_per_student` verhindert doppelte
 * Verlängerungen selbst bei parallelen Läufen.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INSTALMENT_DUE_DAYS,
  createInstalmentSchedule,
  issueInstalmentInvoice,
} from "@/lib/package-invoice";
import { PACKAGE_LABELS, PACKAGE_LESSONS } from "@/lib/packages";
import {
  RENEWAL_NOTICE_DAYS,
  todayInZurich,
  type SubscriptionType,
} from "@/lib/subscription";
import {
  ABSCHLUSS_PUFFER_TAGE,
  buildPlanForRhythmus,
  expiryFor,
  termMonthsForType,
  type BookingMode,
  type Rhythmus,
} from "@/lib/rhythmus";
import { bookFixplatzSeries } from "@/lib/fixplatz-server";
import { ABO_LABELS } from "@/lib/abo";
import { baueVorschau, legeMonatsratenAn } from "@/lib/abo-server";

export type SubscriptionJobResult = {
  instalmentsInvoiced: number;
  instalmentsOverdue: number;
  renewalNotices: number;
  renewed: number;
  expired: number;
};

type ProfileRow = {
  vorname: string | null;
  nachname: string | null;
  adresse: string | null;
  email: string | null;
  payment_method: string | null;
};

/** Ein Paket, so wie der Job es braucht. */
type PackageJobRow = {
  id: string;
  student_id: string;
  type: string;
  total_price: number | string | null;
  price_per_lesson: number | string | null;
  payment_method: string | null;
  lessons_total: number | null;
  lessons_used: number | null;
  expires_at: string | null;
  auto_renew: boolean | null;
  billing_mode: string | null;
  term_months: number | null;
  instalment_count: number | null;
  renewal_notice_sent_at: string | null;
  status: string;
  rhythmus: string | null;
  booking_mode: string | null;
  fixplatz_weekday: number | null;
  fixplatz_time: string | null;
  fixplatz_week_parity: number | null;
  abo_variante: string | null;
  abo_lektionen: number | null;
  monatsbetrag: number | string | null;
  periode_start: string | null;
  periode_ende: string | null;
};

type InstalmentJobRow = {
  id: string;
  package_id: string;
  student_id: string;
  sequence: number;
  kind: string;
  amount: number | string;
  due_date: string;
  invoice_id: string | null;
};

const PROFILE_FIELDS = "vorname, nachname, adresse, email, payment_method";
const PACKAGE_FIELDS =
  "id, student_id, type, total_price, price_per_lesson, payment_method, lessons_total, lessons_used, expires_at, auto_renew, billing_mode, term_months, instalment_count, renewal_notice_sent_at, status, rhythmus, booking_mode, fixplatz_weekday, fixplatz_time, fixplatz_week_parity, abo_variante, abo_lektionen, monatsbetrag, periode_start, periode_ende";

/** Outbox-Eintrag, idempotent über `dedupe_key`. */
async function enqueueOnce(
  admin: SupabaseClient,
  type: string,
  payload: Record<string, unknown>,
  dedupeKey: string
): Promise<boolean> {
  const { error } = await admin.from("scheduled_emails").insert({
    type,
    payload,
    send_at: new Date().toISOString(),
    status: "pending",
    dedupe_key: dedupeKey,
  });
  if (error) {
    if (error.code === "23505") return false;
    console.error("[abo] enqueue fehlgeschlagen:", type, error.message);
    return false;
  }
  return true;
}

function isoDayFromTimestamp(ts: string): string {
  return todayInZurich(new Date(ts));
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(
    dt.getUTCDate()
  )}`;
}

// ── 1. Fällige Raten fakturieren ────────────────────────────────────

async function invoiceDueInstalments(
  admin: SupabaseClient,
  today: string
): Promise<number> {
  const { data: due } = await admin
    .from("package_instalments")
    .select("id, package_id, student_id, sequence, kind, amount, due_date, invoice_id")
    .eq("status", "open")
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(50)
    .overrideTypes<InstalmentJobRow[]>();

  if (!due?.length) return 0;

  let count = 0;
  for (const inst of due) {
    if (inst.invoice_id) continue;

    const { data: pkg } = await admin
      .from("packages")
      .select(PACKAGE_FIELDS)
      .eq("id", inst.package_id)
      .maybeSingle<PackageJobRow>();
    if (!pkg || pkg.status === "cancelled") continue;

    const { data: profile } = await admin
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", inst.student_id)
      .maybeSingle<ProfileRow>();
    if (!profile) continue;

    const result = await issueInstalmentInvoice(
      admin,
      inst,
      { ...pkg, instalment_count: pkg.instalment_count },
      profile
    );
    if ("invoiceId" in result) count++;
    // "error" heisst hier meist: ein paralleler Lauf war schneller. Der
    // Unique-Index hat das Duplikat verhindert, wir gehen einfach weiter.
  }
  return count;
}

// ── 2. Überfällige Raten markieren ──────────────────────────────────

async function markOverdueInstalments(
  admin: SupabaseClient,
  today: string
): Promise<number> {
  // Zahlungsfrist ab Stichtag: due_date + INSTALMENT_DUE_DAYS.
  const cutoff = addDaysIso(today, -INSTALMENT_DUE_DAYS);

  const { data, error } = await admin
    .from("package_instalments")
    .update({ status: "overdue" })
    .in("status", ["open", "invoiced"])
    .lt("due_date", cutoff)
    .select("id");

  if (error) {
    console.error("[abo] Überfällig-Markierung fehlgeschlagen:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

// ── 3. Vorwarnung vor der Verlängerung ──────────────────────────────

async function sendRenewalNotices(
  admin: SupabaseClient,
  now: Date
): Promise<number> {
  const until = new Date(now.getTime() + RENEWAL_NOTICE_DAYS * 86400000);

  // Alle bald ablaufenden Perioden – mit und ohne Verlängerung.
  //
  // Bisher wurden nur Pakete mit `auto_renew` benachrichtigt. Beim Abo ist
  // aber gerade der andere Fall wichtig: Wer die Verlängerung abgeschaltet
  // hat, verliert am Periodenende seinen festen Platz. Ohne Vorwarnung merkt
  // er es erst, wenn nichts mehr im Kalender steht.
  const { data: packages } = await admin
    .from("packages")
    .select(PACKAGE_FIELDS)
    .eq("status", "active")
    // Pausierte Pakete ruhen: keine Vorwarnung, kein Ablauf, keine Verlängerung.
    .eq("paused", false)
    .is("renewal_notice_sent_at", null)
    .not("expires_at", "is", null)
    .gt("expires_at", now.toISOString())
    .lt("expires_at", until.toISOString())
    .limit(100)
    .overrideTypes<PackageJobRow[]>();

  let count = 0;
  for (const pkg of packages ?? []) {
    // Ohne Verlängerung ist nur beim Abo eine Nachricht sinnvoll; alte
    // Lektionspakete werden weiterhin über `package_expiring` abgedeckt.
    if (!pkg.auto_renew && !pkg.abo_variante) continue;

    const typ = pkg.auto_renew
      ? "subscription_renewal_notice"
      : "abo_endet_bald";

    const created = await enqueueOnce(
      admin,
      typ,
      {
        student_id: pkg.student_id,
        package_id: pkg.id,
        package_label: pkg.abo_variante
          ? ABO_LABELS[pkg.abo_variante === "jahr" ? "jahr" : "halbjahr"]
          : (PACKAGE_LABELS[pkg.type] ?? pkg.type),
        expires_at: pkg.expires_at,
        periode_ende: pkg.periode_ende,
        monatsbetrag: pkg.monatsbetrag,
        lessons_remaining: Math.max(
          0,
          Number(pkg.lessons_total ?? 0) - Number(pkg.lessons_used ?? 0)
        ),
      },
      `${typ}:${pkg.id}`
    );
    await admin
      .from("packages")
      .update({ renewal_notice_sent_at: new Date().toISOString() })
      .eq("id", pkg.id);
    if (created) count++;
  }
  return count;
}

// ── 4. Abgelaufene Abos: verlängern oder verfallen lassen ───────────

/**
 * Aufgebrauchte Pakete, deren letzte Lektion lange genug her ist.
 *
 * Ohne diesen Schritt läuft ein Paket, dessen Lektionen alle bezogen sind,
 * bis zum nominellen Ablaufdatum weiter. Bei 10 Lektionen wöchentlich sind
 * das bis zu **57 Tage**, in denen der Schüler weder buchen noch ein neues
 * Paket kaufen kann (der Unique-Index lässt nur ein aktives Paket zu) und
 * die Verlängerung noch nicht greift. Eine erzwungene Pause, die niemand
 * bestellt hat.
 *
 * Der Puffer von einer Woche lässt Raum für eine Nachholstunde oder eine
 * Verschiebung, die noch hereinkommt.
 */
async function findeAufgebrauchtePakete(
  admin: SupabaseClient,
  now: Date
): Promise<PackageJobRow[]> {
  const { data: kandidaten } = await admin
    .from("packages")
    .select(PACKAGE_FIELDS)
    .eq("status", "active")
    .eq("paused", false)
    .limit(200)
    .overrideTypes<PackageJobRow[]>();

  const fertig: PackageJobRow[] = [];
  const grenze = now.getTime() - ABSCHLUSS_PUFFER_TAGE * 86400000;

  for (const pkg of kandidaten ?? []) {
    // Abos laufen ihre Periode, auch wenn alle Lektionen schon bezogen sind.
    //
    // Beim alten Lektionspaket war "aufgebraucht" gleichbedeutend mit
    // "fertig". Beim Abo ist es das nicht: Gekauft wird die Laufzeit, nicht
    // die Lektionszahl. Ein flexibler Schüler, der seine 20 Lektionen in zwei
    // statt sechs Monaten bezieht, würde hier sonst sein Abo beenden – und
    // die vier restlichen Monatsbeträge nie bezahlen.
    if (pkg.abo_variante) continue;

    const total = Number(pkg.lessons_total ?? 0);
    const used = Number(pkg.lessons_used ?? 0);
    if (total <= 0 || used < total) continue;

    // Wann war die letzte gebuchte Lektion? Erst eine Woche danach wird
    // geschlossen – vorher könnte noch ein Ausweichtermin dazukommen.
    const { data: letzte } = await admin
      .from("appointments")
      .select("start_at")
      .eq("package_id", pkg.id)
      .in("status", ["booked", "completed"])
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!letzte?.start_at) continue;
    if (new Date(letzte.start_at).getTime() > grenze) continue;

    fertig.push(pkg);
  }

  return fertig;
}

/**
 * Fasst die beim Abschluss noch offenen Raten zu einer einzigen Rechnung
 * zusammen.
 *
 * Betroffen sind nur Raten ohne Rechnung. Was bereits fakturiert ist, bleibt
 * unangetastet — eine Rechnung, die draussen ist, schreibt man nicht um.
 *
 * Mit lektionsgekoppelten Raten ist dieser Fall selten geworden: bei drei der
 * vier Paketvarianten bleibt beim Abschluss nichts offen. Übrig bleibt vor
 * allem das 20er zweiwöchentlich, wo eine letzte Rate knapp nach der letzten
 * Lektion fällig wird.
 */
async function zieheRestratenZusammen(
  admin: SupabaseClient,
  pkg: PackageJobRow,
  now: Date
): Promise<void> {
  if (pkg.billing_mode !== "raten") return;

  const { data: offen } = await admin
    .from("package_instalments")
    .select("id, sequence, kind, amount, due_date, invoice_id")
    .eq("package_id", pkg.id)
    .eq("status", "open")
    .is("invoice_id", null)
    .order("sequence");

  if (!offen || offen.length === 0) return;

  const summe =
    Math.round(offen.reduce((s, r) => s + Number(r.amount ?? 0), 0) * 20) / 20;
  if (!(summe > 0)) return;

  const { data: profile } = await admin
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", pkg.student_id)
    .maybeSingle<ProfileRow>();
  if (!profile) return;

  // Eine Rate trägt den ganzen Restbetrag, der Rest wird storniert. Damit
  // bleibt die Summe unverändert und es entsteht genau eine Rechnung.
  const [traeger, ...ueberzaehlig] = offen;
  const heute = todayInZurich(now);

  await admin
    .from("package_instalments")
    .update({ amount: summe, due_date: heute })
    .eq("id", traeger.id);

  for (const r of ueberzaehlig) {
    await admin
      .from("package_instalments")
      .update({ status: "cancelled", amount: 0 })
      .eq("id", r.id);
  }

  // Sofort in Rechnung stellen – der Unterricht ist erbracht.
  const ergebnis = await issueInstalmentInvoice(
    admin,
    {
      id: traeger.id,
      sequence: Number(traeger.sequence),
      kind: String(traeger.kind),
      amount: summe,
      due_date: heute,
      invoice_id: null,
    },
    { ...pkg, instalment_count: pkg.instalment_count },
    profile
  );
  if ("error" in ergebnis) {
    console.error("[abo] Schlussrechnung:", pkg.id, ergebnis.error);
  }
}

/**
 * Verlängert ein Abo um eine weitere Periode.
 *
 * Anders als beim alten Lektionspaket wird hier **alles neu gerechnet**: In
 * einem Winterhalbjahr liegen andere Ferien als in einem Sommerhalbjahr, also
 * enthält es eine andere Lektionszahl und kostet einen anderen Monatsbetrag.
 * Die Werte des Vorgängers einfach zu übernehmen wäre in der Hälfte der Fälle
 * falsch.
 *
 * Übernommen werden dagegen Rhythmus, Buchungsart und Fixplatz – das ist die
 * Leistung, die der Schüler gekauft hat.
 */
async function verlaengereAbo(
  admin: SupabaseClient,
  pkg: PackageJobRow,
  profile: ProfileRow,
  now: Date
): Promise<boolean> {
  const variante = pkg.abo_variante === "jahr" ? "jahr" : "halbjahr";
  const rhythmus: Rhythmus =
    pkg.rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich";
  const bookingMode: BookingMode = pkg.booking_mode === "fix" ? "fix" : "flex";

  // Die neue Periode schliesst nahtlos an die alte an.
  const periodeStart = pkg.periode_ende
    ? addDaysIso(String(pkg.periode_ende), 1)
    : todayInZurich(now);

  const rechenTag = pkg.fixplatz_weekday ?? 3;

  const vorschau = await baueVorschau(admin, {
    studentId: pkg.student_id,
    variante,
    rhythmus,
    bookingMode,
    weekday: Number(rechenTag),
    periodeStart,
  });

  if (vorschau.lektionen < 1) {
    console.error("[abo] Verlängerung ohne Lektionen:", pkg.id, periodeStart);
    return false;
  }

  const { data: next, error } = await admin
    .from("packages")
    .insert({
      student_id: pkg.student_id,
      type: pkg.type,
      lessons_total: vorschau.lektionen,
      lessons_used: 0,
      name: `${ABO_LABELS[variante]} · ${
        rhythmus === "woechentlich" ? "wöchentlich" : "alle zwei Wochen"
      }`,
      price_per_lesson: vorschau.preisProLektion,
      total_price: vorschau.gesamtpreis,
      starts_at: new Date(`${periodeStart}T00:00:00.000Z`).toISOString(),
      expires_at: new Date(`${vorschau.periodeEnde}T23:59:59.000Z`).toISOString(),
      status: "active",
      billing_mode: "raten",
      term_months: vorschau.laufzeitMonate,
      auto_renew: true,
      renewed_from_package_id: pkg.id,
      deposit_amount: 0,
      instalment_count: vorschau.laufzeitMonate,
      instalment_amount: vorschau.monatsbetrag,
      rhythmus,
      booking_mode: bookingMode,
      fixplatz_weekday: pkg.fixplatz_weekday,
      fixplatz_time: pkg.fixplatz_time,
      fixplatz_week_parity: pkg.fixplatz_week_parity,
      abo_variante: variante,
      abo_lektionen: vorschau.lektionen,
      monatsbetrag: vorschau.monatsbetrag,
      periode_start: periodeStart,
      periode_ende: vorschau.periodeEnde,
    })
    .select(PACKAGE_FIELDS)
    .maybeSingle<PackageJobRow>();

  if (error || !next) {
    // 23505 = es läuft bereits ein aktives Abo (paralleler Lauf).
    if (error?.code !== "23505") {
      console.error("[abo] Verlängerung fehlgeschlagen:", pkg.id, error?.message);
    }
    return false;
  }

  const raten = await legeMonatsratenAn(admin, {
    packageId: next.id,
    studentId: pkg.student_id,
    gesamtpreis: vorschau.gesamtpreis,
    laufzeitMonate: vorschau.laufzeitMonate,
    periodeStart,
  });
  if ("error" in raten) {
    console.error("[abo] Monatsraten der Verlängerung:", next.id, raten.error);
  }

  // Fixplatz nahtlos fortsetzen.
  if (bookingMode === "fix" && pkg.fixplatz_weekday != null && pkg.fixplatz_time) {
    const serie = await bookFixplatzSeries(admin, {
      studentId: pkg.student_id,
      packageId: next.id,
      wunsch: {
        weekday: Number(pkg.fixplatz_weekday),
        time: String(pkg.fixplatz_time).slice(0, 5),
        rhythmus,
        lessons: vorschau.lektionen,
      },
      parity:
        pkg.fixplatz_week_parity == null
          ? null
          : ((Number(pkg.fixplatz_week_parity) === 1 ? 1 : 0) as 0 | 1),
      now: new Date(`${periodeStart}T00:00:00.000Z`),
    });
    if ("error" in serie) {
      console.error("[abo] Fixplatz-Serie der Verlängerung:", next.id, serie.error);
    }
  }

  await enqueueOnce(
    admin,
    "abo_verlaengert",
    {
      student_id: pkg.student_id,
      student_name:
        `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim() || undefined,
      abo_label: ABO_LABELS[variante],
      lektionen: vorschau.lektionen,
      monatsbetrag: vorschau.monatsbetrag,
      laufzeit_monate: vorschau.laufzeitMonate,
      periode_start: periodeStart,
      periode_ende: vorschau.periodeEnde,
      ferientage: vorschau.ferientage,
      vorher_lektionen: pkg.abo_lektionen,
      vorher_monatsbetrag: pkg.monatsbetrag,
    },
    `abo_verlaengert:${next.id}`
  );

  await enqueueOnce(
    admin,
    "abo_verlaengert_admin",
    {
      student_id: pkg.student_id,
      student_name:
        `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim() || undefined,
      abo_label: ABO_LABELS[variante],
      lektionen: vorschau.lektionen,
      monatsbetrag: vorschau.monatsbetrag,
      periode_start: periodeStart,
      periode_ende: vorschau.periodeEnde,
    },
    `abo_verlaengert_admin:${next.id}`
  );

  return true;
}

async function processExpiredPackages(
  admin: SupabaseClient,
  now: Date
): Promise<{ renewed: number; expired: number }> {
  const { data: abgelaufen } = await admin
    .from("packages")
    .select(PACKAGE_FIELDS)
    .eq("status", "active")
    // Während einer Pause bleibt `expires_at` auf dem alten Stand stehen –
    // die Restlaufzeit liegt in `pause_remaining_seconds`. Ohne diese Zeile
    // würde ein pausiertes Paket ablaufen, die Lektionen verfallen und bei
    // aktiver Auto-Verlängerung sogar ein neues Paket in Rechnung gestellt.
    .eq("paused", false)
    .not("expires_at", "is", null)
    .lte("expires_at", now.toISOString())
    .limit(50)
    .overrideTypes<PackageJobRow[]>();

  // Zwei Wege führen zum Abschluss: die Laufzeit ist um, oder die Lektionen
  // sind aufgebraucht. Beide enden gleich – nur der Grund unterscheidet sich,
  // und davon hängt ab, ob Lektionen verfallen.
  const aufgebraucht = await findeAufgebrauchtePakete(admin, now);
  const gesehen = new Set((abgelaufen ?? []).map((p) => p.id));
  const packages = [
    ...(abgelaufen ?? []),
    ...aufgebraucht.filter((p) => !gesehen.has(p.id)),
  ];

  let renewed = 0;
  let expired = 0;

  for (const pkg of packages) {
    const remaining = Math.max(
      0,
      Number(pkg.lessons_total ?? 0) - Number(pkg.lessons_used ?? 0)
    );

    // Altes Paket schliessen – zuerst, damit der Unique-Index
    // `packages_one_active_per_student` das Folgepaket nicht blockiert.
    const { error: closeErr } = await admin
      .from("packages")
      .update({ status: "expired" })
      .eq("id", pkg.id)
      .eq("status", "active");

    if (closeErr) {
      console.error("[abo] Ablauf fehlgeschlagen:", pkg.id, closeErr.message);
      continue;
    }
    expired++;

    // Noch offene Raten zu **einer** Schlussrechnung zusammenziehen.
    //
    // Der Betrag ist sauber geschuldet – bezahlt wird das Paket, nicht die
    // einzelne Lektion. Es geht allein um die Übersicht: liefe der alte
    // Ratenplan neben dem neuen weiter, sähe der Schüler zwei Zahlungspläne
    // gleichzeitig und wüsste nicht mehr, wofür er zahlt.
    await zieheRestratenZusammen(admin, pkg, now);

    // Nicht genutzte Lektionen verfallen – darüber wird informiert.
    if (remaining > 0) {
      await enqueueOnce(
        admin,
        "subscription_expired",
        {
          student_id: pkg.student_id,
          package_id: pkg.id,
          package_label: PACKAGE_LABELS[pkg.type] ?? pkg.type,
          lessons_forfeited: remaining,
          expires_at: pkg.expires_at,
        },
        `subscription_expired:${pkg.id}`
      );
    }

    if (!pkg.auto_renew) continue;

    // ── Verlängerung ──
    const type = pkg.type as SubscriptionType;
    if (type !== "10er" && type !== "20er") continue;

    const { data: profile } = await admin
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", pkg.student_id)
      .maybeSingle<ProfileRow>();
    if (!profile) continue;

    // Abos haben ihren eigenen Weg: die neue Periode wird komplett neu
    // gerechnet, weil in einem Winterhalbjahr andere Ferien liegen als in
    // einem Sommerhalbjahr – und damit eine andere Lektionszahl und ein
    // anderer Monatsbetrag herauskommt.
    if (pkg.abo_variante) {
      const ok = await verlaengereAbo(admin, pkg, profile, now);
      if (ok) renewed++;
      continue;
    }

    // Rhythmus und Buchungsart des Vorgängers weiterführen. Wer einen
    // Fixplatz am Dienstag um 17:15 hatte, will ihn behalten – ein
    // Verlängerungspaket, das stillschweigend auf wöchentlich/flexibel
    // zurückfällt, wäre eine andere Leistung als die gekaufte.
    const rhythmus: Rhythmus =
      pkg.rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich";
    const startDay = todayInZurich(now);
    const lessonsTotal = PACKAGE_LESSONS[type];
    const termMonths = termMonthsForType(type, rhythmus);
    const ppl = Number(pkg.price_per_lesson ?? 0);
    const totalPrice = Number(pkg.total_price ?? ppl * lessonsTotal);
    const expiresOn = expiryFor(lessonsTotal, rhythmus, startDay);

    // Ratenplan schon hier berechnen: die Check-Constraint
    // `packages_raten_complete_check` verlangt, dass ein Ratenpaket
    // Anzahlung, Ratenanzahl und Ratenhöhe bereits beim Insert mitbringt.
    // buildPlanForRhythmus ist deterministisch, createInstalmentSchedule
    // unten erzeugt daher exakt denselben Plan.
    const renewalPlan =
      pkg.billing_mode === "raten"
        ? buildPlanForRhythmus(type, totalPrice, startDay, rhythmus)
        : null;

    const { data: next, error: insErr } = await admin
      .from("packages")
      .insert({
        student_id: pkg.student_id,
        type,
        lessons_total: lessonsTotal,
        lessons_used: 0,
        name: PACKAGE_LABELS[type],
        price_per_lesson: ppl,
        total_price: totalPrice,
        starts_at: now.toISOString(),
        expires_at: `${expiresOn}T12:00:00.000Z`,
        status: "active",
        billing_mode: pkg.billing_mode,
        term_months: Math.round(termMonths),
        auto_renew: true,
        renewed_from_package_id: pkg.id,
        deposit_amount: renewalPlan ? renewalPlan.depositAmount : null,
        instalment_count: renewalPlan ? renewalPlan.instalmentCount : null,
        instalment_amount: renewalPlan ? renewalPlan.instalmentAmount : null,
        rhythmus,
        booking_mode: pkg.booking_mode ?? "flex",
        fixplatz_weekday: pkg.fixplatz_weekday,
        fixplatz_time: pkg.fixplatz_time,
        fixplatz_week_parity: pkg.fixplatz_week_parity,
      })
      .select(PACKAGE_FIELDS)
      .maybeSingle<PackageJobRow>();

    if (insErr || !next) {
      // 23505 = es existiert bereits ein aktives Paket (paralleler Lauf).
      if (insErr?.code !== "23505") {
        console.error("[abo] Verlängerung fehlgeschlagen:", pkg.id, insErr?.message);
      }
      continue;
    }

    if (renewalPlan) {
      const result = await createInstalmentSchedule(admin, next, profile, {
        type,
        totalPrice,
        startDate: startDay,
        rhythmus,
      });
      if ("error" in result) {
        console.error("[abo] Ratenplan der Verlängerung:", next.id, result.error);
      }
    } else {
      const { createPackageInvoice } = await import("@/lib/package-invoice");
      await createPackageInvoice(admin, next, profile);
    }

    // Fixplatz nahtlos fortsetzen: dieselbe Zeit, dieselbe Wochenparität.
    if (
      next.booking_mode === "fix" &&
      next.fixplatz_weekday != null &&
      next.fixplatz_time
    ) {
      const serie = await bookFixplatzSeries(admin, {
        studentId: pkg.student_id,
        packageId: next.id,
        wunsch: {
          weekday: Number(next.fixplatz_weekday),
          time: String(next.fixplatz_time).slice(0, 5),
          rhythmus,
          lessons: lessonsTotal,
        },
        parity:
          next.fixplatz_week_parity == null
            ? null
            : ((Number(next.fixplatz_week_parity) === 1 ? 1 : 0) as 0 | 1),
        now,
      });
      if ("error" in serie) {
        console.error(
          "[abo] Fixplatz-Serie der Verlängerung:",
          next.id,
          serie.error
        );
      }
    }

    await enqueueOnce(
      admin,
      "subscription_renewed",
      {
        student_id: pkg.student_id,
        package_id: next.id,
        previous_package_id: pkg.id,
        package_label: PACKAGE_LABELS[type],
        total_price: totalPrice,
        billing_mode: pkg.billing_mode,
        expires_at: next.expires_at,
      },
      `subscription_renewed:${next.id}`
    );

    await enqueueOnce(
      admin,
      "subscription_renewed_admin",
      {
        student_id: pkg.student_id,
        student_name:
          `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim() || undefined,
        package_id: next.id,
        package_label: PACKAGE_LABELS[type],
        billing_mode: pkg.billing_mode,
        expires_at: next.expires_at,
      },
      `subscription_renewed_admin:${next.id}`
    );

    renewed++;
  }

  return { renewed, expired };
}

// ── Einstiegspunkt ──────────────────────────────────────────────────

export async function runSubscriptionJobs(
  admin: SupabaseClient
): Promise<SubscriptionJobResult> {
  const now = new Date();
  const today = todayInZurich(now);

  const result: SubscriptionJobResult = {
    instalmentsInvoiced: 0,
    instalmentsOverdue: 0,
    renewalNotices: 0,
    renewed: 0,
    expired: 0,
  };

  try {
    result.instalmentsInvoiced = await invoiceDueInstalments(admin, today);
  } catch (err) {
    console.error("[abo] Ratenfakturierung fehlgeschlagen:", err);
  }

  try {
    result.instalmentsOverdue = await markOverdueInstalments(admin, today);
  } catch (err) {
    console.error("[abo] Überfällig-Prüfung fehlgeschlagen:", err);
  }

  try {
    result.renewalNotices = await sendRenewalNotices(admin, now);
  } catch (err) {
    console.error("[abo] Vorwarnung fehlgeschlagen:", err);
  }

  try {
    const { renewed, expired } = await processExpiredPackages(admin, now);
    result.renewed = renewed;
    result.expired = expired;
  } catch (err) {
    console.error("[abo] Ablauf/Verlängerung fehlgeschlagen:", err);
  }

  return result;
}

export { isoDayFromTimestamp, addDaysIso };
