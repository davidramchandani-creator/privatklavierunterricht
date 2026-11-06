import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LehrpersonKarte from "@/components/LehrpersonKarte";
import LehrpersonFormular from "../_components/LehrpersonFormular";
import ProfilBereich from "./_components/ProfilBereich";
import type { Altersgruppe, Unterrichtsort } from "@/lib/lehrpersonen";

export const dynamic = "force-dynamic";

export default async function LehrpersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: l } = await supabase.from("teachers").select("*").eq("id", id).maybeSingle();
  if (!l) notFound();

  const { data: login } = l.profile_id
    ? await supabase.from("profiles").select("email, telefon").eq("id", l.profile_id).maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/admin/lehrpersonen" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1C244B]">
        <ArrowLeft className="w-4 h-4" /> Lehrpersonen
      </Link>
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">
          {l.vorname} {l.nachname}
        </h1>
        {login && (
          <p className="text-sm text-gray-500 mt-1">
            Login: {login.email}
            {login.telefon ? ` · ${login.telefon}` : ""} (nur für dich sichtbar)
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6">
          <ProfilBereich
            id={l.id}
            kurztext={l.kurztext}
            entwurf={l.kurztext_entwurf}
            eingereichtAm={l.kurztext_eingereicht_am}
            status={l.status}
            istInhaber={l.ist_inhaber}
          />
          <LehrpersonFormular
            id={l.id}
            werte={{
              vorname: l.vorname,
              nachname: l.nachname,
              unterrichtsorte: l.unterrichtsorte as Unterrichtsort[],
              unterrichtsadresse: l.unterrichtsadresse,
              startpunkt_adresse: l.startpunkt_adresse,
              startpunkt_gefunden: l.startpunkt_lat !== null,
              region: l.region,
              altersgruppen: l.altersgruppen as Altersgruppe[],
              startdatum: l.startdatum,
              lohn_pro_lektion: l.lohn_pro_lektion === null ? null : Number(l.lohn_pro_lektion),
              ferien_prozent: Number(l.ferien_prozent),
              sortierung: l.sortierung,
              ist_inhaber: l.ist_inhaber,
            }}
          />
        </div>
        <div className="space-y-2 lg:sticky lg:top-6">
          <p className="text-xs font-600 text-gray-400 uppercase tracking-wide">So sieht es auf der Webseite aus</p>
          {l.kurztext ? (
            <LehrpersonKarte
              l={{
                id: l.id,
                vorname: l.vorname,
                foto_url: l.foto_url,
                kurztext: l.kurztext,
                unterrichtsorte: l.unterrichtsorte,
                region: l.region,
                altersgruppen: l.altersgruppen,
                ist_inhaber: l.ist_inhaber,
                sortierung: l.sortierung,
              }}
            />
          ) : (
            <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-200 p-5">
              Noch nicht auf der Webseite: Es fehlt ein veröffentlichter Profiltext.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
