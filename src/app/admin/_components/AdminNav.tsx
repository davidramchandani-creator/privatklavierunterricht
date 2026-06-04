"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarClock,
  CalendarOff,
  CreditCard,
  Inbox,
  Settings,
  Clock,
} from "lucide-react";

export const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/terminanfragen", label: "Terminanfragen", icon: CalendarClock },
  { href: "/admin/anfragen", label: "Probelektionen", icon: Inbox },
  { href: "/admin/schueler", label: "Schüler", icon: Users },
  { href: "/admin/kalender", label: "Kalender", icon: Calendar },
  { href: "/admin/abwesenheiten", label: "Abwesenheiten", icon: CalendarOff },
  { href: "/admin/verfuegbarkeit", label: "Verfügbarkeit", icon: Clock },
  { href: "/admin/zahlungen", label: "Zahlungen", icon: CreditCard },
  { href: "/admin/einstellungen", label: "Einstellungen", icon: Settings },
];

export function AdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {navItems.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-500 transition-colors ${
              active
                ? "bg-[#1C244B] text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-[#1C244B]"
            }`}
          >
            <Icon
              className={`w-4 h-4 flex-shrink-0 ${
                active ? "text-white" : "text-gray-400"
              }`}
            />
            {label}
          </Link>
        );
      })}
    </>
  );
}
