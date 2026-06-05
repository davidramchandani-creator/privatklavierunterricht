"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createGroupCourse, updateGroupCourse } from "../../actions";

type PriceTier = { persons: number; price: number };

type CourseData = {
  id?: string;
  title?: string;
  description?: string | null;
  max_participants?: number;
  long_duration_from?: number;
  short_minutes?: number;
  long_minutes?: number;
  price_tiers?: Record<string, number>;
};

function tiersToList(tiers: Record<string, number>): PriceTier[] {
  return Object.entries(tiers)
    .map(([k, v]) => ({ persons: Number(k), price: v }))
    .sort((a, b) => a.persons - b.persons);
}

function listToTiers(list: PriceTier[]): Record<string, number> {
  const obj: Record<string, number> = {};
  for (const t of list) {
    if (t.persons > 0 && t.price >= 0) obj[String(t.persons)] = t.price;
  }
  return obj;
}

export default function KursForm({
  course,
  onCancel,
}: {
  course?: CourseData;
  onCancel?: () => void;
}) {
  const isEdit = !!course?.id;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [tiers, setTiers] = useState<PriceTier[]>(
    course?.price_tiers
      ? tiersToList(course.price_tiers)
      : [{ persons: 1, price: 70 }, { persons: 2, price: 55 }, { persons: 3, price: 45 }]
  );

  function addTier() {
    const last = tiers[tiers.length - 1];
    setTiers([...tiers, { persons: (last?.persons ?? 0) + 1, price: last?.price ?? 40 }]);
  }

  function removeTier(i: number) {
    setTiers(tiers.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("price_tiers", JSON.stringify(listToTiers(tiers)));
    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateGroupCourse(course!.id!, fd)
        : await createGroupCourse(fd);
      if (result && "error" in result) {
        setError(result.error ?? "Fehler");
      } else {
        setSuccess(true);
        if (!isEdit) {
          router.push("/admin/gruppenkurse");
        } else {
          router.refresh();
          onCancel?.();
        }
      }
    });
  }

  if (success && !isEdit) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-600 text-gray-600 mb-1">Kursname</label>
        <Input
          name="title"
          defaultValue={course?.title ?? ""}
          placeholder="z.B. Klavier für Anfänger"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-600 text-gray-600 mb-1">Beschreibung (optional)</label>
        <textarea
          name="description"
          defaultValue={course?.description ?? ""}
          placeholder="Kurze Beschreibung des Kurses…"
          rows={2}
          className="flex w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-600 text-gray-600 mb-1">Max. Teilnehmer</label>
          <Input
            name="max_participants"
            type="number"
            min={1}
            max={20}
            defaultValue={course?.max_participants ?? 4}
          />
        </div>
        <div>
          <label className="block text-xs font-600 text-gray-600 mb-1">90 Min. ab Teilnehmer</label>
          <Input
            name="long_duration_from"
            type="number"
            min={2}
            max={10}
            defaultValue={course?.long_duration_from ?? 3}
          />
        </div>
        <div>
          <label className="block text-xs font-600 text-gray-600 mb-1">Kurzdauer (Min.)</label>
          <Input
            name="short_minutes"
            type="number"
            min={30}
            max={120}
            defaultValue={course?.short_minutes ?? 45}
          />
        </div>
        <div>
          <label className="block text-xs font-600 text-gray-600 mb-1">Langdauer (Min.)</label>
          <Input
            name="long_minutes"
            type="number"
            min={60}
            max={180}
            defaultValue={course?.long_minutes ?? 90}
          />
        </div>
      </div>

      {/* Price tiers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-600 text-gray-600">Preis/Person nach Teilnehmerzahl</label>
          <button
            type="button"
            onClick={addTier}
            className="text-[11px] font-600 text-[#1C244B] flex items-center gap-1 hover:underline"
          >
            <Plus className="w-3 h-3" /> Tier
          </button>
        </div>
        <div className="space-y-2">
          {tiers.map((tier, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20 flex-shrink-0">ab Pers. {i + 1}</span>
              <Input
                type="number"
                min={1}
                value={tier.persons}
                onChange={(e) => {
                  const updated = [...tiers];
                  updated[i] = { ...updated[i], persons: Number(e.target.value) };
                  setTiers(updated);
                }}
                className="w-20"
              />
              <span className="text-xs text-gray-400">CHF</span>
              <Input
                type="number"
                min={0}
                step={0.05}
                value={tier.price}
                onChange={(e) => {
                  const updated = [...tiers];
                  updated[i] = { ...updated[i], price: Number(e.target.value) };
                  setTiers(updated);
                }}
                className="w-24"
              />
              <button
                type="button"
                onClick={() => removeTier(i)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isEdit ? "Speichern…" : "Erstellen…"}
            </>
          ) : isEdit ? (
            "Speichern"
          ) : (
            "Kurs erstellen"
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Abbrechen
          </Button>
        )}
      </div>
    </form>
  );
}
