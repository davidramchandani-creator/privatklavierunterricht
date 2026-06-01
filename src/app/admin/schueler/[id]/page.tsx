import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatCHF, formatDate, formatDateTime } from "@/lib/utils";
import SchuelerDetailActions, { PaketForm, TerminActions, ZahlungAction } from "./_components/SchuelerDetailActions";

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

  const [
    { data: pakete },
    { data: termine },
    { data: zahlungen },
    { data: bewertung },
  ] = await Promise.all([
    supabase
      .from("pakete")
      .select("*")
      .eq("schueler_id", id)
      .order("erstellt_am", { ascending: false }),
    supabase
      .from("termine")
      .select("*")
      .eq("schueler_id", id)
      .gte("beginn", new Date().toISOString())
      .order("beginn", { ascending: true })
      .limit(10),
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

  const typLabels: Record<string, string> = {
    einzellektion: "Einzellektion",
    "10er": "10er-Paket",
    "20er": "20er-Paket",
  };

  const zahlungStatusColors: Record<string, string> = {
    offen: "bg-amber-50 text-amber-700",
    bezahlt: "bg-emerald-50 text-emerald-700",
    ausstehend: "bg-gray-100 text-gray-600",
  };

  const terminStatusColors: Record<string, string> = {
    angefragt: "bg-amber-50 text-amber-700",
    bestaetigt: "bg-blue-50 text-blue-700",
    abgeschlossen: "bg-emerald-50 text-emerald-700",
    storniert: "bg-red-50 text-red-600",
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
        <h1 className="text-2xl font-800 text-[#3730A3]">
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
        <h2 className="text-lg font-700 text-[#3730A3] mb-4">Stammdaten</h2>
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

      {/* Pakete */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#3730A3] mb-4">Pakete</h2>

        {pakete && pakete.length > 0 ? (
          <table className="w-full mb-4">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Typ</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Lektionen</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 hidden sm:table-cell">Preis/Lekt.</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 hidden md:table-cell">Gültig bis</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pakete.map((p) => {
                const verbleibend = p.lektionen_gesamt - p.lektionen_genutzt;
                return (
                  <tr key={p.id}>
                    <td className="py-3 text-sm font-500 text-gray-900">
                      {typLabels[p.typ] ?? p.typ}
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {p.lektionen_genutzt}/{p.lektionen_gesamt}
                      <span className="text-[#3730A3] font-600 ml-1">
                        ({verbleibend} übrig)
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600 hidden sm:table-cell">
                      {formatCHF(p.preis_pro_lektion)}
                    </td>
                    <td className="py-3 text-sm text-gray-600 hidden md:table-cell">
                      {p.gueltig_bis ? formatDate(p.gueltig_bis) : "—"}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-xs font-500 px-2.5 py-0.5 rounded-full ${
                          p.aktiv
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {p.aktiv ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400 mb-4">Noch kein Paket vorhanden.</p>
        )}

        <PaketForm schueler_id={id} />
      </div>

      {/* Termine */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#3730A3] mb-4">
          Bevorstehende Lektionen
        </h2>
        {!termine || termine.length === 0 ? (
          <p className="text-sm text-gray-400">Keine bevorstehenden Lektionen.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Datum & Zeit</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Status</th>
                <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">Notiz</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {termine.map((t) => (
                <tr key={t.id}>
                  <td className="py-3 text-sm text-gray-900">{formatDateTime(t.beginn)}</td>
                  <td className="py-3">
                    <span
                      className={`text-xs font-500 px-2.5 py-0.5 rounded-full ${
                        terminStatusColors[t.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-gray-500">{t.notiz ?? "—"}</td>
                  <td className="py-3">
                    <TerminActions terminId={t.id} status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Zahlungen */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#3730A3] mb-4">Zahlungen</h2>
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
          <h2 className="text-lg font-700 text-[#3730A3] mb-4">Bewertung</h2>
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
