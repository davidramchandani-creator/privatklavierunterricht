import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LehrpersonFormular, { type FormWerte } from "../_components/LehrpersonFormular";
import type { Altersgruppe, Unterrichtsort } from "@/lib/lehrpersonen";

/**
 * Aus einer Bewerbung kommend („Als Lehrperson anlegen“) stehen die
 * Angaben in der Adresse und werden vorausgefüllt.
 */
export default async function NeueLehrpersonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const liste = (v?: string) => (v ? v.split(",").filter(Boolean) : []);
  const vorab: Partial<FormWerte> = {
    ...(q.vorname ? { vorname: q.vorname } : {}),
    ...(q.nachname ? { nachname: q.nachname } : {}),
    ...(q.email ? { email: q.email } : {}),
    ...(q.telefon ? { telefon: q.telefon } : {}),
    ...(q.orte ? { unterrichtsorte: liste(q.orte) as Unterrichtsort[] } : {}),
    ...(q.alter ? { altersgruppen: liste(q.alter) as Altersgruppe[] } : {}),
    ...(q.ferien ? { ferien_prozent: Number(q.ferien) } : {}),
    ...(q.start ? { startdatum: q.start } : {}),
  };
  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/admin/lehrpersonen" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1C244B]">
        <ArrowLeft className="w-4 h-4" /> Lehrpersonen
      </Link>
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Neue Lehrperson</h1>
        <p className="text-sm text-gray-500 mt-1">
          Nach dem Anlegen bekommt sie eine Einladung per Mail. Foto und Profiltext ergänzt du danach. Auf der
          Webseite erscheint sie erst, wenn ein Profiltext veröffentlicht ist.
        </p>
      </div>
      <LehrpersonFormular werte={vorab as FormWerte} />
    </div>
  );
}
