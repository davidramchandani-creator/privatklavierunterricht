import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TABELLEN: Record<string, string> = {
  teachers: "Lehrpersonen",
  profiles: "Profile",
  profile_roles: "Rollen",
  packages: "Abos/Pakete",
  package_instalments: "Raten",
  appointments: "Termine",
  invoices: "Rechnungen",
  absences: "Abwesenheiten",
  time_blocks: "Zeitblöcke",
  time_block_rules: "Zeitblock-Regeln",
  admin_verfuegbarkeit: "Verfügbarkeit",
  semester: "Semester",
  schulferien: "Unterrichtsfreie Zeiten",
  preise: "Preise",
  app_settings: "Einstellungen",
  booking_requests: "Terminanfragen",
  reschedule_requests: "Verschiebungen",
  proposals: "Vorschläge",
  warteliste: "Warteliste",
  lektionsnotizen: "Lektionsnotizen",
  lesson_ausfaelle: "Ausfälle",
  planungsrunden: "Planungsrunden",
  planungs_antworten: "Planungsantworten",
};

function zeit(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function kurz(wert: unknown): string {
  if (wert === null || wert === undefined) return "leer";
  const s = typeof wert === "string" ? wert : JSON.stringify(wert);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

/**
 * Änderungsprotokoll (Audit-Log).
 *
 * Jede Änderung an den wichtigen Tabellen wird von einem Datenbank-Trigger
 * festgehalten, auch wenn sie vom Server oder einem automatischen Job
 * kommt. „Server“ heisst: über den Service-Schlüssel, also eine Admin-Aktion
 * oder ein Job. Aktionen aus dem Lehrpersonen-Portal tragen die Person.
 */
export default async function ProtokollPage({
  searchParams,
}: {
  searchParams: Promise<{ tabelle?: string; id?: string }>;
}) {
  const { tabelle, id } = await searchParams;
  const supabase = await createClient();

  let abfrage = supabase
    .from("audit_log")
    .select("id, tabelle, datensatz_id, aktion, alt, neu, akteur, wann")
    .order("wann", { ascending: false })
    .limit(200);
  if (tabelle && TABELLEN[tabelle]) abfrage = abfrage.eq("tabelle", tabelle);
  if (id) abfrage = abfrage.eq("datensatz_id", id);
  const { data: eintraege } = await abfrage;

  const akteure = [...new Set((eintraege ?? []).map((e) => e.akteur).filter(Boolean))] as string[];
  const { data: personen } = akteure.length
    ? await supabase.from("profiles").select("id, vorname, nachname").in("id", akteure)
    : { data: [] };
  const name = new Map((personen ?? []).map((p) => [p.id, `${p.vorname} ${p.nachname}`.trim()]));

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Änderungsprotokoll</h1>
        <p className="text-sm text-gray-500 mt-1">
          Die letzten 200 Änderungen: wer, was, wann, alter und neuer Wert.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/protokoll"
          className={`text-xs font-600 px-3 py-1.5 rounded-full border ${!tabelle ? "bg-[#1C244B] text-white border-[#1C244B]" : "border-gray-200 text-gray-600"}`}
        >
          Alle
        </Link>
        {Object.entries(TABELLEN).map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/protokoll?tabelle=${k}`}
            className={`text-xs font-600 px-3 py-1.5 rounded-full border ${tabelle === k ? "bg-[#1C244B] text-white border-[#1C244B]" : "border-gray-200 text-gray-600"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {(eintraege ?? []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-400">
          Noch keine Änderungen protokolliert.
        </div>
      ) : (
        <div className="space-y-2">
          {(eintraege ?? []).map((e) => {
            const felder = Object.keys({ ...(e.alt ?? {}), ...(e.neu ?? {}) });
            return (
              <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <p className="font-600 text-[#1C244B]">
                    {TABELLEN[e.tabelle] ?? e.tabelle}{" "}
                    <span
                      className={`ml-1 text-xs font-600 px-2 py-0.5 rounded-full ${
                        e.aktion === "DELETE"
                          ? "bg-red-50 text-red-600"
                          : e.aktion === "INSERT"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {e.aktion === "INSERT" ? "neu" : e.aktion === "DELETE" ? "gelöscht" : "geändert"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {zeit(e.wann)} · {e.akteur ? name.get(e.akteur) ?? e.akteur : "Server"}
                    {e.datensatz_id && (
                      <>
                        {" · "}
                        <Link
                          href={`/admin/protokoll?tabelle=${e.tabelle}&id=${e.datensatz_id}`}
                          className="underline underline-offset-2"
                        >
                          Verlauf
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                {e.aktion === "UPDATE" && (
                  <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                    {felder.map((f) => (
                      <li key={f}>
                        <span className="font-600 text-gray-800">{f}</span>: {kurz(e.alt?.[f])} →{" "}
                        {kurz(e.neu?.[f])}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
