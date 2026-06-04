"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, Calendar, CreditCard } from "lucide-react";

const TABS = [
  { id: "uebersicht", label: "Übersicht", icon: LayoutGrid },
  { id: "termine", label: "Termine", icon: Calendar },
  { id: "zahlungen", label: "Zahlungen", icon: CreditCard },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTab(v: string): v is TabId {
  return v === "uebersicht" || v === "termine" || v === "zahlungen";
}

export default function PortalTabs({
  uebersicht,
  termine,
  zahlungen,
  termineBadge = 0,
  zahlungenBadge = 0,
}: {
  uebersicht: React.ReactNode;
  termine: React.ReactNode;
  zahlungen: React.ReactNode;
  termineBadge?: number;
  zahlungenBadge?: number;
}) {
  const [active, setActive] = useState<TabId>("uebersicht");

  // Mit dem URL-Hash synchronisieren (PortalNav-Links nutzen denselben Hash).
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace("#", "");
      if (isTab(h)) setActive(h);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  function select(id: TabId) {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
  }

  const badgeFor = (id: TabId) =>
    id === "termine" ? termineBadge : id === "zahlungen" ? zahlungenBadge : 0;

  return (
    <div>
      {/* Desktop: Sticky segmented control at top */}
      <div className="hidden sm:block sticky top-16 z-30 -mx-5 px-5 bg-white/85 backdrop-blur-md">
        <div
          role="tablist"
          className="flex gap-1 rounded-2xl bg-gray-50 p-1 border border-gray-100"
        >
          {TABS.map((t) => {
            const isActive = active === t.id;
            const badge = badgeFor(t.id);
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => select(t.id)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-600 transition-colors ${
                  isActive
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-gray-500 hover:text-navy-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
                {badge > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-700 rounded-full bg-red-500 text-white px-1">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: Fixed bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white border-t border-gray-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex" role="tablist">
          {TABS.map((t) => {
            const isActive = active === t.id;
            const badge = badgeFor(t.id);
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => select(t.id)}
                className="relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-2 min-h-[56px] transition-colors"
              >
                {/* Active indicator line at top */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-[#1C244B]" />
                )}
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? "text-[#1C244B]" : "text-gray-400"
                    }`}
                  />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                  )}
                </div>
                <span
                  className={`text-[11px] font-600 transition-colors ${
                    isActive ? "text-[#1C244B]" : "text-gray-400"
                  }`}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Panels */}
      <div className="mt-8">
        <div hidden={active !== "uebersicht"}>{uebersicht}</div>
        <div hidden={active !== "termine"}>{termine}</div>
        <div hidden={active !== "zahlungen"}>{zahlungen}</div>
      </div>
    </div>
  );
}
