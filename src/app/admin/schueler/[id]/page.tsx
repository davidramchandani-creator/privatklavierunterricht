import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatCHF, formatDate, formatDateTime } from "@/lib/utils";
import { computePackageState, canCancelPackage, PACKAGE_LABELS, type Package } from "@/lib/packages";
import { describeFixplatz } from "@/lib/fixplatz";
import type { Rhythmus } from "@/lib/rhythmus";
import { parseSchweizerAdresse } from "@/lib/qr-pdf";
import SchuelerDetailActions, { InvoiceAction, PreiseForm, PackageFormNew, DirektBuchung, ProposalForm, ProposalWithdraw, AppointmentActions, PackageTimerActions, AdjustLessonsButton } from "./_components/SchuelerDetailActions";
import { StatusBadge } from "@/components/ui/status-badge";
import RatenplanPanel from "./_components/RatenplanPanel";
import { buildPlanSummary, type InstalmentRow } from "@/lib/instalment-view";
import { todayInZurich } from "@/lib/subscription";

export default async function SchuelerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await createAdminClient();
  const nowIso = new Date().toISOString();

  const [
    { data: profile },
    { data: packages },
    { data: appointments },
    { data: invoices },
    { data: openProposals },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, role, vorname, nachname, email, telefon, adresse, notizen, aktiv, erstellt_am, price_single, price_halbjahr, price_jahr, price_10er, price_20er, travel_surcharge, buffer_time_minutes, buffer_mode, payment_method")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("packages")
      .select("*")
      .eq("student_id", id)
      .order("erstellt_am", { ascending: false }),
    admin
      .from("appointments")
      .select("id, start_at, end_at, status, series_id, package_id")
      .eq("student_id", id)
      .in("status", ["booked", "completed", "no_show"])
      .gte("start_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(10),
    admin
      .from("invoices")
      .select("id, invoice_number, amount, status, method, lesson_date, erstellt_am, paid_at, description, due_date")
      .eq("student_id", id)
      .order("erstellt_am", { ascending: false })
      .limit(30),
    admin
      .from("proposals")
      .select("id, proposed_start, lessons_count, interval_days, status")
      .eq("student_id", id)
      .eq("status", "open")
      .order("proposed_start", { ascending: true }),
  ]);

  if (!profile || profile.role === "admin") notFound();

  // Ratenpläne aller Pakete dieses Schülers.
  const { data: instalmentRows } = await admin
    .from("package_instalments")
    .select("id, package_id, sequence, kind, amount, due_date, status, invoice_id, paid_at")
    .eq("student_id", id)
    .order("sequence", { ascending: true });

  const grouped = new Map<string, InstalmentRow[]>();
  for (const row of (instalmentRows ?? []) as unknown as (InstalmentRow & {
    package_id: string;
  })[]) {
    const list = grouped.get(row.package_id) ?? [];
    list.push(row);
    grouped.set(row.package_id, list);
  }

  const plaene = new Map<string, ReturnType<typeof buildPlanSummary>>();
  for (const [pkgId, rows] of grouped) {
    plaene.set(pkgId, buildPlanSummary(rows));
  }

  // Dynamisch gezählte Lektionen pro Paket (booked + completed + no_show zählen als verbraucht)
  const lessonsUsedByPackage = new Map<string, number>();
  if (packages && packages.length > 0) {
    await Promise.all(
      (packages as Package[]).map(async (pkg) => {
        const { count } = await admin
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("package_id", pkg.id)
          .in("status", ["booked", "completed", "no_show"]);
        lessonsUsedByPackage.set(pkg.id, count ?? pkg.lessons_used ?? 0);
      })
    );
  }

  const prices = {
    price_single: Number(profile.price_single ?? 85),
    price_halbjahr: Number(profile.price_halbjahr ?? 70),
    price_jahr: Number(profile.price_jahr ?? 65),
    // Paketpreise: Vorgabe zwischen Einzellektion und Abo, weil ein Paket
    // weniger bindet als ein Abo, aber mehr als eine Einzellektion.
    price_10er: Number(profile.price_10er ?? 75),
    price_20er: Number(profile.price_20er ?? 70),
    travel_surcharge: Number(profile.travel_surcharge ?? 0),
    buffer_time_minutes: Number(profile.buffer_time_minutes ?? 15),
    buffer_mode: (profile.buffer_mode as string) ?? "fixed",
    payment_method: (profile.payment_method as string) ?? "qr",
  };
  const mapsConfigured = !!process.env.GOOGLE_MAPS_API_KEY;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/schueler"
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-800 text-[#1C244B]">
          {profile.vorname} {profile.nachname}
        </h1>
        <span
          className={`text-xs font-500 px-2.5 py-0.5 rounded-full ${
            profile.aktiv
              ? "bg-emerald-50 text-emerald-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {profile.aktiv ? "Aktiv" : "Inaktiv"}
        </span>
      </div>

      {/* Stammdaten */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">Stammdaten</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">E-Mail</p>
            <p className="text-gray-900">{profile.email}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">Telefon</p>
            <p className="text-gray-900">{profile.telefon ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">Seit</p>
            <p className="text-gray-900">
              {profile.erstellt_am ? formatDate(profile.erstellt_am) : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">Zahlungsart</p>
            <p className="text-gray-900">
              {prices.payment_method === "twint" ? "TWINT" : "QR-Rechnung"}
            </p>
          </div>
          {profile.adresse && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">Adresse</p>
              <p className="text-gray-900">{profile.adresse}</p>
              {/*
                Für die QR-Rechnung muss die Adresse in Strasse, Nummer, PLZ
                und Ort zerlegbar sein — der Schweizer Standard verlangt die
                Felder einzeln. Ohne diesen Hinweis fiele erst beim Versand
                auf, dass keine Rechnung erzeugt werden kann, und dann steht
                es nur im Serverlog.
              */}
              {prices.payment_method !== "twint" &&
                !parseSchweizerAdresse(profile.adresse) && (
                  <p className="mt-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-snug">
                    Für die QR-Rechnung fehlt hier etwas. Erwartet wird{" "}
                    <strong>Strasse Nr., PLZ Ort</strong> — zum Beispiel
                    „Sattleracherstrasse 59, 8413 Neftenbach“. Solange das
                    nicht stimmt, lässt sich für {profile.vorname} keine
                    Rechnung erzeugen.
                  </p>
                )}
            </div>
          )}
          {profile.notizen && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">Notizen</p>
              <p className="text-gray-900 whitespace-pre-wrap">{profile.notizen}</p>
            </div>
          )}
        </div>

        <SchuelerDetailActions profile={profile} />
      </div>

      {/* Preise & Einstellungen */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">Preise & Einstellungen</h2>
        <PreiseForm
          userId={id}
          schuelerId={id}
          studentAddress={profile.adresse ?? null}
          mapsConfigured={mapsConfigured}
          initial={{
            price_single: prices.price_single,
            price_halbjahr: prices.price_halbjahr,
            price_jahr: prices.price_jahr,
            price_10er: prices.price_10er,
            price_20er: prices.price_20er,
            travel_surcharge: prices.travel_surcharge,
            buffer_time_minutes: prices.buffer_time_minutes,
            buffer_mode: prices.buffer_mode,
            payment_method: prices.payment_method,
          }}
        />
      </div>

      {/* Pakete */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">Pakete</h2>

        {packages && packages.length > 0 ? (
          <table className="w-full mb-4">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Typ</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Termin</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Lektionen</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 hidden sm:table-cell">Preis/Lekt.</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 hidden md:table-cell">Gültig bis</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(packages as Package[]).map((pkg) => {
                const usedCount = lessonsUsedByPackage.get(pkg.id) ?? pkg.lessons_used ?? 0;
                const state = computePackageState(pkg, usedCount);
                // Halbjahr/Jahr, Rhythmus und Fix/Flex stehen sonst nirgends im
                // Admin – ohne diese Zeile sieht ein Abo aus wie jedes andere
                // Paket, und man weiss nicht, was man vor sich hat.
                //
                // Abo und Paket haben denselben Typ in der Datenbank (10er
                // bzw. 20er) – erst abo_variante unterscheidet sie. Ohne
                // diese Zeile sähe ein Jahresabo genau aus wie ein
                // 20er-Paket, obwohl das eine über Monatsraten läuft und
                // sich verlängert und das andere einmal bezahlt wird und
                // endet.
                const varianteText =
                  pkg.abo_variante === "halbjahr"
                    ? "Abo Halbjahr"
                    : pkg.abo_variante === "jahr"
                      ? "Abo Jahr"
                      : "Paket, einmalig bezahlt";
                const rhythmusText =
                  pkg.rhythmus === "zweiwoechentlich"
                    ? "alle zwei Wochen"
                    : pkg.rhythmus
                      ? "wöchentlich"
                      : null;
                const artText = [varianteText, rhythmusText]
                  .filter(Boolean)
                  .join(" · ");

                const terminText =
                  pkg.booking_mode === "flex"
                    ? "Flexibel – selbst buchen"
                    : pkg.fixplatz_weekday != null && pkg.fixplatz_time != null
                      ? describeFixplatz(
                          pkg.fixplatz_weekday,
                          pkg.fixplatz_time,
                          (pkg.rhythmus === "zweiwoechentlich"
                            ? "zweiwoechentlich"
                            : "woechentlich") as Rhythmus,
                          (pkg.fixplatz_week_parity as 0 | 1 | null) ?? null
                        )
                      : pkg.booking_mode === "fix"
                        ? "Fixplatz – Termin folgt aus der Planung"
                        : "—";

                return (
                  <tr key={pkg.id}>
                    <td className="py-3 text-sm font-500 text-gray-900">
                      {PACKAGE_LABELS[pkg.type] ?? pkg.name ?? pkg.type}
                      {artText && (
                        <span className="block text-xs font-400 text-gray-500 mt-0.5">
                          {artText}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {terminText}
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {state.lessonsUsed}/{state.lessonsTotal}
                      <span className="text-[#1C244B] font-600 ml-1">
                        ({state.lessonsRemaining} übrig)
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600 hidden sm:table-cell">
                      {formatCHF(Number(pkg.price_per_lesson))}
                    </td>
                    <td className="py-3 text-sm text-gray-600 hidden md:table-cell">
                      {pkg.expires_at ? formatDate(pkg.expires_at) : "—"}
                    </td>
                    <td className="py-3">
                      <StatusBadge kind="packageState" status={state.effectiveStatus} />
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1">
                        {(pkg.status === "active" || pkg.status === "exhausted") && (
                          <AdjustLessonsButton
                            packageId={pkg.id}
                            currentTotal={pkg.lessons_total}
                            currentUsed={usedCount}
                          />
                        )}
                        {pkg.status === "active" && (
                          <PackageTimerActions
                            packageId={pkg.id}
                            schuelerId={id}
                            paused={pkg.paused}
                            canCancel={canCancelPackage(pkg, state.lessonsUsed)}
                            pricePerLesson={Number(pkg.price_per_lesson)}
                            totalPrice={
                              pkg.total_price != null
                                ? Number(pkg.total_price)
                                : pkg.lessons_total * Number(pkg.price_per_lesson)
                            }
                            lessonsUsed={state.lessonsUsed}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400 mb-4">Noch kein Paket vorhanden.</p>
        )}

        <PackageFormNew
          defaultPrices={{
            price_single: prices.price_single,
            price_10er: prices.price_10er,
            price_20er: prices.price_20er,
            travel_surcharge: prices.travel_surcharge,
          }}
          schueler_id={id}
          student_user_id={id}
        />
      </div>

      {/* Ratenpläne */}
      {(packages as Package[] | null)
        ?.filter((pkg) => plaene.has(pkg.id))
        .map((pkg) => (
          <RatenplanPanel
            key={pkg.id}
            plan={plaene.get(pkg.id)!}
            packageLabel={PACKAGE_LABELS[pkg.type] ?? pkg.name ?? pkg.type}
            autoRenew={Boolean((pkg as { auto_renew?: boolean }).auto_renew)}
            expiresOn={
              pkg.expires_at ? todayInZurich(new Date(pkg.expires_at)) : null
            }
          />
        ))}

      {/* Bevorstehende Lektionen */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">
          Bevorstehende Lektionen
        </h2>
        <div className="mb-4 flex flex-wrap gap-2">
          <DirektBuchung schueler_id={id} student_user_id={id} />
          <ProposalForm schueler_id={id} student_user_id={id} />
        </div>

        {openProposals && openProposals.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-600 text-gray-400 uppercase tracking-wide">
              Offene Terminvorschläge
            </p>
            {openProposals.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-2.5"
              >
                <div className="text-sm">
                  <span className="font-600 text-gray-900">
                    {formatDateTime(p.proposed_start)}
                  </span>
                  {p.lessons_count > 1 && (
                    <span className="text-gray-500">
                      {" "}· {p.lessons_count}× alle {p.interval_days} Tage
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge kind="request" status={p.status} />
                  <ProposalWithdraw proposalId={p.id} schuelerId={id} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!appointments || appointments.length === 0 ? (
          <p className="text-sm text-gray-400">Keine bevorstehenden Lektionen.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Datum & Zeit</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td className="py-3 text-sm text-gray-900">{formatDateTime(a.start_at)}</td>
                  <td className="py-3">
                    <StatusBadge kind="appointment" status={a.status} />
                  </td>
                  <td className="py-3">
                    <AppointmentActions appointmentId={a.id} schuelerId={id} status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Zahlungen */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">Zahlungen</h2>
        {!invoices || invoices.length === 0 ? (
          <p className="text-sm text-gray-400">Keine Zahlungen vorhanden.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Rechnung</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Betrag</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 hidden sm:table-cell">Datum</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-3 text-sm text-gray-600">
                    {inv.description ?? inv.invoice_number ?? "—"}
                    {inv.description && inv.invoice_number && (
                      <span className="block text-xs text-gray-400">{inv.invoice_number}</span>
                    )}
                  </td>
                  <td className="py-3 text-sm font-600 text-gray-900">
                    {formatCHF(Number(inv.amount))}
                  </td>
                  <td className="py-3 text-sm text-gray-600 hidden sm:table-cell">
                    {inv.lesson_date ? formatDate(inv.lesson_date) : inv.erstellt_am ? formatDate(inv.erstellt_am) : "—"}
                  </td>
                  <td className="py-3">
                    <StatusBadge kind="payment" status={inv.status} />
                  </td>
                  <td className="py-3">
                    {(inv.status === "unpaid" || inv.status === "pending_confirmation") && (
                      <InvoiceAction invoiceId={inv.id} currentStatus={inv.status} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
