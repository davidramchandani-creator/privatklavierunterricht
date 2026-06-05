"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import Logo from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPassword } from "@/app/auth/actions";

function StrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["", "Schwach", "Mittel", "Gut", "Stark"];
  const colors = ["", "bg-status-open", "bg-status-pending", "bg-yellow-400", "bg-status-paid"];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? colors[score] : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-500 ${score < 2 ? "text-status-error" : score < 4 ? "text-amber-600" : "text-emerald-600"}`}>
        {labels[score]}
      </p>
    </div>
  );
}

export default function PasswortSetzenPage() {
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPasswordValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await setPassword(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-navy-900 hover:opacity-80 transition-opacity">
            <Logo className="h-9 w-auto" withText textClassName="text-lg" />
          </Link>
          <h1 className="mt-6 text-2xl font-800 text-navy-900 tracking-tight">Passwort festlegen</h1>
          <p className="text-gray-500 text-sm mt-1">Wähle ein sicheres Passwort für dein Konto</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAECEF] shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="password">Neues Passwort</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  placeholder="Mindestens 8 Zeichen"
                  required
                  minLength={8}
                  className="pr-11"
                  value={password}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  autoComplete="new-password"
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
              <StrengthBar password={password} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmation">Passwort bestätigen</Label>
              <div className="relative">
                <Input
                  id="confirmation"
                  name="confirmation"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Passwort wiederholen"
                  required
                  className="pr-11"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Anforderungen */}
            <ul className="space-y-1.5 text-xs text-gray-500">
              {[
                { check: password.length >= 8, label: "Mindestens 8 Zeichen" },
                { check: /[A-Z]/.test(password), label: "Ein Grossbuchstabe" },
                { check: /[0-9]/.test(password), label: "Eine Zahl" },
              ].map(({ check, label }) => (
                <li key={label} className={`flex items-center gap-2 transition-colors ${check ? "text-emerald-600" : ""}`}>
                  <CheckCircle2 className={`w-3.5 h-3.5 ${check ? "text-emerald-500" : "text-gray-300"}`} />
                  {label}
                </li>
              ))}
            </ul>

            {error && (
              <div className="bg-status-open/10 border border-status-open/30 text-status-error text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Speichern…</>
              ) : (
                "Passwort speichern"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
