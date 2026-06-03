"use client";

import { useState } from "react";
import Link from "next/link";
import { Music, LogOut, Menu, X } from "lucide-react";
import { logout } from "@/app/auth/actions";

const SECTIONS = [
  { href: "#uebersicht", label: "Übersicht" },
  { href: "#termine", label: "Termine" },
  { href: "#zahlungen", label: "Zahlungen" },
];

export default function PortalNav({ vorname }: { vorname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="w-8 h-8 rounded-xl bg-navy-900 flex items-center justify-center">
            <Music className="w-4 h-4 text-white" />
          </span>
          <span className="font-700 text-navy-900 text-[15px] tracking-tight">
            Mein Portal
          </span>
        </Link>

        {/* Desktop: Section-Links */}
        <nav className="hidden sm:flex items-center gap-1">
          {SECTIONS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="px-3 py-1.5 text-[13px] font-500 text-gray-500 hover:text-navy-900 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {s.label}
            </a>
          ))}
          <form action={logout} className="ml-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-500 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Abmelden
            </button>
          </form>
        </nav>

        {/* Mobile: Toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="sm:hidden p-2 -mr-2 rounded-lg hover:bg-gray-50 transition-colors"
          aria-label="Menü"
        >
          {open ? (
            <X className="w-5 h-5 text-navy-900" />
          ) : (
            <Menu className="w-5 h-5 text-navy-900" />
          )}
        </button>
      </div>

      {/* Mobile-Menü */}
      {open && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-5 py-3 space-y-1">
          {SECTIONS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 text-sm font-500 text-gray-600 hover:text-navy-900 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {s.label}
            </a>
          ))}
          <form action={logout} className="pt-1">
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-500 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Abmelden
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
