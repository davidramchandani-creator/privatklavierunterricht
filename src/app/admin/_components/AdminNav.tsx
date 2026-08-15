"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarOff,
  ChevronDown,
  Clock,
  CreditCard,
  FlaskConical,
  Inbox,
  LayoutDashboard,
  Route,
  Settings,
  Star,
  Users,
  UsersRound,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  icon: React.ElementType;
  basePath: string;
  children: NavItem[];
};

type NavEntry = NavItem | ({ group: true } & NavGroup);

export const navEntries: NavEntry[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/terminanfragen", label: "Terminanfragen", icon: CalendarClock },
  { href: "/admin/anfragen", label: "Probelektionen", icon: Inbox },
  { href: "/admin/schueler", label: "Schüler", icon: Users },
  {
    group: true,
    label: "Kalender",
    icon: Calendar,
    basePath: "/admin/kalender",
    children: [
      { href: "/admin/kalender", label: "Kalenderansicht", icon: Calendar, exact: true },
      { href: "/admin/abwesenheiten", label: "Abwesenheiten", icon: CalendarOff },
      { href: "/admin/verfuegbarkeit", label: "Verfügbarkeit", icon: Clock },
      { href: "/admin/schulferien", label: "Schulferien", icon: CalendarOff },
      { href: "/admin/planung", label: "Terminplanung", icon: CalendarCheck },
      { href: "/admin/routenplanung", label: "Routenplanung", icon: Route },
    ],
  },
  { href: "/admin/gruppenkurse", label: "Gruppenkurse", icon: UsersRound },
  { href: "/admin/zahlungen", label: "Zahlungen", icon: CreditCard },
  { href: "/admin/bewertungen", label: "Bewertungen", icon: Star },
  { href: "/benachrichtigungen", label: "Benachrichtigungen", icon: Bell },
  { href: "/admin/einstellungen", label: "Einstellungen", icon: Settings },
  { href: "/admin/testmodus", label: "Testmodus", icon: FlaskConical },
];

function NavLink({
  href,
  label,
  icon: Icon,
  exact,
  sub,
  onNavigate,
}: NavItem & { sub?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`press flex items-center gap-3 rounded-xl text-sm font-500 transition-all duration-200 ${
        sub ? "px-3 py-2 ml-4" : "px-3 py-2.5"
      } ${
        active
          ? "bg-[#1C244B] text-white shadow-sm shadow-[#1C244B]/20"
          : sub
          ? "text-gray-500 hover:bg-gray-100 hover:text-[#1C244B] hover:translate-x-0.5"
          : "text-gray-600 hover:bg-gray-100 hover:text-[#1C244B] hover:translate-x-0.5"
      }`}
    >
      <Icon
        className={`flex-shrink-0 ${sub ? "w-3.5 h-3.5" : "w-4 h-4"} ${
          active ? "text-white" : "text-gray-400"
        }`}
      />
      {label}
    </Link>
  );
}

function NavGroupItem({
  group,
  onNavigate,
}: {
  group: NavGroup;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isAnyChildActive = group.children.some((c) =>
    c.exact ? pathname === c.href : pathname.startsWith(c.href)
  );
  const [open, setOpen] = useState(isAnyChildActive);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`press flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-500 transition-all duration-200 ${
          isAnyChildActive
            ? "text-[#1C244B] bg-[#1C244B]/5"
            : "text-gray-600 hover:bg-gray-100 hover:text-[#1C244B]"
        }`}
      >
        <group.icon
          className={`w-4 h-4 flex-shrink-0 ${
            isAnyChildActive ? "text-[#1C244B]" : "text-gray-400"
          }`}
        />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${
            open ? "rotate-180" : ""
          } ${isAnyChildActive ? "text-[#1C244B]" : "text-gray-400"}`}
        />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5 animate-enter-up">
          {group.children.map((child) => (
            <NavLink key={child.href} {...child} sub onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {navEntries.map((entry) => {
        if ("group" in entry && entry.group) {
          return (
            <NavGroupItem
              key={entry.basePath}
              group={entry}
              onNavigate={onNavigate}
            />
          );
        }
        const item = entry as NavItem;
        return (
          <NavLink key={item.href} {...item} onNavigate={onNavigate} />
        );
      })}
    </>
  );
}
