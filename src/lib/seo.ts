/**
 * Die öffentliche Adresse der Seite.
 *
 * Sie stand bisher an fünf Stellen im Quelltext, jedes Mal als
 * `process.env.NEXT_PUBLIC_APP_URL ?? "https://privatklavierunterricht.ch"`.
 * Solange alle fünf denselben Wert meinen, fällt das nicht auf. Beim Umzug
 * fällt es auf: Ist die Variable auf Vercel nicht gesetzt, zeigen Mail-Links
 * und Sitemap trotzdem irgendwohin, statt zu scheitern, und niemand merkt es,
 * bis ein Schüler auf einen toten Link klickt.
 *
 * Der Vorgabewert bleibt deshalb bewusst die echte Domain: Ein vergessener
 * Eintrag darf keine kaputten Links erzeugen. Wer lokal etwas anderes will,
 * setzt `NEXT_PUBLIC_APP_URL`.
 */
export const BASIS_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  "https://privatklavierunterricht.ch";
