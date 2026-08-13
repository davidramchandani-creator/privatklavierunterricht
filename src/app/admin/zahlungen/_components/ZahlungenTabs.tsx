"use client";

import { useState } from "react";

const TABS = [
  { id: "lektionen", label: "Offene Lektionen" },
  { id: "rechnungen", label: "Rechnungen" },
  { id: "raten", label: "Raten & Abos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ZahlungenTabs({
  lektionen,
  rechnungen,
  raten,
  ratenBadge,
  lektionenBadge,
}: {
  lektionen: React.ReactNode;
  rechnungen: React.ReactNode;
  raten: React.ReactNode;
  /** Anzahl offener/überfälliger Raten für den Hinweispunkt. */
  ratenBadge: number;
  /** Anzahl gehaltener, aber noch nicht abgerechneter Lektionen. */
  lektionenBadge: number;
}) {
  // „Offene Lektionen" ist die Startansicht, wenn welche anstehen: Das ist
  // die Arbeit, die noch zu tun ist. Die Rechnungsliste ist ein Archiv.
  const [tab, setTab] = useState<TabId>(
    lektionenBadge > 0 ? "lektionen" : "rechnungen",
  );

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Zahlungsansicht"
        className="flex gap-1 bg-[#F4F5F7] p-1 rounded-2xl w-fit"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`text-sm font-600 px-4 py-2 rounded-xl transition-colors inline-flex items-center gap-2 ${
              tab === t.id
                ? "bg-white text-[#1C244B] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.id === "raten" && ratenBadge > 0 && (
              <span className="text-[11px] font-700 bg-[#1C244B] text-white rounded-full px-1.5 min-w-[18px] text-center">
                {ratenBadge}
              </span>
            )}
            {t.id === "lektionen" && lektionenBadge > 0 && (
              <span className="text-[11px] font-700 bg-[#1C244B] text-white rounded-full px-1.5 min-w-[18px] text-center">
                {lektionenBadge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "lektionen" ? lektionen : tab === "rechnungen" ? rechnungen : raten}
      </div>
    </div>
  );
}
