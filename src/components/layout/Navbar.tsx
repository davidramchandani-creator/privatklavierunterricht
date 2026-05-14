"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Menu, X, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Secret admin click counter
  const adminClickCount = useRef(0);
  const adminClickTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleAdminSecret() {
    adminClickCount.current += 1;
    if (adminClickTimer.current) clearTimeout(adminClickTimer.current);
    adminClickTimer.current = setTimeout(() => {
      adminClickCount.current = 0;
    }, 2000);
    if (adminClickCount.current >= 5) {
      adminClickCount.current = 0;
      window.location.href = "/admin";
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const navLinks = user
    ? [{ href: "/ueber-mich", label: "Über mich" }]
    : [
        { href: "/ueber-mich", label: "Über mich" },
        { href: "/#angebote", label: "Angebote" },
        { href: "/#preise", label: "Preise" },
      ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100"
          : "bg-white/80 backdrop-blur-sm"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-800 text-[#3730A3] text-lg hover:opacity-80 transition-opacity"
          onClick={handleAdminSecret}
        >
          <span className="w-8 h-8 rounded-lg bg-[#3730A3] flex items-center justify-center">
            <Music className="w-4 h-4 text-white" />
          </span>
          <span className="hidden sm:block">David</span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-500 text-gray-600 hover:text-[#3730A3] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link href="/schueler/portal">
                <Button variant="outline" size="sm">
                  Mein Portal
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Abmelden
              </Button>
            </>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  Anmelden
                </Button>
              </Link>
              <Link href="/probelektion">
                <Button size="sm">Probelektion buchen</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menü"
        >
          {menuOpen ? (
            <X className="w-5 h-5 text-[#3730A3]" />
          ) : (
            <Menu className="w-5 h-5 text-[#3730A3]" />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3 shadow-lg">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block text-sm font-500 text-gray-700 py-2 hover:text-[#3730A3] transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 space-y-2">
            {user ? (
              <>
                <Link href="/schueler/portal" onClick={() => setMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Mein Portal
                  </Button>
                </Link>
                <Button variant="ghost" className="w-full" onClick={handleLogout}>
                  Abmelden
                </Button>
              </>
            ) : (
              <>
                <Link href="/probelektion" onClick={() => setMenuOpen(false)}>
                  <Button className="w-full">Probelektion buchen</Button>
                </Link>
                <Link href="/auth/login" onClick={() => setMenuOpen(false)}>
                  <Button variant="ghost" className="w-full">
                    Anmelden
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
