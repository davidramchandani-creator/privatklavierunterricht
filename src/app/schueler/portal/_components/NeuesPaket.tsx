"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Package, Check, Loader2, X } from "lucide-react";
import { formatCHF } from "@/lib/utils";
import { buyPackage } from "../actions";

type Prices = {
  price_10er: number;
  price_20er: number;
  travel_surcharge: number;
};

type Variant = {
  type: "10er" | "20er";
  label: string;
  lessons: number;
  validityLabel: string;
};

const VARIANTS: Variant[] = [
  { type: "10er", label: "10er-Paket", lessons: 10, validityLabel: "5 Monate gültig" },
  { type: "20er", label: "20er-Paket", lessons: 20, validityLabel: "10 Monate gültig" },
];

export default function NeuesPaket({
  prices,
  canBuy,
  blockedReason,
}: {
  prices: Prices;
  canBuy: boolean;
  blockedReason?: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Variant | null>(null);
  const [agb, setAgb] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function pricePerLesson(type: "10er" | "20er") {
    const base = type === "10er" ? prices.price_10er : prices.price_20er;
    return Number(base) + Number(prices.travel_surcharge);
  }

  function handleBuy() {
    if (!selected || !agb) return;
    setError(null);
    startTransition(async () => {
      const result = await buyPackage(selected.type, agb);
      if (result?.error) {
        setError(result.error);
      } else {
        setSelected(null);
        setAgb(false);
        router.refresh();
      }
    });
  }

  if (!canBuy) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm text-gray-500">
          Ein neues Paket kannst du buchen, sobald dein aktuelles aufgebraucht oder
          abgelaufen ist.
          {blockedReason ? ` ${blockedReason}` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {VARIANTS.map((v) => {
          const ppl = pricePerLesson(v.type);
          const total = ppl * v.lessons;
          return (
            <button
              key={v.type}
              onClick={() => {
                setSelected(v);
                setAgb(false);
                setError(null);
              }}
              className="text-left bg-white rounded-2xl border border-gray-200 hover:border-[#1C244B]/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-5 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1C244B]/10 flex items-center justify-center group-hover:bg-[#1C244B]/15 transition-colors">
                  <Package className="w-5 h-5 text-[#1C244B]" />
                </div>
                <div>
                  <p className="font-700 text-gray-900">{v.label}</p>
                  <p className="text-xs text-gray-500">{v.validityLabel}</p>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-2xl font-800 text-[#1C244B]">{formatCHF(ppl)}</p>
                  <p className="text-xs text-gray-500">pro Lektion</p>
                </div>
                <p className="text-sm text-gray-500">
                  Total <span className="font-600 text-gray-700">{formatCHF(total)}</span>
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bestätigungs-Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !isPending && setSelected(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1C244B]/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-[#1C244B]" />
                </div>
                <div>
                  <h3 className="font-700 text-gray-900">{selected.label}</h3>
                  <p className="text-xs text-gray-500">{selected.validityLabel}</p>
                </div>
              </div>
              <button
                onClick={() => !isPending && setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Lektionen</span>
                <span className="font-600 text-gray-900">{selected.lessons}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Preis pro Lektion</span>
                <span className="font-600 text-gray-900">
                  {formatCHF(pricePerLesson(selected.type))}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="text-gray-500">Gesamtpreis</span>
                <span className="font-800 text-[#1C244B]">
                  {formatCHF(pricePerLesson(selected.type) * selected.lessons)}
                </span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agb}
                onChange={(e) => setAgb(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1C244B] focus:ring-[#1C244B]"
              />
              <span className="text-sm text-gray-600 leading-snug">
                Ich habe die{" "}
                <Link
                  href="/agb"
                  target="_blank"
                  className="text-[#1C244B] font-500 hover:underline"
                >
                  AGB
                </Link>{" "}
                gelesen und akzeptiere sie. Mit dem Kauf buche ich dieses Paket
                verbindlich.
              </span>
            </label>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              onClick={handleBuy}
              disabled={!agb || isPending}
              className="w-full flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl py-3 hover:bg-[#151c3d] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 transition-all duration-200"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Wird gebucht…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Verbindlich buchen
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
