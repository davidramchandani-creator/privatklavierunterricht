import Link from "next/link";
import { UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { describeFixplatz } from "@/lib/fixplatz";
import { ABO_LABELS } from "@/lib/abo";
import { GRUPPENUNTERRICHT, GRUPPE_ABWESENHEIT, type Gruppengroesse } from "@/lib/gruppenunterricht";
import { naechsterPeriodenstart } from "@/lib/abo-server";
import { todayInZurich } from "@/lib/subscription";
import { formatDate, formatDateTime } from "@/lib/utils";
import GruppeFormular, { type Kandidat } from "./_components/GruppeFormular";
import LektionAbsagen from "./_components/LektionAbsagen";

export const metadata = { title: "Gruppen" };

type GruppeZeile = {
  id: string;
  name: string;
  groesse: number;
  abo_variante: "halbjahr" | "jahr";
  rhythmus: "woechentlich" | "zweiwoechentlich";
  fixplatz_weekday: number;
  fixplatz_time: string;
  fixplatz_week_parity: number | null;
  lektion_minuten: number;
  periode_start: string;
  status: string;
  notiz: string | null;
};

export default async function GruppenPage() {
  const supabase = await createClient();
  const jetzt = new Date().toISOString();

  const [{ data: schueler }, { data: aktive }, { data: gruppen }, { data: abos }, { data: termine }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, vorname, nachname, extern, ist_test")
        .eq("role", "student")
        .eq("aktiv", true)
        .order("vorname"),
      supabase.from("packages").select("student_id, gruppe_id").eq("status", "active"),
      supabase.from("gruppen").select("*").order("erstellt_am", { ascending: false }),
      supabase
        .from("packages")
        .select("id, student_id, gruppe_id, status, periode_ende, price_per_lesson, monatsbetrag, profiles!student_id(vorname, nachname)")
        .not("gruppe_id", "is", null),
      supabase
        .from("appointments")
        .select("id, gruppe_id, start_at, end_at, status, student_id")
        .not("gruppe_id", "is", null)
        .gte("end_at", jetzt)
        .order("start_at")
        .limit(500),
    ]);

  const mitAbo = new Set((aktive ?? []).map((a) => a.student_id as string));
  const kandidaten: Kandidat[] = (schueler ?? [])
    .filter((s) => s.extern !== true)
    .map((s) => ({
      id: s.id as string,
      name: `${s.vorname ?? ""} ${s.nachname ?? ""}`.trim() || "Ohne Namen",
      vorname: String(s.vorname ?? ""),
      test: s.ist_test === true,
      hatAbo: mitAbo.has(s.id as string),
    }));

  const liste = (gruppen ?? []) as GruppeZeile[];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-800 text-[#1C244B]">Gruppen</h1>
        <p className="text-sm text-gray-500">
          Feste Gruppen zu zweit oder zu dritt, {GRUPPENUNTERRICHT[2].minuten} Minuten. Jede Person hat
          ein eigenes Abo mit eigenen Raten. {GRUPPE_ABWESENHEIT}
        </p>
      </div>

      <GruppeFormular kandidaten={kandidaten} startVorschlag={naechsterPeriodenstart(todayInZurich())} />

      {liste.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400">
          <UsersRound className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Noch keine Gruppe angelegt</p>
        </div>
      ) : (
        <section className="space-y-4">
          {liste.map((g) => {
            const mitglieder = (abos ?? []).filter((a) => a.gruppe_id === g.id);
            const laufend = mitglieder.filter((m) => m.status === "active");
            const preis = laufend[0]?.price_per_lesson ?? mitglieder[0]?.price_per_lesson;
            const monat = laufend[0]?.monatsbetrag ?? mitglieder[0]?.monatsbetrag;
            const ende = laufend[0]?.periode_ende ?? mitglieder[0]?.periode_ende;

            // Lektionen: ein Eintrag pro Beginn, mit allen, die kommen.
            const proStart = new Map<string, { start: string; ende: string; gebucht: number; total: number }>();
            for (const t of (termine ?? []).filter((t) => t.gruppe_id === g.id)) {
              const k = t.start_at as string;
              const e = proStart.get(k) ?? { start: k, ende: t.end_at as string, gebucht: 0, total: 0 };
              e.total++;
              if (t.status === "booked") e.gebucht++;
              proStart.set(k, e);
            }
            const naechste = [...proStart.values()].slice(0, 6);

            return (
              <article key={g.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="font-800 text-[#1C244B] text-lg">{g.name}</h2>
                    <p className="text-sm text-gray-600">
                      {describeFixplatz(
                        g.fixplatz_weekday,
                        g.fixplatz_time,
                        g.rhythmus,
                        (g.fixplatz_week_parity as 0 | 1 | null) ?? null
                      )}
                      , {g.lektion_minuten} Minuten
                    </p>
                  </div>
                  <span className="text-xs font-700 px-3 py-1 rounded-full bg-[#F3F5F8] text-[#1C244B]">
                    {GRUPPENUNTERRICHT[g.groesse as Gruppengroesse]?.label ?? `${g.groesse} Personen`} ·{" "}
                    {ABO_LABELS[g.abo_variante]}
                  </span>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-[#F3F5F8] px-4 py-3">
                    <p className="text-xs text-gray-500">Pro Person und Lektion</p>
                    <p className="font-700 text-[#1C244B]">CHF {Number(preis ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl bg-[#F3F5F8] px-4 py-3">
                    <p className="text-xs text-gray-500">Pro Person und Monat</p>
                    <p className="font-700 text-[#1C244B]">CHF {Number(monat ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl bg-[#F3F5F8] px-4 py-3">
                    <p className="text-xs text-gray-500">Periode</p>
                    <p className="font-700 text-[#1C244B]">
                      {formatDate(g.periode_start)} bis {ende ? formatDate(String(ende)) : "?"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-600 text-gray-500 uppercase tracking-wide">Mitglieder</p>
                  <div className="flex flex-wrap gap-2">
                    {mitglieder.map((m) => {
                      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                      return (
                        <Link
                          key={m.id as string}
                          href={`/admin/schueler/${m.student_id}`}
                          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:border-[#1C244B]/30 hover:-translate-y-px transition"
                        >
                          {`${p?.vorname ?? ""} ${p?.nachname ?? ""}`.trim()}
                          {m.status !== "active" && <span className="text-gray-400"> (beendet)</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  Die Gruppe endet mit der Periode, eine automatische Verlängerung für Gruppen
                  folgt. Einzelne Mitglieder sagen im Portal ab, die Lektion findet für die anderen statt.
                </div>

                {naechste.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-600 text-gray-500 uppercase tracking-wide">Nächste Lektionen</p>
                    <ul className="divide-y divide-gray-100">
                      {naechste.map((l) => (
                        <li key={l.start} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-sm text-[#1C244B]">
                            {formatDateTime(l.start)}
                            <span className="text-gray-400">
                              {" "}
                              · {l.gebucht === l.total ? "alle kommen" : `${l.gebucht} von ${l.total} kommen`}
                            </span>
                          </span>
                          {l.gebucht > 0 && <LektionAbsagen gruppeId={g.id} startAt={l.start} />}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {g.notiz && <p className="text-xs text-gray-500">Notiz: {g.notiz}</p>}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
