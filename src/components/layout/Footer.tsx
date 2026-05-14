"use client";

import Link from "next/link";
import { Music, Mail } from "lucide-react";
import { useRef } from "react";

export default function Footer() {
  const adminClicks = useRef(0);
  const adminTimer = useRef<NodeJS.Timeout | null>(null);

  function handleAdminClick() {
    adminClicks.current += 1;
    if (adminTimer.current) clearTimeout(adminTimer.current);
    adminTimer.current = setTimeout(() => {
      adminClicks.current = 0;
    }, 2000);
    if (adminClicks.current >= 5) {
      adminClicks.current = 0;
      window.location.href = "/admin";
    }
  }

  return (
    <footer className="bg-[#3730A3] border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-full lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Music className="w-4 h-4 text-[#C9A84C]" />
              </span>
              <span className="font-700 text-white">David</span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              Individueller Klavierunterricht in Neftenbach und Umgebung.
              Ohne Schema F – mit Gefühl und Verstand.
            </p>
            <div className="flex gap-3 mt-4">
              <a
                href="mailto:david@privatklavierunterricht.ch"
                className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="E-Mail"
              >
                <Mail className="w-4 h-4 text-white/70" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-600 text-sm mb-4">Navigation</h4>
            <ul className="space-y-2.5">
              {[
                { href: "/ueber-mich", label: "Über mich" },
                { href: "/#angebote", label: "Angebote" },
                { href: "/#preise", label: "Preise" },
                { href: "/#probelektion", label: "Probelektion" },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-white/50 text-sm hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-600 text-sm mb-4">Konto</h4>
            <ul className="space-y-2.5">
              {[
                { href: "/auth/login", label: "Anmelden" },
                { href: "/schueler/portal", label: "Schülerportal" },
                { href: "/auth/register", label: "Registrieren" },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-white/50 text-sm hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-600 text-sm mb-4">Rechtliches</h4>
            <ul className="space-y-2.5">
              {[
                { href: "/agb", label: "AGB" },
                { href: "/datenschutz", label: "Datenschutz" },
                { href: "/impressum", label: "Impressum" },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-white/50 text-sm hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} David Ramchandani – Alle Rechte
            vorbehalten
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/agb"
              className="text-white/30 text-xs hover:text-white/60 transition-colors"
            >
              AGB
            </Link>
            {/* Geheimer Admin-Zugang: 5× schnell klicken */}
            <button
              onClick={handleAdminClick}
              className="text-white/30 text-xs hover:text-white/60 transition-colors select-none"
              aria-label="Partner"
            >
              Partner
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
