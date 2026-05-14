import { CheckCircle2, Clock, AlertCircle, ExternalLink } from "lucide-react";
import { formatCHF } from "@/lib/utils";

type Zahlung = {
  id: string;
  betrag: number;
  status: string;
  methode: string | null;
  faellig_am: string | null;
  bezahlt_am: string | null;
  rechnung_nr: string | null;
};

const TWINT_LINK = "https://pay.reka.ch"; // Placeholder – David wird seinen Link eintragen

export default function ZahlungenSection({ zahlungen }: { zahlungen: Zahlung[] }) {
  if (zahlungen.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-500">Keine Zahlungen vorhanden</p>
      </div>
    );
  }

  const offen = zahlungen.filter((z) => z.status === "offen" || z.status === "ausstehend");
  const bezahlt = zahlungen.filter((z) => z.status === "bezahlt");

  return (
    <div className="space-y-4">
      {offen.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <p className="font-600 text-amber-800 text-sm">{offen.length} offene Zahlung{offen.length !== 1 ? "en" : ""}</p>
          </div>
          {offen.map((z) => (
            <ZahlungRow key={z.id} zahlung={z} />
          ))}
          <div className="pt-2 border-t border-amber-200 space-y-2">
            <p className="text-xs font-600 text-amber-700">Bezahlen per Twint:</p>
            <a
              href={TWINT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-600 text-white bg-[#1C244B] px-4 py-2.5 rounded-xl hover:bg-[#1C244B]/90 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Via Twint bezahlen
            </a>
            <p className="text-xs text-amber-600">Bitte Rechnungsnummer im Zahlungszweck angeben.</p>
          </div>
        </div>
      )}

      {bezahlt.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-600 text-gray-700">Bezahlte Rechnungen</p>
          </div>
          <div className="divide-y divide-gray-100">
            {bezahlt.map((z) => (
              <ZahlungRow key={z.id} zahlung={z} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ZahlungRow({ zahlung: z }: { zahlung: Zahlung }) {
  const statusIcon =
    z.status === "bezahlt" ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    ) : (
      <Clock className="w-4 h-4 text-amber-500" />
    );

  const faellig = z.faellig_am
    ? new Date(z.faellig_am).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="flex items-center justify-between px-5 py-3 gap-3">
      <div className="flex items-center gap-2.5">
        {statusIcon}
        <div>
          <p className="text-sm font-500 text-gray-900">{formatCHF(z.betrag)}</p>
          {z.rechnung_nr && <p className="text-xs text-gray-400">Nr. {z.rechnung_nr}</p>}
        </div>
      </div>
      <div className="text-right">
        {z.bezahlt_am ? (
          <p className="text-xs text-emerald-600 font-500">
            Bezahlt {new Date(z.bezahlt_am).toLocaleDateString("de-CH", { day: "numeric", month: "short" })}
          </p>
        ) : faellig ? (
          <p className="text-xs text-amber-600">Fällig {faellig}</p>
        ) : null}
      </div>
    </div>
  );
}
