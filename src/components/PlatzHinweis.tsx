import Link from "next/link";
import { ladePlatzstatus } from "@/lib/platzstatus-server";
import { platzText, wartendeText, type Platzstatus } from "@/lib/platzstatus";

/**
 * Hinweis auf freie Plätze, aus Davids Zeitfenstern gerechnet.
 *
 * Bei vielen freien Plätzen steht nichts da: Ein Hinweis wie „noch 12
 * Plätze frei“ hilft niemandem. Erst wenn es knapp wird oder alles voll
 * ist, erscheint er. Ist alles voll, führt er zur Warteliste.
 */
export default async function PlatzHinweis({
  hell = false,
  status: vorgegeben,
}: {
  /** Auf dunklem Hintergrund. */
  hell?: boolean;
  status?: Platzstatus;
}) {
  const status = vorgegeben ?? (await ladePlatzstatus().catch(() => null));
  if (!status) return null;
  const text = platzText(status);
  if (!text) return null;

  const ausgebucht = status.stufe === "ausgebucht";
  const wartende = wartendeText(status.wartende);

  const farbe = hell
    ? "bg-white/10 border-white/20 text-white"
    : ausgebucht
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-amber-50 border-amber-200 text-amber-800";
  const punkt = ausgebucht ? "bg-red-500" : "bg-amber-500";

  const inhalt = (
    <>
      <span className={`w-2 h-2 rounded-full ${punkt} animate-pulse`} />
      <span className="text-sm font-600">{text}</span>
      {wartende && <span className="text-xs opacity-70">· {wartende}</span>}
    </>
  );

  const klasse = `inline-flex flex-wrap items-center gap-2 border rounded-full px-4 py-1.5 ${farbe}`;

  return ausgebucht ? (
    <Link href="/warteliste" className={`${klasse} hover:-translate-y-px transition-transform`}>
      {inhalt}
    </Link>
  ) : (
    <span className={klasse}>{inhalt}</span>
  );
}
