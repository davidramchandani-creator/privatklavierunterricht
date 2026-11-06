import { MapPin, UserRound, Users } from "lucide-react";
import EinfacherText from "@/components/EinfacherText";
import { alterText, orteText, type OeffentlicheLehrperson } from "@/lib/lehrpersonen";

/**
 * Öffentliche Karte einer Lehrperson. Nur Vorname, Foto, freigegebener
 * Text, Orte (ohne Adresse) und Altersgruppen. Kontakt nur über David.
 */
export default function LehrpersonKarte({ l }: { l: OeffentlicheLehrperson }) {
  const alter = alterText(l.altersgruppen);
  return (
    <article className="bg-white rounded-2xl border border-[#EAECEF] shadow-sm p-6 flex flex-col gap-4 transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center gap-4">
        {l.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.foto_url} alt={`Foto von ${l.vorname}`} className="w-20 h-20 rounded-2xl object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-navy-50 flex items-center justify-center">
            <UserRound className="w-8 h-8 text-navy-900" />
          </div>
        )}
        <div>
          <h3 className="text-xl font-800 text-navy-900">{l.vorname}</h3>
          {l.ist_inhaber && <p className="text-sm text-navy-600 font-600">Gründer</p>}
        </div>
      </div>
      <div className="text-gray-600 text-sm">
        <EinfacherText text={l.kurztext ?? ""} />
      </div>
      <ul className="space-y-1.5 text-sm text-gray-600 mt-auto pt-2 border-t border-[#EAECEF]">
        {orteText(l).map((o) => (
          <li key={o} className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-navy-600 shrink-0" /> {o}
          </li>
        ))}
        {alter && (
          <li className="flex items-center gap-2">
            <Users className="w-4 h-4 text-navy-600 shrink-0" /> {alter}
          </li>
        )}
      </ul>
    </article>
  );
}
