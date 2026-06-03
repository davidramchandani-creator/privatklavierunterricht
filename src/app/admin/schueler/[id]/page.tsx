import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatCHF, formatDate, formatDateTime } from "@/lib/utils";
import { computePackageState, canCancelPackage, PACKAGE_LABELS, type Package } from "@/lib/packages";
import SchuelerDetailActions, { InvoiceAction, PreiseForm, PackageFormNew, DirektBuchung, AppointmentActions, PackageTimerActions } from "./_components/SchuelerDetailActions";
import { StatusBadge } from "@/components/ui/status-badge";

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
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, role, vorname, nachname, email, telefon, adresse, notizen, aktiv, erstellt_am, price_single, price_10er, price_20er, travel_surcharge, buffer_time_minutes, payment_method")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("packages")
      .select("*")
      .eq("student_id", id)
      .order("erstellt_am", { ascending: false }),
    admin
      .from("appointments")
      .select("id, start_at, end_at, status, series_id")
      .eq("student_id", id)
      .in("status", ["booked", "completed"])
      .gte("start_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(10),
    admin
      .from("invoices")
      .select("id, invoice_number, amount, status, method, lesson_date, created_at, paid_at")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!profile || profile.role === "admin") notFound();

  const prices = {
    price_single: Number(profile.price_single ?? 85),
    price_10er: Number(profile.price_10er ?? 70),
    price_20er: Number(profile.price_20er ?? 65),
    travel_surcharge: Number(profile.travel_surcharge ?? 0),
    buffer_time_minutes: Number(profile.buffer_time_minutes ?? 15),
    payment_method: (profile.payment_method as string) ?? "qr",
  };

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
          initial={{
            price_single: prices.price_single,
            price_10er: prices.price_10er,
            price_20er: prices.price_20er,
            travel_surcharge: prices.travel_surcharge,
            buffer_time_minutes: prices.buffer_time_minutes,
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
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Lektionen</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 hidden sm:table-cell">Preis/Lekt.</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 hidden md:table-cell">Gültig bis</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(packages as Package[]).map((pkg) => {
                const state = computePackageState(pkg, pkg.lessons_used);
                return (
                  <tr key={pkg.id}>
                    <td className="py-3 text-sm font-500 text-gray-900">
                      {PACKAGE_LABELS[pkg.type] ?? pkg.name ?? pkg.type}
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
          schueler_id={id}
          student_user_id={id}
          defaultPrices={{
            price_single: prices.price_single,
            price_10er: prices.price_10er,
            price_20er: prices.price_20er,
            travel_surcharge: prices.travel_surcharge,
          }}
        />
      </div>

      {/* Bevorstehende Lektionen */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">
          Bevorstehende Lektionen
        </h2>
        <div className="mb-4">
          <DirektBuchung schueler_id={id} student_user_id={id} />
        </div>
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
                    {inv.invoice_number ?? "—"}
                  </td>
                  <td className="py-3 text-sm font-600 text-gray-900">
                    {formatCHF(Number(inv.amount))}
                  </td>
                  <td className="py-3 text-sm text-gray-600 hidden sm:table-cell">
                    {inv.lesson_date ? formatDate(inv.lesson_date) : inv.created_at ? formatDate(inv.created_at) : "—"}
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
