"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { planGroupSessions } from "../../../actions";

const selectClass =
  "flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function SessionPlanForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await planGroupSessions(courseId, fd);
      if (result && "error" in result) {
        setError(result.error ?? "Fehler");
      } else if (result && "created" in result) {
        const { created, skipped } = result;
        setMessage(
          `${created} Session${created !== 1 ? "s" : ""} erstellt` +
            (skipped > 0 ? ` · ${skipped} übersprungen (belegt/ungültig)` : "")
        );
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-gray-400 leading-relaxed">
        Lege fest, wann und wie oft der Kurs stattfindet. Termine ausserhalb deiner
        Verfügbarkeit, belegte oder vergangene Zeiten werden automatisch übersprungen.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-600 text-gray-600 mb-1">Erster Termin</label>
          <Input name="date" type="date" required />
        </div>
        <div>
          <label className="block text-xs font-600 text-gray-600 mb-1">Uhrzeit</label>
          <Input name="time" type="time" step={900} defaultValue="16:30" required />
        </div>
        <div>
          <label className="block text-xs font-600 text-gray-600 mb-1">Anzahl Termine</label>
          <Input name="count" type="number" min={1} max={52} defaultValue={1} />
        </div>
        <div>
          <label className="block text-xs font-600 text-gray-600 mb-1">Wiederholung</label>
          <select name="interval_days" className={selectClass} defaultValue="7">
            <option value="7">Wöchentlich</option>
            <option value="14">Alle 2 Wochen</option>
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {message && (
        <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{message}</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Wird geplant…
          </>
        ) : (
          <>
            <CalendarPlus className="w-4 h-4" />
            Termine planen
          </>
        )}
      </Button>
    </form>
  );
}
