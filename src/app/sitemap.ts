import type { MetadataRoute } from "next";
import { BASIS_URL } from "@/lib/seo";

/**
 * Die öffentlichen Seiten, in der Reihenfolge ihrer Wichtigkeit.
 *
 * Bewusst von Hand gepflegt und nicht aus dem Dateisystem erzeugt: Ein
 * automatischer Durchlauf über `src/app` nähme das Schülerportal, den
 * Adminbereich und die Offline-Seite mit. Die gehören nicht in eine Sitemap,
 * und ein Fehler dabei fällt niemandem auf, weil eine Sitemap niemand liest.
 *
 * Beim Hinzufügen einer öffentlichen Seite bitte hier ergänzen.
 */
const SEITEN: { pfad: string; prioritaet: number; frequenz: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { pfad: "/", prioritaet: 1.0, frequenz: "monthly" },
  { pfad: "/probelektion", prioritaet: 0.9, frequenz: "monthly" },
  { pfad: "/preise", prioritaet: 0.8, frequenz: "monthly" },
  { pfad: "/ueber-mich", prioritaet: 0.7, frequenz: "yearly" },
  { pfad: "/faq", prioritaet: 0.7, frequenz: "monthly" },
  { pfad: "/kontakt", prioritaet: 0.6, frequenz: "yearly" },
  { pfad: "/agb", prioritaet: 0.2, frequenz: "yearly" },
  { pfad: "/datenschutz", prioritaet: 0.2, frequenz: "yearly" },
  { pfad: "/impressum", prioritaet: 0.2, frequenz: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const heute = new Date();
  return SEITEN.map(({ pfad, prioritaet, frequenz }) => ({
    url: `${BASIS_URL}${pfad}`,
    lastModified: heute,
    changeFrequency: frequenz,
    priority: prioritaet,
  }));
}
