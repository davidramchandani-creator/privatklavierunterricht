import { createAdminClient, createClient } from "@/lib/supabase/server";
import { istTest, standardKreis } from "@/lib/kreis";
import { formatDate } from "@/lib/utils";
import {
  AbwesenheitForm,
  AbwesenheitDeleteButton,
  ZeitblockForm,
  ZeitblockDeleteButton,
  ZeitblockRegelForm,
  ZeitblockRegelDeleteButton,
} from "./_components/AbwesenheitenForms";

export default async function AbwesenheitenPage() {
  const supabase = await createClient();
  const kreis = await standardKreis(await createAdminClient());

  const [
    { data: absences },
    { data: timeBlocks },
    { data: timeBlockRules },
    { data: students },
  ] = await Promise.all([
    supabase
      .from("absences")
      .select("id, scope, student_id, title, start_date, end_date, auto_extend")
      .order("start_date", { ascending: false }),
    supabase
      .from("time_blocks")
      .select("id, title, date, start_time, end_time")
      .order("date", { ascending: false }),
    supabase
      .from("time_block_rules")
      .select("id, title, start_date, start_time, end_time, interval_days")
      .order("start_date", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, vorname, nachname")
      .eq("role", "student")
      // Während eines Testlaufs die Testschüler, sonst die echten – beide
      // gemischt anzubieten lädt zum Fehlklick ein.
      .eq("ist_test", istTest(kreis))
      .order("vorname"),
  ]);

  const studentList = (students ?? []) as {
    id: string;
    vorname: string;
    nachname: string;
  }[];
  const studentName = (id: string | null) => {
    if (!id) return null;
    const s = studentList.find((s) => s.id === id);
    return s ? `${s.vorname} ${s.nachname}` : null;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-800 text-[#1C244B]">Abwesenheiten &amp; Zeitblöcke</h1>

      {/* Abwesenheiten */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">Abwesenheiten</h2>
        {!absences || absences.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">Keine Abwesenheiten erfasst.</p>
        ) : (
          <ul className="divide-y divide-gray-100 mb-4">
            {absences.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-500 px-2.5 py-0.5 rounded-full ${
                        a.scope === "admin"
                          ? "bg-navy-50 text-[#1C244B]"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {a.scope === "admin" ? "Admin" : "Schüler"}
                    </span>
                    <span className="text-sm font-500 text-gray-900">
                      {a.title || "—"}
                    </span>
                    {a.scope === "student" && studentName(a.student_id) && (
                      <span className="text-sm text-gray-500">
                        · {studentName(a.student_id)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {formatDate(a.start_date)} – {formatDate(a.end_date)}
                  </p>
                </div>
                <AbwesenheitDeleteButton id={a.id} />
              </li>
            ))}
          </ul>
        )}
        <AbwesenheitForm students={studentList} />
      </div>

      {/* Zeitblöcke (einmalig) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">Zeitblöcke (einmalig)</h2>
        {!timeBlocks || timeBlocks.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">Keine Zeitblöcke erfasst.</p>
        ) : (
          <ul className="divide-y divide-gray-100 mb-4">
            {timeBlocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-500 text-gray-900">{b.title || "—"}</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {formatDate(b.date)} · {b.start_time?.slice(0, 5)}–{b.end_time?.slice(0, 5)}
                  </p>
                </div>
                <ZeitblockDeleteButton id={b.id} />
              </li>
            ))}
          </ul>
        )}
        <ZeitblockForm />
      </div>

      {/* Wiederholungs-Sperren */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">Wiederholungs-Sperren</h2>
        {!timeBlockRules || timeBlockRules.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">Keine Sperrregeln erfasst.</p>
        ) : (
          <ul className="divide-y divide-gray-100 mb-4">
            {timeBlockRules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-500 text-gray-900">{r.title || "—"}</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    ab {formatDate(r.start_date)} · {r.start_time?.slice(0, 5)}–
                    {r.end_time?.slice(0, 5)} · alle {r.interval_days} Tage
                  </p>
                </div>
                <ZeitblockRegelDeleteButton id={r.id} />
              </li>
            ))}
          </ul>
        )}
        <ZeitblockRegelForm />
      </div>
    </div>
  );
}
