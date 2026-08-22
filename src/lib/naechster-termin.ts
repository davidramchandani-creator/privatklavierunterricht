import { cache } from "react";
import { getNextPublicSlot as _getNextPublicSlot } from "@/app/probelektion/actions";

/**
 * Ein Aufruf pro Anfrage, nicht zwei.
 *
 * Der Hero und die mitlaufende Buchungsleiste fragen beide nach dem
 * nächsten freien Termin. Ohne `cache()` lief die ganze
 * Verfügbarkeitsberechnung — vier Wochen Slots, Termine, Sperren — pro
 * Seitenaufruf zweimal. React entsorgt den Eintrag am Ende der Anfrage,
 * es bleibt also nichts über den Request hinaus hängen.
 */
const getNextPublicSlot = cache(_getNextPublicSlot);

/**
 * Nächsten freien Termin als lesbaren Text.
 *
 * Lag vorher als private Hilfsfunktion im Hero. Seit die mitlaufende
 * Buchungsleiste denselben Termin zeigt, braucht es eine Quelle statt zwei.
 * sonst driften die beiden Darstellungen irgendwann auseinander und die Seite
 * behauptet an zwei Stellen etwas Verschiedenes.
 */
export function formatSlot(iso: string): string {
  const d = new Date(iso);
  const tag = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "long",
  }).format(d);
  const datum = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    day: "numeric",
    month: "long",
  }).format(d);
  const zeit = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${tag}, ${datum} · ${zeit} Uhr`;
}

/** Kurzform für enge Stellen: „Di, 19. Aug · 18:30". */
export function formatSlotKurz(iso: string): string {
  const d = new Date(iso);
  const tag = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
  }).format(d);
  const datum = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    day: "numeric",
    month: "short",
  }).format(d);
  const zeit = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${tag}, ${datum} · ${zeit}`;
}

/**
 * Holt den nächsten freien Termin, ohne bei einem Fehler die Seite zu
 * gefährden. Fällt die Verfügbarkeit aus, steht dort „Auf Anfrage", der
 * Knopf bleibt in jedem Fall bedienbar. Jemanden wegen fehlender Termine
 * abzuweisen, verliert ihn endgültig.
 */
export async function naechsterTerminText(kurz = false): Promise<string | null> {
  try {
    const slot = await getNextPublicSlot();
    if (!slot) return null;
    return kurz ? formatSlotKurz(slot.beginn) : formatSlot(slot.beginn);
  } catch {
    return null;
  }
}
