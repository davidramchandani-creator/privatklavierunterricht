"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteSchueler } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NeuenSchuelerPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await inviteSchueler(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <h2 className="text-xl font-700 text-gray-900">Schüler eingeladen!</h2>
          <p className="text-sm text-gray-500">
            Die Einladungs-E-Mail wurde gesendet. Der Schüler kann sich damit
            registrieren und sein Passwort setzen.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => setSuccess(false)}>
              Weiteren einladen
            </Button>
            <Button onClick={() => router.push("/admin/schueler")}>
              Zur Übersicht
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/schueler"
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-800 text-[#1C244B]">Neuer Schüler</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-500 text-gray-700">
                Vorname <span className="text-red-500">*</span>
              </label>
              <Input name="vorname" placeholder="Max" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-500 text-gray-700">
                Nachname <span className="text-red-500">*</span>
              </label>
              <Input name="nachname" placeholder="Mustermann" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-500 text-gray-700">
              E-Mail <span className="text-red-500">*</span>
            </label>
            <Input
              name="email"
              type="email"
              placeholder="max@beispiel.ch"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-500 text-gray-700">Telefon</label>
            <Input name="telefon" placeholder="+41 79 123 45 67" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-500 text-gray-700">Adresse</label>
            <Input name="adresse" placeholder="Musterstrasse 1, 8001 Zürich" />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Einladung senden…
              </>
            ) : (
              "Einladungs-E-Mail senden"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
