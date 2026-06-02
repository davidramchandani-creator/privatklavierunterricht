import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { Mail, Phone, Calendar, MessageSquare } from "lucide-react";
import AnfrageActions from "./_components/AnfrageActions";

export default async function AdminAnfragenPage() {
  const supabase = await createClient();

  const { data: anfragen } = await supabase
    .from("anfragen")
    .select("*")
    .order("erstellt_am", { ascending: false });

  const neu = anfragen?.filter((a) => a.status === "neu") ?? [];
  const bearbeitet = anfragen?.filter((a) => a.status !== "neu") ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-800 text-[#1C244B]">Anfragen</h1>
        {neu.length > 0 && (
          <span className="bg-amber-100 text-amber-700 text-xs font-700 px-3 py-1 rounded-full">
            {neu.length} neu
          </span>
        )}
      </div>

      {anfragen?.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Noch keine Anfragen eingegangen</p>
        </div>
      )}

      {neu.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-600 text-gray-500 uppercase tracking-wide">Neu</h2>
          {neu.map((a) => (
            <AnfrageCard key={a.id} anfrage={a} />
          ))}
        </section>
      )}

      {bearbeitet.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-600 text-gray-500 uppercase tracking-wide">Bearbeitet</h2>
          {bearbeitet.map((a) => (
            <AnfrageCard key={a.id} anfrage={a} muted />
          ))}
        </section>
      )}
    </div>
  );
}

function AnfrageCard({
  anfrage,
  muted = false,
}: {
  anfrage: {
    id: string;
    vorname: string;
    nachname: string;
    email: string;
    telefon: string | null;
    nachricht: string | null;
    wunschtermin: string | null;
    status: string;
    erstellt_am: string;
  };
  muted?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-5 space-y-3 ${
        muted ? "border-gray-100 opacity-60" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-700 text-gray-900">
            {anfrage.vorname} {anfrage.nachname}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Eingegangen: {formatDateTime(anfrage.erstellt_am)}
          </p>
        </div>
        <AnfrageActions id={anfrage.id} status={anfrage.status} />
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        <a
          href={`mailto:${anfrage.email}`}
          className="flex items-center gap-2 text-[#1C244B] hover:underline"
        >
          <Mail className="w-3.5 h-3.5 flex-shrink-0" />
          {anfrage.email}
        </a>
        {anfrage.telefon && (
          <a
            href={`tel:${anfrage.telefon}`}
            className="flex items-center gap-2 text-gray-600 hover:text-[#1C244B]"
          >
            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
            {anfrage.telefon}
          </a>
        )}
        {anfrage.wunschtermin && (
          <div className="flex items-center gap-2 text-gray-600 sm:col-span-2">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-[#1C244B]" />
            <span className="font-500 text-[#1C244B]">
              Wunschtermin: {formatDateTime(anfrage.wunschtermin)}
            </span>
          </div>
        )}
      </div>

      {anfrage.nachricht && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
          {anfrage.nachricht}
        </p>
      )}
    </div>
  );
}
