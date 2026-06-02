"use client";

import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Music, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/app/auth/actions";

const urlErrorMessages: Record<string, string> = {
  link_ungueltig: "Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
  not_authenticated: "Du musst angemeldet sein, um diese Seite aufzurufen.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="deine@email.ch"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Passwort</Label>
            <Link
              href="/auth/passwort-vergessen"
              className="text-xs text-[#1C244B] hover:underline"
            >
              Passwort vergessen?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {(urlError || error) && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error ?? urlErrorMessages[urlError!] ?? "Ein Fehler ist aufgetreten."}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Anmelden…
            </>
          ) : (
            "Anmelden"
          )}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-[#1C244B] hover:opacity-80 transition-opacity">
            <span className="w-10 h-10 rounded-xl bg-[#1C244B] flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </span>
            <span className="font-800 text-xl">David</span>
          </Link>
          <h1 className="mt-6 text-2xl font-800 text-[#1C244B]">Willkommen zurück</h1>
          <p className="text-gray-500 text-sm mt-1">Melde dich mit deinem Schülerkonto an</p>
        </div>

        <Suspense fallback={<div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 h-64" />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-sm text-gray-500 mt-6">
          Noch kein Konto?{" "}
          <Link href="/probelektion" className="text-[#1C244B] font-600 hover:underline">
            Probelektion anfragen
          </Link>
        </p>
      </div>
    </div>
  );
}
