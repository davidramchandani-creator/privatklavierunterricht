import type { NextConfig } from "next";

/**
 * Umleitungen von der alten WordPress-Seite.
 *
 * Ohne sie führt beim Umschalten jeder Link, den jemand gespeichert oder
 * weitergegeben hat, ins Leere: Lesezeichen, WhatsApp-Nachrichten an Eltern,
 * der Eintrag bei Google. Eine 404-Seite ist dabei das kleinere Problem. Das
 * grössere ist, dass Google die alten Adressen kennt und ohne Umleitung nicht
 * erfährt, wohin sie gewandert sind, sondern nur, dass es sie nicht mehr gibt.
 *
 * `permanent: true` sendet einen 301. Das ist der Status, der die Bewertung
 * einer Seite auf die neue Adresse überträgt. Er wird von Browsern allerdings
 * dauerhaft zwischengespeichert, was ihn schwer zu widerrufen macht — deshalb
 * stehen hier nur Ziele, die auch in einem Jahr noch stimmen.
 *
 * Die alten Adressen enden alle auf einen Schrägstrich. Next.js gleicht das
 * selbst ab, die Einträge stehen trotzdem ohne, weil `source` bereits normalisiert
 * verglichen wird.
 */
const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Seiten, die es weiterhin gibt, nur anders benannt
      { source: "/allgemeine-geschaeftsbedingungen", destination: "/agb", permanent: true },
      { source: "/kontaktiere-mich", destination: "/kontakt", permanent: true },
      { source: "/login", destination: "/auth/login", permanent: true },

      // Es gibt keine öffentliche Registrierung mehr: Konten legt der Admin an.
      // Ziel ist die Anmeldung, nicht die Startseite — wer hier landet, wollte
      // ein Konto, und auf der Loginseite steht, wie er eines bekommt.
      { source: "/register", destination: "/auth/login", permanent: true },

      // Drei alte Adressen führten zur Buchung. Sie enden jetzt alle an
      // derselben Stelle, weil es nur noch einen Einstieg gibt.
      { source: "/jetzt-buchen", destination: "/probelektion", permanent: true },
      { source: "/einzellektion-buchen", destination: "/probelektion", permanent: true },

      { source: "/admin-2-0", destination: "/admin", permanent: true },

      // Das Partnerprogramm der alten Seite fällt weg. Beide Adressen führen
      // deshalb dorthin, wo der Besucher am ehesten hinwollte: „/empfehlen"
      // war in der Navigation der Weg zur Probelektion und diente zugleich
      // dem Einlösen von Empfehlungscodes.
      //
      // Absichtlich `permanent: false`. Ein 301 bliebe in den Browsern der
      // bisherigen Partner dauerhaft hängen; käme das Programm zurück, kämen
      // genau die Leute nicht mehr hin, für die es gedacht ist.
      { source: "/empfehlen", destination: "/probelektion", permanent: false },
      { source: "/partner", destination: "/", permanent: false },

      // WordPress-Reste. Ohne diese Zeile bekommt jeder Angriffsversuch auf
      // /wp-login.php eine 404-Seite mit vollem Seitenaufbau serviert.
      { source: "/wp-admin/:pfad*", destination: "/", permanent: false },
      { source: "/wp-login.php", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
