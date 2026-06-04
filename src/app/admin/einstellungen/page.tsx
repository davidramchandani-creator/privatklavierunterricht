import { createAdminClient } from "@/lib/supabase/server";
import { isCalendarConfigured } from "@/lib/google-calendar";
import { CalendarCheck, CalendarX, Mail } from "lucide-react";
import CalendarSettings from "./_components/CalendarSettings";
import EmailTest from "./_components/EmailTest";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const configured = isCalendarConfigured();
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "—";

  const admin = await createAdminClient();
  const { count: futureCount } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "booked")
    .gte("start_at", new Date().toISOString());

  const { count: syncedCount } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "booked")
    .gte("start_at", new Date().toISOString())
    .not("google_event_id", "is", null);

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-800 text-[#1C244B]">Einstellungen</h1>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="flex items-start gap-3">
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              configured ? "bg-emerald-50" : "bg-amber-50"
            }`}
          >
            {configured ? (
              <CalendarCheck className="w-5 h-5 text-emerald-600" />
            ) : (
              <CalendarX className="w-5 h-5 text-amber-600" />
            )}
          </span>
          <div>
            <h2 className="text-lg font-700 text-[#1C244B]">Google Kalender</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Bestätigte Termine werden automatisch in deinen Google-Kalender
              übertragen (Einweg-Sync).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 font-600 uppercase tracking-wide mb-1">
              Status
            </p>
            <p className={configured ? "text-emerald-600 font-600" : "text-amber-600 font-600"}>
              {configured ? "Konfiguriert" : "Nicht konfiguriert"}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 font-600 uppercase tracking-wide mb-1">
              Termine synchronisiert
            </p>
            <p className="text-gray-700 font-600">
              {syncedCount ?? 0} / {futureCount ?? 0}
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400 font-600 uppercase tracking-wide mb-1">
            Kalender-ID
          </p>
          <p className="text-xs text-gray-600 font-mono break-all">{calendarId}</p>
        </div>

        {!configured && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Hinterlege <code className="font-mono">GOOGLE_SERVICE_ACCOUNT_JSON</code> und{" "}
            <code className="font-mono">GOOGLE_CALENDAR_ID</code> in den Umgebungsvariablen
            und gib den Kalender für die Service-Account-E-Mail frei.
          </div>
        )}

        <CalendarSettings configured={configured} />
      </section>

      {/* E-Mail Test */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-blue-600" />
          </span>
          <div>
            <h2 className="text-lg font-700 text-[#1C244B]">E-Mail (Resend)</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Sende eine Test-E-Mail um zu prüfen, ob der Versand funktioniert.
            </p>
          </div>
        </div>
        <EmailTest adminEmail={process.env.ADMIN_EMAIL ?? null} />
        {!process.env.ADMIN_EMAIL && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Setze <code className="font-mono">ADMIN_EMAIL</code> in den Vercel-Umgebungsvariablen,
            damit Admin-Benachrichtigungen (neue Anfragen, Stornierungen usw.) ankommen.
          </div>
        )}
      </section>
    </div>
  );
}
