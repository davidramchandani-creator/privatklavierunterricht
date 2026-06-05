"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutGrid, Calendar, CreditCard } from "lucide-react";

const TABS = [
  { id: "uebersicht", label: "Übersicht", icon: LayoutGrid },
  { id: "termine",    label: "Termine",   icon: Calendar },
  { id: "zahlungen",  label: "Zahlungen", icon: CreditCard },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTab(v: string): v is TabId {
  return TABS.some((t) => t.id === v);
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
  const [animKey, setAnimKey] = useState(0);
  const [dir, setDir] = useState<"right" | "left">("right");
  const prevIdxRef = useRef(0);

  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace("#", "");
      if (isTab(h) && h !== active) {
        const newIdx = TABS.findIndex((t) => t.id === h);
        setDir(newIdx > prevIdxRef.current ? "right" : "left");
        prevIdxRef.current = newIdx;
        setActive(h);
        setAnimKey((k) => k + 1);
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(id: TabId) {
    if (id === active) return;
    const newIdx = TABS.findIndex((t) => t.id === id);
    setDir(newIdx > prevIdxRef.current ? "right" : "left");
    prevIdxRef.current = newIdx;
    setActive(id);
    setAnimKey((k) => k + 1);
    history.replaceState(null, "", `#${id}`);
  }

  const activeIdx = TABS.findIndex((t) => t.id === active);
  const badgeFor = (id: TabId) =>
    id === "termine" ? termineBadge : id === "zahlungen" ? zahlungenBadge : 0;

  const content = active === "uebersicht" ? uebersicht
    : active === "termine" ? termine
    : zahlungen;

  return (
    <div>
      {/* ─── Desktop: sticky segmented control ─────────────────────────────── */}
      <div className="hidden sm:block sticky top-[88px] z-30 mb-6">
        <div role="tablist" className="liquid-glass inline-flex gap-1 rounded-2xl p-1.5">
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
                className={`press relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-600 transition-colors ${
                  isActive
                    ? "bg-navy-900 text-white shadow-sm shadow-navy-900/20"
                    : "text-gray-500 hover:text-navy-900 hover:bg-gray-100"
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

      {/* ─── Mobile: floating Liquid-Glass capsule ──────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 sm:hidden flex justify-center px-4 pointer-events-none"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}
      >
        <nav
          role="tablist"
          className="liquid-glass pointer-events-auto w-full max-w-sm rounded-[26px] overflow-hidden"
        >
          <div className="relative flex">
            {/* Gleitende Glas-Linse hinter dem aktiven Tab */}
            <span
              aria-hidden
              className="liquid-lozenge absolute rounded-[18px] transition-all duration-[340ms]"
              style={{
                top: 7,
                bottom: 7,
                left: `calc(${activeIdx} * (100% / ${TABS.length}) + 6px)`,
                width: `calc(100% / ${TABS.length} - 12px)`,
                transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
              }}
            />

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
                  className="press relative z-10 flex-1 flex flex-col items-center justify-center gap-0.5 pt-2.5 pb-2.5 min-h-[58px]"
                >
                  <div className="relative">
                    <Icon
                      className="w-[22px] h-[22px] transition-[color,transform] duration-200"
                      style={{
                        color: isActive ? "#1C244B" : "#6b7280",
                        transform: isActive ? "scale(1.08)" : "scale(1)",
                        transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                      }}
                    />
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white/70" />
                    )}
                  </div>
                  <span
                    className="text-[10px] transition-colors duration-200"
                    style={{
                      color: isActive ? "#1C244B" : "#6b7280",
                      fontWeight: isActive ? 700 : 600,
                    }}
                  >
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* ─── Panel content ──────────────────────────────────────────────────── */}
      <div
        key={animKey}
        className={dir === "right" ? "animate-tab-right" : "animate-tab-left"}
      >
        {content}
      </div>
    </div>
  );
}
