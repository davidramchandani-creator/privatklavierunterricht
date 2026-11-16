"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "./Logo";
import { createClient } from "@/lib/supabase/client";
import { HAUPTNAVIGATION, istAktiv, type NavBereich } from "@/lib/navigation";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const pfad = usePathname() ?? "/";
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Welches Klappmenü am Desktop offen ist (Label des Bereichs).
  const [offen, setOffen] = useState<string | null>(null);
  // Welcher Bereich im Handy-Menü aufgeklappt ist.
  const [mobilOffen, setMobilOffen] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  // Secret admin click counter
  const adminClickCount = useRef(0);
  const adminClickTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // getSession() liest die Session aus dem Cookie (schnell, kein Roundtrip)
    //, verhindert das Flackern von „Anmelden", obwohl man eingeloggt ist.
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

  // Klappmenü schliessen: Klick daneben oder Escape.
  useEffect(() => {
    if (!offen) return;
    const klick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOffen(null);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(null);
    };
    document.addEventListener("mousedown", klick);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("mousedown", klick);
      document.removeEventListener("keydown", taste);
    };
  }, [offen]);

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

  // Angemeldete Schüler brauchen die Werbe-Navigation nicht, für sie zählt
  // das Portal. Wie bisher bleibt nur „Über mich".
  const bereiche: NavBereich[] = user
    ? [{ label: "Über mich", href: "/ueber-mich" }]
    : HAUPTNAVIGATION;

  const schliessen = () => {
    setOffen(null);
    setMenuOpen(false);
    setMobilOffen(null);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || menuOpen
          ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-[#EAECEF]"
          : "bg-white/80 backdrop-blur-md border-b border-transparent"
      }`}
    >
      <nav
        ref={navRef}
        aria-label="Hauptnavigation"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center hover:opacity-80 transition-opacity text-navy-900 flex-shrink-0"
          onClick={handleAdminSecret}
          aria-label="Startseite"
        >
          {/* Am Handy ohne Zusatz: Er wäre dort zu klein zum Lesen. */}
          <Logo className="h-7 w-auto sm:hidden" />
          <Logo withTagline className="hidden sm:block h-10 w-auto" />
        </Link>

        {/* Desktop: Bereiche, zwei davon mit Klappmenü */}
        <ul className="hidden lg:flex items-center gap-1">
          {bereiche.map((b) => {
            const aktiv = istAktiv(pfad, b);
            const linkKlasse = `inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-500 transition-colors ${
              aktiv ? "text-navy-900" : "text-gray-600 hover:text-navy-900"
            }`;
            if (!b.kinder?.length) {
              return (
                <li key={b.label}>
                  <Link href={b.href} className={linkKlasse} aria-current={aktiv ? "page" : undefined} onClick={schliessen}>
                    {b.label}
                    {aktiv && <AktivPunkt />}
                  </Link>
                </li>
              );
            }
            const istOffen = offen === b.label;
            return (
              <li
                key={b.label}
                className="relative"
                onMouseEnter={() => setOffen(b.label)}
                onMouseLeave={() => setOffen((o) => (o === b.label ? null : o))}
              >
                <button
                  type="button"
                  className={linkKlasse}
                  aria-expanded={istOffen}
                  aria-haspopup="true"
                  onClick={() => setOffen(istOffen ? null : b.label)}
                >
                  {b.label}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${istOffen ? "rotate-180" : ""}`}
                  />
                  {aktiv && <AktivPunkt />}
                </button>
                {/* Brücke über die Lücke, damit das Menü beim Hinüberfahren offen bleibt. */}
                {istOffen && (
                  <div className="absolute left-0 top-full pt-2 w-72">
                    <div className="animate-enter-up rounded-2xl border border-[#EAECEF] bg-white shadow-xl shadow-navy-900/10 p-2">
                      {b.kinder.map((k) => (
                        <Link
                          key={k.href}
                          href={k.href}
                          onClick={schliessen}
                          className="block rounded-xl px-3 py-2.5 hover:bg-surface transition-colors"
                        >
                          <span className="block text-sm font-600 text-navy-900">{k.label}</span>
                          {k.beschreibung && (
                            <span className="block text-xs text-gray-500 mt-0.5">{k.beschreibung}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
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

        {/* Handy und Tablet: Menüknopf */}
        <button
          className="lg:hidden p-2 rounded-lg hover:bg-surface transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Menü schliessen" : "Menü öffnen"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <X className="w-5 h-5 text-navy-900" />
          ) : (
            <Menu className="w-5 h-5 text-navy-900" />
          )}
        </button>
      </nav>

      {/* Handy-Menü: Bereiche mit Unterpunkten klappen auf */}
      {menuOpen && (
        <div className="lg:hidden animate-enter-up bg-white border-t border-[#EAECEF] px-4 pt-2 pb-5 shadow-lg max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <ul className="divide-y divide-gray-100">
            {bereiche.map((b) => {
              const aktiv = istAktiv(pfad, b);
              if (!b.kinder?.length) {
                return (
                  <li key={b.label}>
                    <Link
                      href={b.href}
                      onClick={schliessen}
                      className={`flex items-center justify-between py-3.5 text-base font-600 ${
                        aktiv ? "text-navy-900" : "text-gray-700"
                      }`}
                    >
                      {b.label}
                      {aktiv && <AktivPunkt />}
                    </Link>
                  </li>
                );
              }
              const auf = mobilOffen === b.label;
              return (
                <li key={b.label}>
                  <button
                    type="button"
                    onClick={() => setMobilOffen(auf ? null : b.label)}
                    aria-expanded={auf}
                    className={`w-full flex items-center justify-between py-3.5 text-base font-600 ${
                      aktiv ? "text-navy-900" : "text-gray-700"
                    }`}
                  >
                    {b.label}
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${auf ? "rotate-180" : ""}`} />
                  </button>
                  {auf && (
                    <ul className="pb-3 pl-3 space-y-1 animate-enter-up">
                      {b.kinder.map((k) => (
                        <li key={k.href}>
                          <Link
                            href={k.href}
                            onClick={schliessen}
                            className="block rounded-xl px-3 py-2 hover:bg-surface transition-colors"
                          >
                            <span className="block text-sm font-600 text-navy-900">{k.label}</span>
                            {k.beschreibung && (
                              <span className="block text-xs text-gray-500">{k.beschreibung}</span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="pt-4 space-y-2">
            {loaded &&
              (user ? (
                <>
                  <Link href="/schueler/portal" onClick={schliessen}>
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
                  <Link href="/probelektion" onClick={schliessen}>
                    <Button className="w-full">Probelektion buchen</Button>
                  </Link>
                  <Link href="/auth/login" onClick={schliessen}>
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

/** Kleiner Punkt unter dem Bereich, in dem man gerade ist. */
function AktivPunkt() {
  return <span aria-hidden className="ml-1 w-1.5 h-1.5 rounded-full bg-navy-900" />;
}
