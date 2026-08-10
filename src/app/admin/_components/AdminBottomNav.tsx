"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  MoreHorizontal,
  CalendarClock,
  Inbox,
  CreditCard,
  Settings,
  UsersRound,
  Bell,
  X,
  LogOut,
  Route,
  CalendarCheck,
} from "lucide-react";
import { logout } from "@/app/auth/actions";

const MAIN_TABS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/schueler", label: "Schüler", icon: Users, exact: false },
  { href: "/admin/kalender", label: "Kalender", icon: Calendar, exact: false },
] as const;

const MORE_ITEMS = [
  { href: "/admin/terminanfragen", label: "Terminanfragen", icon: CalendarClock },
  { href: "/admin/anfragen", label: "Probelektionen", icon: Inbox },
  { href: "/admin/zahlungen", label: "Zahlungen", icon: CreditCard },
  { href: "/admin/gruppenkurse", label: "Gruppenkurse", icon: UsersRound },
  { href: "/admin/planung", label: "Terminplanung", icon: CalendarCheck },
  { href: "/admin/routenplanung", label: "Routenplanung", icon: Route },
  { href: "/benachrichtigungen", label: "Benachrichtigungen", icon: Bell },
  { href: "/admin/einstellungen", label: "Einstellungen", icon: Settings },
];

export default function AdminBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  // "Mehr" is active if current path matches any of the more items
  const moreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.href));
  const moreHighlighted = moreActive || moreOpen;

  // Index der aktiven Zelle (3 Haupt-Tabs + „Mehr") für die gleitende Glas-Linse
  const CELLS = MAIN_TABS.length + 1;
  const mainActiveIdx = MAIN_TABS.findIndex((t) => isActive(t.href, t.exact));
  const activeIdx = mainActiveIdx >= 0 ? mainActiveIdx : moreHighlighted ? MAIN_TABS.length : -1;

  return (
    <>
      {/* Floating Liquid-Glass capsule */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden flex justify-center px-4 pointer-events-none"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}
      >
        <nav
          role="tablist"
          className="liquid-glass pointer-events-auto w-full max-w-sm rounded-[26px] overflow-hidden"
        >
          <div className="relative flex">
            {/* Gleitende Glas-Linse hinter der aktiven Zelle */}
            {activeIdx >= 0 && (
              <span
                aria-hidden
                className="liquid-lozenge absolute rounded-[18px] transition-all duration-[340ms]"
                style={{
                  top: 7,
                  bottom: 7,
                  left: `calc(${activeIdx} * (100% / ${CELLS}) + 6px)`,
                  width: `calc(100% / ${CELLS} - 12px)`,
                  transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              />
            )}

            {MAIN_TABS.map((tab) => {
              const active = isActive(tab.href, tab.exact);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  role="tab"
                  aria-selected={active}
                  className="press relative z-10 flex-1 flex flex-col items-center justify-center gap-0.5 pt-2.5 pb-2.5 min-h-[58px]"
                >
                  <Icon
                    className="w-[21px] h-[21px] transition-[color,transform] duration-200"
                    style={{
                      color: active ? "#1C244B" : "#6b7280",
                      transform: active ? "scale(1.08)" : "scale(1)",
                      transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                    }}
                  />
                  <span
                    className="text-[10px] transition-colors duration-200"
                    style={{ color: active ? "#1C244B" : "#6b7280", fontWeight: active ? 700 : 600 }}
                  >
                    {tab.label}
                  </span>
                </Link>
              );
            })}

            {/* Mehr */}
            <button
              role="tab"
              aria-selected={moreHighlighted}
              onClick={() => setMoreOpen((v) => !v)}
              className="press relative z-10 flex-1 flex flex-col items-center justify-center gap-0.5 pt-2.5 pb-2.5 min-h-[58px]"
            >
              <MoreHorizontal
                className="w-[21px] h-[21px] transition-[color,transform] duration-200"
                style={{
                  color: moreHighlighted ? "#1C244B" : "#6b7280",
                  transform: moreHighlighted ? "scale(1.08)" : "scale(1)",
                  transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              />
              <span
                className="text-[10px] transition-colors duration-200"
                style={{ color: moreHighlighted ? "#1C244B" : "#6b7280", fontWeight: moreHighlighted ? 700 : 600 }}
              >
                Mehr
              </span>
            </button>
          </div>
        </nav>
      </div>

      {/* "Mehr" slide-up sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px] animate-fade-in" />
          <div
            className="liquid-glass-bar liquid-glass-bar--bottom absolute bottom-0 left-0 right-0 rounded-t-[28px] animate-slide-in"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grabber */}
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="w-9 h-1 rounded-full bg-navy-900/15" />
            </div>
            <div className="flex items-center justify-between px-5 pt-1 pb-3">
              <span className="text-sm font-700 text-gray-900">Navigation</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="px-4 py-3 space-y-1">
              {MORE_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-500 transition-colors ${
                      active
                        ? "bg-[#1C244B] text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? "text-white" : "text-gray-400"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="px-4 pb-4 pt-2 border-t border-gray-100">
              <form action={logout}>
                <button
                  type="submit"
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-500 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Abmelden
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
