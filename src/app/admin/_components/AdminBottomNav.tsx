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
  X,
  LogOut,
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

  return (
    <>
      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
          background: "linear-gradient(0deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.62) 100%)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.92), 0 -1px 0 rgba(0,0,0,0.05), 0 -4px 24px rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex" role="tablist">
          {MAIN_TABS.map((tab) => {
            const active = isActive(tab.href, tab.exact);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={active}
                className="relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-3 pb-3 min-h-[60px] transition-colors"
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-[#1C244B]" />
                )}
                <Icon className={`w-5 h-5 transition-colors ${active ? "text-[#1C244B]" : "text-gray-400"}`} />
                <span className={`text-[11px] font-600 transition-colors ${active ? "text-[#1C244B]" : "text-gray-400"}`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}

          {/* Mehr tab */}
          <button
            role="tab"
            aria-selected={moreActive || moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-3 pb-3 min-h-[60px] transition-colors"
          >
            {(moreActive || moreOpen) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-[#1C244B]" />
            )}
            <MoreHorizontal className={`w-5 h-5 transition-colors ${(moreActive || moreOpen) ? "text-[#1C244B]" : "text-gray-400"}`} />
            <span className={`text-[11px] font-600 transition-colors ${(moreActive || moreOpen) ? "text-[#1C244B]" : "text-gray-400"}`}>
              Mehr
            </span>
          </button>
        </div>
      </nav>

      {/* "Mehr" slide-up sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.78) 100%)",
              backdropFilter: "blur(48px) saturate(180%)",
              WebkitBackdropFilter: "blur(48px) saturate(180%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.92), 0 -4px 40px rgba(0,0,0,0.14)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <span className="text-sm font-700 text-gray-900">Navigation</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
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
