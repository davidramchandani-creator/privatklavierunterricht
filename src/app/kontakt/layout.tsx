import type { Metadata } from "next";

/**
 * Metadaten für die Kontaktseite. Eigenes Layout, weil die Seite selbst ein
 * Formular mit Zustand ist und darum `"use client"` trägt.
 */
export const metadata: Metadata = {
  title: "Kontakt — Fragen zum Klavierunterricht",
  description:
    "Fragen zum Klavierunterricht in Neftenbach und Umgebung? Schreib mir, ich antworte innerhalb von zwei Tagen.",
  alternates: { canonical: "/kontakt" },
  openGraph: {
    title: "Kontakt — Fragen zum Klavierunterricht",
    description: "Schreib mir, ich antworte innerhalb von zwei Tagen.",
    url: "/kontakt",
  },
};

export default function KontaktLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
