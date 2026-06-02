import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatCHF, formatDate, formatDateTime } from "@/lib/utils";
import { computePackageState, canCancelPackage, PACKAGE_LABELS, type Package } from "@/lib/packages";
import SchuelerDetailActions, { ZahlungAction, PreiseForm, PackageFormNew, DirektBuchung, AppointmentActions, PackageTimerActions } from "./_components/SchuelerDetailActions";

export default async function SchuelerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: schueler } = await supabase
    .from("schueler")
    .select("*")
    .eq("id", id)
    .single();

  if (!schueler) notFound();

  const userId = schueler.user_id as string | null;
  const safeUserId = userId ?? "00000000-0000-0000-0000-000000000000";
  const nowIso = new Date().toISOString();

  const [
    { data: profile },
    { data: packages },
    { data: appointments },
    { data: zahlungen },
    { data: bewertung },
  ] = await Promise.all([
    userId
      ? supabase
          .from("profiles")
          .select("price_single, price_10er, price_20er, travel_surcharge, buffer_time_minutes, payment_method")
          .eq("id", safeUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? supabase
          .from("packages")
          .select("*")
          .eq("student_id", safeUserId)
          .order("erstellt_am", { ascending: false })
      : Promise.resolve({ data: [] }),
    userId
      ? supabase
          .from("appointments")
          .select("id, start_at, end_at, status, series_id")
          .eq("student_id", safeUserId)
          .in("status", ["booked", "completed"])
          .gte("start_at", nowIso)
          .order("start_at", { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] }),
    supabase
      .from("zahlungen")
      .select("*")
      .eq("schueler_id", id)
      .order("faellig_am", { ascending: false }),
    supabase
      .from("bewertungen")
      .select("*")
      .eq("schueler_id", id)
      .maybeSingle(),
  ]);

  const prices = {
    price_single: Number(profile?.price_single ?? 85),
    price_10er: Number(profile?.price_10er ?? 70),
    price_20er: Number(profile?.price_20er ?? 65),
    travel_surcharge: Number(profile?.travel_surcharge ?? 0),
    buffer_time_minutes: Number(profile?.buffer_time_minutes ?? 15),
    payment_method: (profile?.payment_method as string) ?? "qr",
  };

  const packageStatusColors: Record<string, string> = {
    aktiv: "bg-emerald-50 text-emerald-700",
    pausiert: "bg-blue-50 text-blue-700",
    aufgebraucht: "bg-gray-100 text-gray-500",
    abgelaufen: "bg-red-50 text-red-600",
    storniert: "bg-red-50 text-red-600",
    kein_paket: "bg-amber-50 text-amber-700",
  };

  const appointmentStatusMap: Record<string, { label: string; color: string }> = {
    booked: { label: "Bestätigt", color: "bg-blue-50 text-blue-700" },
    completed: { label: "Abgeschlossen", color: "bg-emerald-50 text-emerald-700" },
    cancelled: { label: "Storniert", color: "bg-red-50 text-red-600" },
    no_show: { label: "Nicht erschienen", color: "bg-gray-100 text-gray-500" },
  };

  const zahlungStatusColors: Record<string, string> = {
    offen: "bg-amber-50 text-amber-700",
    bezahlt: "bg-emerald-50 text-emerald-700",
    ausstehend: "bg-gray-100 text-gray-600",
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
          {schueler.vorname} {schueler.nachname}
        </h1>
        <span
          className={`text-xs font-500 px-2.5 py-0.5 rounded-full ${
            schueler.aktiv
              ? "bg-emerald-50 text-emerald-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {schueler.aktiv ? "Aktiv" : "Inaktiv"}
        </span>
      </div>

      {/* Schüler info */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">Stammdaten</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">E-Mail</p>
            <p className="text-gray-900">{schueler.email}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">Telefon</p>
            <p className="text-gray-900">{schueler.telefon ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">Seit</p>
            <p className="text-gray-900">
              {schueler.erstellt_am ? formatDate(schueler.erstellt_am) : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">Zahlungsart</p>
            <p className="text-gray-900">
              {prices.payment_method === "twint" ? "TWINT" : "QR-Rechnung"}
            </p>
          </div>
          {schueler.adresse && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">Adresse</p>
              <p className="text-gray-900">{schueler.adresse}</p>
            </div>
          )}
          {schueler.notizen && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">Notizen</p>
              <p className="text-gray-900 whitespace-pre-wrap">{schueler.notizen}</p>
            </div>
          )}
        </div>

        <SchuelerDetailActions schueler={schueler} />
      </div>

      {/* Preise & Einstellungen */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">Preise & Einstellungen</h2>
        {userId ? (
          <PreiseForm
            userId={userId}
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
        ) : (
          <p className="text-sm text-gray-400">
            Schüler ist noch nicht mit einem Login verknüpft.
          </p>
        )}
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
                      <span
                        className={`text-xs font-500 px-2.5 py-0.5 rounded-full ${
                          packageStatusColors[state.effectiveStatus] ?? "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {state.effectiveStatus}
                      </span>
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

        {userId ? (
          <PackageFormNew
            schueler_id={id}
            student_user_id={userId}
            defaultPrices={{
              price_single: prices.price_single,
              price_10er: prices.price_10er,
              price_20er: prices.price_20er,
              travel_surcharge: prices.travel_surcharge,
            }}
          />
        ) : (
          <p className="text-sm text-gray-400">
            Schüler ist noch nicht mit einem Login verknüpft.
          </p>
        )}
      </div>

      {/* Bevorstehende Lektionen */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">
          Bevorstehende Lektionen
        </h2>
        {userId && (
          <div className="mb-4">
            <DirektBuchung schueler_id={id} student_user_id={userId} />
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
              {appointments.map((a) => {
                const meta = appointmentStatusMap[a.status] ?? {
                  label: a.status,
                  color: "bg-gray-100 text-gray-600",
                };
                return (
                  <tr key={a.id}>
                    <td className="py-3 text-sm text-gray-900">{formatDateTime(a.start_at)}</td>
                    <td className="py-3">
                      <span
                        className={`text-xs font-500 px-2.5 py-0.5 rounded-full ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-3">
                      <AppointmentActions appointmentId={a.id} schuelerId={id} status={a.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Zahlungen */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">Zahlungen</h2>
        {!zahlungen || zahlungen.length === 0 ? (
          <p className="text-sm text-gray-400">Keine Zahlungen vorhanden.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Betrag</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 hidden sm:table-cell">Fällig</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zahlungen.map((z) => (
                <tr key={z.id}>
                  <td className="py-3 text-sm font-600 text-gray-900">
                    {formatCHF(z.betrag)}
                  </td>
                  <td className="py-3 text-sm text-gray-600 hidden sm:table-cell">
                    {z.faellig_am ? formatDate(z.faellig_am) : "—"}
                  </td>
                  <td className="py-3">
                    <span
                      className={`text-xs font-500 px-2.5 py-0.5 rounded-full ${
                        zahlungStatusColors[z.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {z.status}
                    </span>
                  </td>
                  <td className="py-3">
                    {z.status === "offen" && (
                      <ZahlungAction zahlungId={z.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bewertung */}
      {bewertung && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-700 text-[#1C244B] mb-4">Bewertung</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={i < bewertung.sterne ? "text-[#C9A84C]" : "text-gray-200"}
                >
                  ★
                </span>
              ))}
              <span className="text-sm text-gray-500 ml-2">{bewertung.sterne}/5</span>
            </div>
            {bewertung.text && (
              <p className="text-sm text-gray-700 italic">„{bewertung.text}"</p>
            )}
            <span
              className={`text-xs font-500 px-2.5 py-0.5 rounded-full inline-block ${
                bewertung.anzeigen
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {bewertung.anzeigen ? "Veröffentlicht" : "Ausstehend"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
