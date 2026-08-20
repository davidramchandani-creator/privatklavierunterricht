"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import {
  paketArchivieren,
  paketLoeschen,
  paketWiederherstellen,
} from "@/app/admin/actions";

/**
 * Archivieren, wiederherstellen, löschen.
 *
 * Zwei Wege, weil sie Unterschiedliches bedeuten. **Archivieren** räumt nur
 * die Ansicht auf; das Paket bleibt mit allem, was daran hängt. **Löschen**
 * entfernt es wirklich und nimmt den Zahlungsplan mit — deshalb weist der
 * Server es zurück, sobald je eine Rechnung dazu gestellt wurde.
 *
 * Der Löschknopf steht bewusst blass daneben und nicht als roter Hauptknopf:
 * Archivieren ist in fast allen Fällen das Richtige.
 */
export default function PaketAufraeumen({
  packageId,
  archiviert,
}: {
  packageId: string;
  archiviert: boolean;
}) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function lauf(fn: () => Promise<{ error?: string }>) {
    setFehler(null);
    starte(async () => {
      const res = await fn();
      if (res?.error) {
        setFehler(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {archiviert ? (
          <button
            type="button"
            title="Wieder einblenden"
            disabled={laeuft}
            onClick={() => lauf(() => paketWiederherstellen(packageId))}
            className="press p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {laeuft ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArchiveRestore className="w-4 h-4" />
            )}
          </button>
        ) : (
          <button
            type="button"
            title="Archivieren, blendet es nur aus"
            disabled={laeuft}
            onClick={() => lauf(() => paketArchivieren(packageId))}
            className="press p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {laeuft ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
          </button>
        )}

        <button
          type="button"
          title="Endgültig löschen"
          disabled={laeuft}
          onClick={() => {
            if (
              !confirm(
                "Dieses Paket endgültig löschen?\n\nDas geht nur, solange keine Rechnung und keine Termine daran hängen. Sonst hilft nur Archivieren."
              )
            )
              return;
            lauf(() => paketLoeschen(packageId));
          }}
          className="press p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {fehler && (
        <p className="text-xs text-red-600 mt-1 max-w-xs leading-snug">{fehler}</p>
      )}
    </>
  );
}
