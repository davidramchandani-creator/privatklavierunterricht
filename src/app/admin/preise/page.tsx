"use client";

import { useState, useEffect, useTransition } from "react";
import { updatePreise } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const TYPEN = [
  { key: "einzellektion", label: "Einzellektion" },
  { key: "halbjahr", label: "Halbjahresabo (pro Lektion)" },
  { key: "jahr", label: "Jahresabo (pro Lektion)" },
] as const;

export default function PreisePage() {
  const [prices, setPrices] = useState<Record<string, string>>({
    einzellektion: "",
    halbjahr: "",
    jahr: "",
  });
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("preise")
      .select("*")
      .eq("aktiv", true)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          for (const row of data) {
            map[row.typ] = String(row.preis_pro_lektion);
          }
          setPrices((prev) => ({ ...prev, ...map }));
        }
        setLoading(false);
      });
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updatePreise(formData) as { success?: boolean; error?: string };
      if (result?.error) setError(result.error);
      else setSuccess(true);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-[#1C244B]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-800 text-[#1C244B]">Preise</h1>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-500">
            Richtwerte pro Lektion in CHF, für die Preisübersicht.
          </p>
          <p className="text-xs text-gray-400 leading-snug">
            Verbindlich ist der Preis, der beim einzelnen Schüler hinterlegt
            ist — dort wird auch der Wegaufschlag gesetzt. Diese Werte werden
            nicht automatisch übernommen.
          </p>

          {TYPEN.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-sm font-500 text-gray-700">{label}</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-600 text-gray-400 w-12">CHF</span>
                <Input
                  name={key}
                  type="number"
                  step="0.01"
                  min="0"
                  value={prices[key]}
                  onChange={(e) =>
                    setPrices((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder="0.00"
                  className="flex-1"
                />
              </div>
            </div>
          ))}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4" />
              Preise gespeichert!
            </div>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Speichern…
              </>
            ) : (
              "Preise speichern"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
