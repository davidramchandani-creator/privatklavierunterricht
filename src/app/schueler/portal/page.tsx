import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Music } from "lucide-react";
import PortalNav from "./_components/PortalNav";
import PaketCard from "./_components/PaketCard";
import NeuesAbo from "./_components/NeuesAbo";
import NaechsteTermine from "./_components/NaechsteTermine";
import TerminBuchen from "./_components/TerminBuchen";
import ZahlungenSection from "./_components/ZahlungenSection";
import ZahlungsplanCard from "./_components/ZahlungsplanCard";
import ProposalCard from "./_components/ProposalCard";
import AusweichTermine from "./_components/AusweichTermine";
import VerfuegbarkeitFormular from "./_components/VerfuegbarkeitFormular";
import PortalTabs from "./_components/PortalTabs";
import PullToRefresh from "@/components/PullToRefresh";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { CalendarPlus, Lock } from "lucide-react";
import { PACKAGE_LABELS, canBuyNewPackage, type Package as Paket } from "@/lib/packages";
import { buildLessonTwintLink, buildTwintLink } from "@/lib/twint";
import {
  bookingLock,
  bookingLockReason,
  buildPlanSummary,
  type InstalmentRow,
} from "@/lib/instalment-view";
import {
  cancellationDeadline,
  isCancellable,
  todayInZurich,
} from "@/lib/subscription";
import Gruppenkurse from "./_components/Gruppenkurse";
import {
  getGroupCourses,
  offeneAusfaelle,
  offeneVerfuegbarkeitsabfrage,
} from "./actions";

export default async function SchuelerPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, vorname, nachname, price_single, price_10er, price_20er, travel_surcharge")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") redirect("/admin");

  const { data: packagesRows } = await supabase
    .from("packages")
    .select("*")
    .eq("student_id", user.id)
    .order("erstellt_am", { ascending: false });

  const aktivesPackage: Paket | null =
    (packagesRows as Paket[] | null)?.find(
      (p) => p.status === "active" && !canBuyNewPackage(p)
    ) ??
    (packagesRows as Paket[] | null)?.[0] ??
    null;

  let lessonsUsed = aktivesPackage?.lessons_used ?? 0;
  if (aktivesPackage) {
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("package_id", aktivesPackage.id)
      .in("status", ["booked", "completed"]);
    if (count != null) lessonsUsed = count;
  }

  const heute = new Date().toISOString().split("T")[0];
  const { data: kommendeAbwesenheit } = await supabase
    .from("absences")
    .select("start_date, end_date, title, scope, student_id")
    .gte("end_date", heute)
    .or(`scope.eq.admin,student_id.eq.${user.id}`)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();


  const kannNeuesAbo = canBuyNewPackage(aktivesPackage);
  const paketNutzbar = !!aktivesPackage && !canBuyNewPackage(aktivesPackage);

  const { data: naechsteAppointments } = await supabase
    .from("appointments")
    .select("id, start_at, end_at, status, group_session_id")
    .eq("student_id", user.id)
    .in("status", ["booked", "completed"])
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(10);

  const { data: offeneAnfragen } = await supabase
    .from("booking_requests")
    .select("id, desired_start, lessons_count, interval_days, status, group_id")
    .eq("student_id", user.id)
    .eq("status", "open")
    .order("desired_start", { ascending: true });

  const { data: offeneVerschiebungen } = await supabase
    .from("reschedule_requests")
    .select("id, appointment_id, original_start, proposed_start, status")
    .eq("student_id", user.id)
    .eq("status", "open")
    .order("proposed_start", { ascending: true });

  const { data: offeneProposals } = await supabase
    .from("proposals")
    .select("id, proposed_start, lessons_count, interval_days, status")
    .eq("student_id", user.id)
    .eq("status", "open")
    .order("proposed_start", { ascending: true });

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, status, method, lesson_date, pdf_url, access_token, appointment_id, package_id, due_date, description")
    .eq("student_id", user.id)
    .not("status", "in", '("archived","cancelled")')
    .order("erstellt_am", { ascending: false })
    .limit(20);

  // Ratenplan des aktiven Pakets (nur bei Ratenkauf vorhanden).
  const { data: instalmentRows } = aktivesPackage
    ? await supabase
        .from("package_instalments")
        .select("id, sequence, kind, amount, due_date, status, invoice_id, paid_at")
        .eq("package_id", aktivesPackage.id)
        .order("sequence", { ascending: true })
    : { data: null };

  const plan =
    instalmentRows && instalmentRows.length > 0
      ? buildPlanSummary(instalmentRows as InstalmentRow[])
      : null;

  // Ratenkauf: Buchen erst nach bezahlter Anzahlung (Entscheid Dave).
  const lock = bookingLock(
    (aktivesPackage as { billing_mode?: string | null } | null)?.billing_mode,
    (instalmentRows ?? []) as InstalmentRow[]
  );
  const lockReason = bookingLockReason(lock);

  // Selbst buchen gibt es nur bei Flex.
  //
  // Wer einen Fixplatz hat, bekommt seine Termine aus der Zuteilung – die
  // ganze Serie steht bereits im Kalender. Ihm zusätzlich einen
  // Buchungsknopf zu zeigen, hiesse: er bucht Lektionen neben seinem festen
  // Termin, die niemand eingeplant hat und die die Route sprengen.
  //
  // Das galt auch für den Zustand „Fixplatz vereinbart, Termin noch offen":
  // dort wäre der Knopf besonders verlockend, weil noch kein Termin
  // dasteht – und besonders falsch.
  const istFlex =
    (aktivesPackage as { booking_mode?: string | null } | null)?.booking_mode ===
    "flex";
  const canBook = paketNutzbar && !lock.locked && istFlex;

  const vorname = profile?.vorname ?? user.email?.split("@")[0] ?? "Schüler";

  // Auf-einen-Blick-Stats für den Hero
  const nextLessonAt = naechsteAppointments?.[0]?.start_at ?? null;
  const remainingLessons =
    aktivesPackage != null
      ? Math.max(0, aktivesPackage.lessons_total - lessonsUsed)
      : null;
  // Nur tatsächlich fällige Zahlungen zählen: offen/abgelehnt UND Lektion ist
  // bereits vorbei (Spec §6 – Zahlung erscheint erst nach der Lektion).
  const nowMs = Date.now();
  const openPaymentsCount =
    invoices?.filter((i) => {
      if (i.status !== "unpaid" && i.status !== "rejected") return false;
      if (!i.lesson_date) return true; // z. B. Storno-Nachzahlung: sofort fällig
      const lessonEnd = new Date(i.lesson_date).getTime() + 45 * 60 * 1000;
      return lessonEnd <= nowMs;
    }).length ?? 0;

  // TWINT-Deep-Link je Rechnung mit Betrag + Zahlungszweck (gehaltene Lektion),
  // serverseitig gebaut (Spec §6 – trxInfo = Lektionsinfo).
  const invoicesForPortal = (invoices ?? []).map((inv) => ({
    ...inv,
    // Leerer String = TWINT_BASE_URL nicht konfiguriert -> null, damit die
    // UI den TWINT-Button gar nicht erst anbietet.
    twint_link:
      inv.method === "twint"
        ? (!inv.lesson_date && inv.description
            ? buildTwintLink(Number(inv.amount ?? 0), inv.description)
            : buildLessonTwintLink(Number(inv.amount ?? 0), inv.lesson_date)) || null
        : null,
  }));

  const groupCourses = await getGroupCourses();

  // Ausgefallene Lektionen, für die noch kein Ersatz gewählt wurde.
  const { ausfaelle } = await offeneAusfaelle();

  // Laufende Verfügbarkeitsabfrage, falls eine offen ist.
  const abfrage = await offeneVerfuegbarkeitsabfrage();

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-5">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#EAECEF] p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto">
            <Music className="w-7 h-7 text-navy-900" />
          </div>
          <h1 className="text-xl font-800 text-gray-900">Willkommen!</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Dein Schülerprofil wird noch von David eingerichtet. Das dauert
            normalerweise nur kurz – schreib ihm eine kurze Nachricht wenn es
            dringend ist.
          </p>
          <a
            href="mailto:david.privatklavierunterricht@gmail.com"
            className="inline-block text-sm text-[#1C244B] font-600 hover:underline"
          >
            david.privatklavierunterricht@gmail.com
          </a>
        </div>
      </div>
    );
  }

  const uebersicht = (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Nächste Lektion"
          value={
            nextLessonAt
              ? new Intl.DateTimeFormat("de-CH", {
                  timeZone: "Europe/Zurich",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                }).format(new Date(nextLessonAt))
              : "—"
          }
          hint={nextLessonAt ? "geplant" : "keine geplant"}
        />
        <StatCard
          label="Verbleibende Lektionen"
          value={remainingLessons != null ? String(remainingLessons) : "0"}
          hint={remainingLessons != null ? "im aktiven Paket" : "kein aktives Paket"}
        />
        <StatCard
          label="Offene Zahlungen"
          value={openPaymentsCount > 0 ? String(openPaymentsCount) : "0"}
          hint={openPaymentsCount > 0 ? "zu begleichen" : "alles bezahlt"}
          accent={openPaymentsCount > 0}
        />
      </div>

      {/* Prominent booking CTA – shown first when the student can book */}
      {canBook && remainingLessons != null && remainingLessons > 0 && (
        <a
          href="#termine"
          className="flex items-center justify-between gap-4 bg-navy-900 text-white rounded-2xl px-5 py-4 hover:bg-navy-800 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <p className="font-700 text-sm">Nächste Lektion buchen</p>
              <p className="text-white/60 text-xs mt-0.5">
                {remainingLessons} Lektion{remainingLessons !== 1 ? "en" : ""} verfügbar
              </p>
            </div>
          </div>
          <svg className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      )}

      <div className="space-y-5">
        <SectionHeader title="Mein Abo" />
        <PaketCard
          paket={aktivesPackage}
          lessonsUsed={lessonsUsed}
          upcomingAbsence={kommendeAbwesenheit}
        />
        <div className="pt-1">
          <p className="text-[13px] font-600 text-gray-400 mb-2.5">
            {kannNeuesAbo ? "Abo abschliessen" : "Dein laufendes Abo"}
          </p>
          <NeuesAbo canBuy={kannNeuesAbo} />
        </div>
      </div>
    </div>
  );

  const termine = (
    <div className="space-y-5">
      {abfrage.runde && (
        <VerfuegbarkeitFormular
          runde={abfrage.runde}
          fenster={abfrage.fenster}
          vorhanden={abfrage.vorhanden}
          bemerkungVorhanden={abfrage.bemerkung}
          bereitsGeantwortet={abfrage.geantwortet}
        />
      )}
      <AusweichTermine ausfaelle={ausfaelle} />
      <ProposalCard proposals={offeneProposals ?? []} />
      <NaechsteTermine
        appointments={naechsteAppointments ?? []}
        requests={offeneAnfragen ?? []}
        reschedules={offeneVerschiebungen ?? []}
      />
      {aktivesPackage && canBook && remainingLessons != null && remainingLessons > 0 && (
        <div className="pt-1">
          <TerminBuchen maxSlots={remainingLessons} />
        </div>
      )}
      {aktivesPackage && lock.locked && lockReason && (
        <div className="pt-1">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-600 text-amber-900 text-sm">
                Terminbuchung noch gesperrt
              </p>
              <p className="text-sm text-amber-800 mt-1 leading-relaxed">
                {lockReason}
              </p>
              <a
                href="#zahlungen"
                className="inline-block mt-3 text-sm font-600 text-amber-900 underline underline-offset-2"
              >
                Zum Zahlungsplan
              </a>
            </div>
          </div>
        </div>
      )}
      <div className="pt-2">
        <h2 className="text-base font-700 text-navy-900 tracking-tight mb-4">Gruppenkurse</h2>
        <Gruppenkurse courses={groupCourses} />
      </div>
    </div>
  );

  // Der TWINT-Link zur nächsten Rate stammt aus der bereits gestellten
  // Rechnung – ist sie noch nicht fakturiert, gibt es nichts zu zahlen.
  const nextTwintLink =
    plan?.next?.invoiceId
      ? invoicesForPortal.find((i) => i.id === plan.next!.invoiceId)?.twint_link ??
        null
      : null;

  const ablaufTag = aktivesPackage?.expires_at
    ? todayInZurich(new Date(aktivesPackage.expires_at))
    : null;

  const zahlungen = (
    <div className="space-y-5">
      {plan && aktivesPackage && (
        <ZahlungsplanCard
          plan={plan}
          packageId={aktivesPackage.id}
          packageLabel={
            aktivesPackage.name ??
            PACKAGE_LABELS[aktivesPackage.type] ??
            aktivesPackage.type
          }
          nextTwintLink={nextTwintLink}
          autoRenew={Boolean(
            (aktivesPackage as { auto_renew?: boolean }).auto_renew
          )}
          cancellationDeadline={ablaufTag ? cancellationDeadline(ablaufTag) : null}
          canCancel={ablaufTag ? isCancellable(ablaufTag, todayInZurich()) : false}
          bookingLocked={lock.locked}
        />
      )}
      <ZahlungenSection invoices={invoicesForPortal} />
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <RealtimeRefresh />
      <PortalNav vorname={vorname} />

      <PullToRefresh>
        <main className="max-w-4xl mx-auto px-5 py-8 sm:py-10 pb-28 sm:pb-10">
          <div className="mb-6">
            <p className="text-[13px] font-500 text-gray-400">Schön, dass du da bist</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-700 text-navy-900 tracking-tight">
              Hallo, {vorname}
            </h1>
          </div>

          <PortalTabs
            uebersicht={uebersicht}
            termine={termine}
            zahlungen={zahlungen}
            termineBadge={offeneProposals?.length ?? 0}
            zahlungenBadge={openPaymentsCount}
          />
        </main>
      </PullToRefresh>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#EAECEF] bg-white px-5 py-4 transition-colors hover:border-gray-300/70">
      <p className="text-[11px] font-600 uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p
        className={`mt-1.5 text-2xl font-700 tracking-tight ${
          accent ? "text-red-500" : "text-navy-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-base font-700 text-navy-900 tracking-tight">{title}</h2>
  );
}
