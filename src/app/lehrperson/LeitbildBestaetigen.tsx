"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leitbildBestaetigen } from "./actions";

export default function LeitbildBestaetigen({ versionId }: { versionId: string }) {
  const [gelesen, setGelesen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  return (
    <div className="space-y-3 pt-2 border-t border-[#EAECEF]">
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={gelesen} onChange={(e) => setGelesen(e.target.checked)} className="mt-0.5 w-4 h-4" />
        Ich habe das Leitbild gelesen und halte mich daran.
      </label>
      <Button
        disabled={!gelesen || isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await leitbildBestaetigen(versionId);
            if ("error" in r && r.error) setFehler(r.error);
          })
        }
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Bestätigen"}
      </Button>
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
