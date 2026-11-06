import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import LehrpersonFormular from "../_components/LehrpersonFormular";

export default function NeueLehrpersonPage() {
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
      <LehrpersonFormular />
    </div>
  );
}
