"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Mail, MapPin, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitKontakt } from "./actions";

export default function KontaktPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await submitKontakt(formData);
      if (result?.error) setError(result.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center px-4 py-24">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#EAECEF] p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-800 text-navy-900">Nachricht gesendet</h1>
          <p className="text-gray-600 leading-relaxed">
            Danke! Ich habe deine Nachricht erhalten und melde mich so bald wie
            möglich bei dir. Eine Bestätigung ist in deinem Postfach.
          </p>
          <Link href="/">
            <Button variant="outline" className="mt-2">Zur Startseite</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <section className="bg-navy-900 pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-white space-y-4">
          <h1 className="text-3xl sm:text-4xl font-800">Kontaktiere mich</h1>
          <p className="text-white/70 text-lg">
            Fragen zum Unterricht, zu den Paketen oder etwas ganz anderes?
            Schreib mir, ich antworte persönlich.
          </p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto grid md:grid-cols-[1fr_260px] gap-10">
          {/* Formular */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="vorname">Vorname *</Label>
                <Input id="vorname" name="vorname" required placeholder="Anna" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nachname">Nachname *</Label>
                <Input id="nachname" name="nachname" required placeholder="Müller" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">E-Mail *</Label>
              <Input id="email" name="email" type="email" required placeholder="anna@beispiel.ch" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="telefon">Telefon (optional)</Label>
                <Input id="telefon" name="telefon" type="tel" placeholder="079 123 45 67" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="betreff">Betreff (optional)</Label>
                <Input id="betreff" name="betreff" placeholder="Frage zum 10er-Paket" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nachricht">Nachricht *</Label>
              <textarea
                id="nachricht"
                name="nachricht"
                required
                rows={6}
                maxLength={5000}
                placeholder="Worum geht's?"
                className="w-full rounded-xl border border-[#EAECEF] bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900/30 resize-y"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Wird gesendet …
                </>
              ) : (
                "Nachricht senden"
              )}
            </Button>

            <p className="text-xs text-gray-400 leading-relaxed">
              Deine Angaben nutze ich ausschliesslich, um dir zu antworten.
              Mehr dazu in der <Link href="/datenschutz" className="underline">Datenschutzerklärung</Link>.
            </p>
          </form>

          {/* Direktkontakt */}
          <aside className="space-y-4">
            <div className="bg-surface rounded-2xl border border-[#EAECEF] p-5 space-y-4">
              <p className="text-sm font-700 text-navy-900">Direkt erreichen</p>
              <a
                href="mailto:david.privatklavierunterricht@gmail.com"
                className="flex items-start gap-3 text-sm text-gray-600 hover:text-navy-900 transition-colors"
              >
                <Mail className="w-4 h-4 mt-0.5 text-navy-600 flex-shrink-0" />
                <span className="break-all">david.privatklavierunterricht@gmail.com</span>
              </a>
              <div className="flex items-start gap-3 text-sm text-gray-600">
                <MapPin className="w-4 h-4 mt-0.5 text-navy-600 flex-shrink-0" />
                <span>
                  Neftenbach und Umgebung
                  <br />
                  <span className="text-gray-400 text-xs">Unterricht bei dir zuhause</span>
                </span>
              </div>
            </div>

            <div className="bg-navy-900 rounded-2xl p-5 text-white space-y-3">
              <p className="text-sm font-700">Lieber gleich ausprobieren?</p>
              <p className="text-white/70 text-sm leading-relaxed">
                Die Probelektion ist kostenlos und unverbindlich.
              </p>
              <Link href="/probelektion">
                <Button size="sm" className="bg-white text-navy-900 hover:bg-gray-100 font-700 w-full">
                  Probelektion buchen
                </Button>
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
