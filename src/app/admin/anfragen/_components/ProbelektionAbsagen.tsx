"use client";

import { useTransition } from "react";
import { probelektionAbsagen } from "../actions";

export default function ProbelektionAbsagen({ id }: { id: string }) {
  const [laeuft, starte] = useTransition();
  return (
    <button
      type="button"
      disabled={laeuft}
      onClick={() => {
        if (!confirm("Probelektion absagen? Die Zeit wird wieder frei. Es geht keine Mail raus.")) return;
        starte(async () => {
          await probelektionAbsagen(id);
        });
      }}
      className="text-xs font-500 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
    >
      Absagen
    </button>
  );
}
