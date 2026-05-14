"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  Tag,
  Star,
  CreditCard,
  Inbox,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/anfragen", label: "Anfragen", icon: Inbox },
  { href: "/admin/schueler", label: "Schüler", icon: Users },
  { href: "/admin/kalender", label: "Kalender", icon: Calendar },
  { href: "/admin/verfuegbarkeit", label: "Verfügbarkeit", icon: Clock },
  { href: "/admin/preise", label: "Preise", icon: Tag },
  { href: "/admin/bewertungen", label: "Bewertungen", icon: Star },
  { href: "/admin/zahlungen", label: "Zahlungen", icon: CreditCard },
];

export default function AdminMobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Menü öffnen"
      >
        <Menu className="w-5 h-5 text-gray-600" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col">
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
              <span className="font-700 text-[#3730A3] text-sm">Admin-Menü</span>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-500 text-gray-600 hover:bg-gray-100 hover:text-[#3730A3] transition-colors"
                >
                  <Icon className="w-4 h-4 text-gray-400" />
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
