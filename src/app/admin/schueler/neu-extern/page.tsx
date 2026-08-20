import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ExternerForm from "./_components/ExternerForm";

export const dynamic = "force-dynamic";

export default function ExternerNeuPage() {
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/schueler"
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-800 text-[#1C244B]">
            Externer Schüler
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Unterricht, der über eine andere Plattform läuft.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#F3F5F8] border border-[#E3E7EE] p-4 text-sm text-gray-600 leading-snug space-y-1.5">
        <p>
          Für Schüler, die du über Matchspace oder ähnlich unterrichtest: Die
          Abrechnung läuft dort, aber der Termin belegt deinen Abend und deine
          Route.
        </p>
        <p className="text-gray-500">
          Deshalb steht er hier im Kalender, blockiert die Zeit gegen
          Doppelbuchungen und zählt in der Routenplanung mit — ohne Konto,
          ohne Rechnung, ohne Post.
        </p>
      </div>

      <ExternerForm />
    </div>
  );
}
