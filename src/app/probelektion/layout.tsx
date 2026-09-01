import type { Metadata } from "next";

/**
 * Metadaten für die Probelektion.
 *
 * Sie stehen hier und nicht in `page.tsx`, weil diese Seite ein Formular mit
 * Zustand ist und darum `"use client"` trägt — und aus einer Client-Komponente
 * lässt sich `metadata` nicht exportieren. Ein Layout darüber ist der übliche
 * Weg und kostet nichts: Es rendert nur seine Kinder.
 *
 * Ohne diesen Eintrag erbte die Seite Titel und Beschreibung der Startseite.
 * Das ist ausgerechnet hier am teuersten: Die Probelektion ist die Seite, auf
 * der aus einem Besucher ein Schüler wird, und in den Suchergebnissen stand
 * derselbe Text wie überall sonst.
 */
export const metadata: Metadata = {
  title: "Probelektion buchen — kostenlos und unverbindlich",
  description:
    "Eine kostenlose Probelektion bei dir zu Hause in Neftenbach, Winterthur und Umgebung. Ohne Verpflichtung, ohne Vorkenntnisse, ohne eigenes Klavier nötig.",
  alternates: { canonical: "/probelektion" },
  openGraph: {
    title: "Probelektion buchen — kostenlos und unverbindlich",
    description:
      "Eine kostenlose Probelektion bei dir zu Hause. Ohne Verpflichtung, ohne Vorkenntnisse.",
    url: "/probelektion",
  },
};

export default function ProbelektionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
