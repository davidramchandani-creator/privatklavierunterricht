import { Package, CheckCircle2, AlertCircle } from "lucide-react";
import { formatCHF } from "@/lib/utils";

type Paket = {
  id: string;
  typ: string;
  lektionen_gesamt: number;
  lektionen_genutzt: number;
  preis_pro_lektion: number;
  gueltig_bis: string | null;
  aktiv: boolean;
  erstellt_am: string;
};

export default function PaketCard({ paket }: { paket: Paket | null }) {
  if (!paket) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <p className="font-600 text-gray-900">Kein aktives Paket</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Melde dich bei David, um ein Paket zu erwerben.
          </p>
        </div>
      </div>
    );
  }

  const verbleibend = paket.lektionen_gesamt - paket.lektionen_genutzt;
  const progress = (paket.lektionen_genutzt / paket.lektionen_gesamt) * 100;
  const abgelaufen = paket.gueltig_bis ? new Date(paket.gueltig_bis) < new Date() : false;

  const typLabels: Record<string, string> = {
    einzellektion: "Einzellektion",
    "10er": "10er-Paket",
    "20er": "20er-Paket",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1C244B]/10 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-[#1C244B]" />
          </div>
          <div>
            <p className="font-700 text-gray-900">{typLabels[paket.typ] ?? paket.typ}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatCHF(paket.preis_pro_lektion)} pro Lektion
            </p>
          </div>
        </div>
        {abgelaufen ? (
          <span className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-500">Abgelaufen</span>
        ) : (
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-500 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Aktiv
          </span>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Lektionen genutzt</span>
          <span className="font-600 text-gray-900">{paket.lektionen_genutzt} / {paket.lektionen_gesamt}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-[#1C244B] transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Verbleibend</span>
          <span className="font-700 text-[#1C244B]">{verbleibend} Lektion{verbleibend !== 1 ? "en" : ""}</span>
        </div>
        {paket.gueltig_bis && (
          <div className="flex justify-between text-sm pt-1 border-t border-gray-100">
            <span className="text-gray-500">Gültig bis</span>
            <span className="font-500 text-gray-700">
              {new Date(paket.gueltig_bis).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
