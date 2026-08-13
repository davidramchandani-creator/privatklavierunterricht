"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { gehoertZu } from "@/lib/pfad";

/**
 * Entscheidet kontextabhängig, welche Navigation gerendert wird:
 * - Öffentliche/Marketing-Seiten → globale Navbar + Footer
 * - App-Bereiche (Portal, Admin) → KEINE Marketing-Chrome; diese Bereiche
 *   bringen ihre eigene, kontextuelle Navigation mit.
 *
 * Behebt das doppelte-Navigation-Problem (Marketing-Navbar überlagerte
 * vorher Portal-Header und Admin-Sidebar).
 */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isApp =
    gehoertZu(pathname, "/admin") ||
    gehoertZu(pathname, "/schueler") ||
    gehoertZu(pathname, "/auth") ||
    gehoertZu(pathname, "/probelektion");

  if (isApp) {
    return <div className="flex-1">{children}</div>;
  }

  return (
    <>
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </>
  );
}
