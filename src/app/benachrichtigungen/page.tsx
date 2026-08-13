import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, Mail, Clock, CreditCard, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PushToggle from "@/components/PushToggle";

export const metadata: Metadata = {
  title: "Benachrichtigungen: Privatklavierunterricht",
};

const arten = [
  {
    icon: <CalendarClock className="w-4 h-4" />,
    titel: "Terminerinnerung",
    text: "24 Stunden und 2 Stunden vor jeder Lektion.",
  },
  {
    icon: <Clock className="w-4 h-4" />,
    titel: "Termine",
    text: "Bestätigungen, Vorschläge, Verschiebungen und Absagen.",
  },
  {
    icon: <CreditCard className="w-4 h-4" />,
    titel: "Zahlungen",
    text: "Neue Rechnungen, Zahlungsbestätigungen und überfällige Beträge.",
  },
  {
    icon: <Mail className="w-4 h-4" />,
    titel: "Paket",
    text: "Hinweis, wenn dein Paket bald abläuft.",
  },
];

export default async function BenachrichtigungenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <main className="min-h-screen bg-surface pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-800 text-navy-900 flex items-center gap-2">
            <Bell className="w-6 h-6" /> Benachrichtigungen
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Erhalte Erinnerungen und Updates direkt auf dein Gerät.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAECEF] p-6">
          {vapid ? (
            <PushToggle vapidPublicKey={vapid} />
          ) : (
            <p className="text-sm text-gray-500">
              Push-Benachrichtigungen sind auf dem Server noch nicht konfiguriert.
              Du bekommst weiterhin alle Infos per E-Mail.
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 space-y-4">
          <h2 className="font-700 text-navy-900 text-sm">Worüber ich dich informiere</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {arten.map(({ icon, titel, text }) => (
              <div key={titel} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-navy-50 text-navy-900 flex items-center justify-center flex-shrink-0">
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-600 text-navy-900">{titel}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/schueler/portal"
          className="inline-block text-sm text-navy-900 hover:underline"
        >
          ← Zurück zum Portal
        </Link>
      </div>
    </main>
  );
}
