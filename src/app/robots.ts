import type { MetadataRoute } from "next";
import { BASIS_URL } from "@/lib/seo";

/**
 * Ohne diese Datei liefert die Seite keine robots.txt, und Suchmaschinen
 * bekommen keinen Hinweis auf die Sitemap. Beim Umzug von einer bestehenden,
 * indexierten Website ist das keine Kleinigkeit: Google muss möglichst
 * schnell merken, dass sich die Adressen geändert haben.
 *
 * Gesperrt wird alles, was hinter der Anmeldung liegt. Nicht als Schutz,
 * den leistet die Middleware, sondern damit Suchergebnisse nicht auf
 * Loginseiten zeigen.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/schueler",
        "/auth",
        "/api",
        "/offline",
        // Persönliche Einstellungsseite hinter dem Login. Sie fehlte hier,
        // obwohl die Middleware sie schützt — ohne Eintrag landet in den
        // Suchergebnissen irgendwann eine Adresse, die jeden Besucher auf
        // die Anmeldung wirft.
        "/benachrichtigungen",
        // Der Bewertungslink enthält einen persönlichen Token.
        "/bewerten",
      ],
    },
    sitemap: `${BASIS_URL}/sitemap.xml`,
    host: BASIS_URL,
  };
}
