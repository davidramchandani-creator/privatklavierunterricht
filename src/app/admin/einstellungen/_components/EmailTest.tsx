"use client";

import { useState, useTransition } from "react";
import { Mail, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { sendTestEmail } from "@/app/admin/actions";

export default function EmailTest({ adminEmail }: { adminEmail: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success?: true; to?: string; error?: string } | null>(null);

  const handleTest = () => {
    setResult(null);
    startTransition(async () => {
      const res = await sendTestEmail();
      setResult(res);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-0.5">
          <p className="text-sm font-600 text-gray-700">Empfänger (ADMIN_EMAIL)</p>
          <p className="text-xs text-gray-500 font-mono">
            {adminEmail ?? (
              <span className="text-red-500">nicht gesetzt, bitte in Vercel-Env-Variablen hinterlegen</span>
            )}
          </p>
        </div>
        <button
          onClick={handleTest}
          disabled={isPending || !adminEmail}
          className="flex items-center gap-1.5 text-sm font-600 text-white bg-[#1C244B] hover:opacity-90 px-4 py-2 rounded-xl transition-opacity disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
          Test-E-Mail senden
        </button>
      </div>

      {result?.success && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-700">
            Test-E-Mail erfolgreich gesendet an <strong>{result.to}</strong>. Bitte prüfe auch den Spam-Ordner.
          </p>
        </div>
      )}

      {result?.error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-600 text-red-700">Versand fehlgeschlagen</p>
            <p className="text-xs text-red-600 mt-0.5 font-mono break-all">{result.error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
