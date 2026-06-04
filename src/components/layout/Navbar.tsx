"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "./Logo";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Secret admin click counter
  const adminClickCount = useRef(0);
  const adminClickTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // getSession() liest die Session aus dem Cookie (schnell, kein Roundtrip)
    // – verhindert das Flackern von „Anmelden", obwohl man eingeloggt ist.
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoaded(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoaded(true);
    });
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
          ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-[#EAECEF]"
          : "bg-white/80 backdrop-blur-md border-b border-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center hover:opacity-80 transition-opacity text-navy-900"
          onClick={handleAdminSecret}
          aria-label="Startseite"
        >
          <Logo className="h-9 w-auto" withText textClassName="hidden sm:inline text-base" />
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-500 text-gray-600 hover:text-navy-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          {!loaded ? (
            <div className="w-44 h-9 rounded-lg bg-gray-100 animate-pulse" />
          ) : user ? (
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
          className="md:hidden p-2 rounded-lg hover:bg-surface transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menü"
        >
          {menuOpen ? (
            <X className="w-5 h-5 text-navy-900" />
          ) : (
            <Menu className="w-5 h-5 text-navy-900" />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-[#EAECEF] px-4 py-4 space-y-3 shadow-lg">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block text-sm font-500 text-gray-700 py-2 hover:text-navy-900 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 space-y-2">
            {loaded && (user ? (
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
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
