"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, KeyRound } from "lucide-react";
import Logo from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { confirmEmailToken } from "@/app/auth/actions";

function ConfirmCard() {
  const params = useSearchParams();
  const tokenHash = params.get("token_hash") ?? "";
  const type = params.get("type") ?? "recovery";
  const next = params.get("next") ?? "/schueler/portal";

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const linkInvalid = !tokenHash;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmEmailToken(tokenHash, type, next);
      // Bei Erfolg leitet die Server-Action per redirect weiter, wir landen
      // hier nur im Fehlerfall.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#EAECEF] shadow-sm p-8 text-center">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-navy-900/5 flex items-center justify-center mb-5">
        <KeyRound className="w-6 h-6 text-navy-900" />
      </div>

      {linkInvalid ? (
        <>
          <p className="text-status-error text-sm">
            Dieser Link ist ungültig oder unvollständig. Bitte fordere einen neuen an.
          </p>
          <Link
            href="/auth/passwort-vergessen"
            className="inline-block mt-5 text-navy-900 font-600 hover:underline text-sm"
          >
            Neuen Link anfordern
          </Link>
        </>
      ) : (
        <>
          <p className="text-gray-600 text-sm mb-6">
            Klicke auf den Button, um fortzufahren und dein Passwort festzulegen.
          </p>

          {error && (
            <div className="bg-status-open/10 border border-status-open/30 text-status-error text-sm rounded-lg px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <Button onClick={handleConfirm} className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Einen Moment…
              </>
            ) : (
              "Fortfahren"
            )}
          </Button>
        </>
      )}
    </div>
  );
}

export default function BestaetigenPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-navy-900 hover:opacity-80 transition-opacity">
            <Logo className="h-9 w-auto" withText textClassName="text-lg" />
          </Link>
          <h1 className="mt-6 text-2xl font-800 text-navy-900 tracking-tight">Bestätigen</h1>
          <p className="text-gray-500 text-sm mt-1">Nur noch ein Schritt</p>
        </div>

        <Suspense fallback={<div className="bg-white rounded-2xl border border-[#EAECEF] shadow-sm p-8 h-48" />}>
          <ConfirmCard />
        </Suspense>
      </div>
    </div>
  );
}
