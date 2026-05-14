"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Music, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/app/auth/actions";

export default function PasswortVergessenPage() {
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await requestPasswordReset(formData);
      setSent(true);
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-[#3730A3] hover:opacity-80 transition-opacity">
            <span className="w-10 h-10 rounded-xl bg-[#3730A3] flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </span>
            <span className="font-800 text-xl">David</span>
          </Link>
          <h1 className="mt-6 text-2xl font-800 text-[#3730A3]">Passwort zurücksetzen</h1>
          <p className="text-gray-500 text-sm mt-1">Wir schicken dir einen Link per E-Mail</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <p className="font-600 text-gray-900">E-Mail gesendet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Falls ein Konto mit dieser Adresse existiert, erhältst du in wenigen Minuten einen Link zum Zurücksetzen.
                </p>
              </div>
              <Link href="/auth/login" className="block text-sm text-[#3730A3] hover:underline font-500 mt-2">
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-Mail-Adresse</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="deine@email.ch"
                  required
                  autoComplete="email"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Senden…</>
                ) : (
                  "Reset-Link senden"
                )}
              </Button>

              <p className="text-center text-sm text-gray-500">
                <Link href="/auth/login" className="text-[#3730A3] hover:underline">
                  Zurück zur Anmeldung
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
