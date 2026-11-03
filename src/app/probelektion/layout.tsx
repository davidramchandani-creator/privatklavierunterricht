import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ladePlatzstatus } from "@/lib/platzstatus-server";

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
    "Eine kostenlose Probelektion in meinem Studio in Neftenbach. Ohne Verpflichtung, ohne Vorkenntnisse, ohne eigenes Klavier nötig.",
  alternates: { canonical: "/probelektion" },
  openGraph: {
    title: "Probelektion buchen — kostenlos und unverbindlich",
    description:
      "Eine kostenlose Probelektion in meinem Studio in Neftenbach. Ohne Verpflichtung, ohne Vorkenntnisse.",
    url: "/probelektion",
  },
};

/**
 * Ist kein fester Platz mehr frei, führt die Probelektion zur Warteliste.
 *
 * Eine Probelektion, nach der es keinen Platz gibt, weckt eine Erwartung,
 * die David nicht erfüllen kann (David, 3. November 2026: „ist alles voll,
 * wird das Anfrageformular zur Wartelisten-Anmeldung“).
 */
export default async function ProbelektionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const status = await ladePlatzstatus().catch(() => null);
  if (status?.stufe === "ausgebucht") redirect("/warteliste");
  return children;
}
