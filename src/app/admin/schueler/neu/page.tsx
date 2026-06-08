"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteSchueler, createSchuelerDirekt } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, ArrowLeft, Copy, Check, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

type Mode = "invite" | "direct";
type SuccessInfo = { mode: "invite" } | { mode: "direct"; email: string; password: string };

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score =
    (password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
  const labels = ["Sehr schwach", "Schwach", "Mittel", "Stark", "Sehr stark"];
  const colors = ["bg-red-500", "bg-orange-400", "bg-amber-400", "bg-emerald-400", "bg-emerald-600"];
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? colors[score] : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <p className={`text-[11px] font-500 ${score <= 1 ? "text-red-500" : score <= 2 ? "text-amber-500" : "text-emerald-600"}`}>
        {labels[score]}
      </p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handle() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handle}
      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
      title="Kopieren"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function NeuenSchuelerPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [mode, setMode] = useState<Mode>("direct");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      if (mode === "invite") {
        const result = await inviteSchueler(formData);
        if (result?.error) setError(result.error);
        else setSuccess({ mode: "invite" });
      } else {
        const result = await createSchuelerDirekt(formData);
        if (result?.error) setError(result.error);
        else
          setSuccess({
            mode: "direct",
            email: formData.get("email") as string,
            password: formData.get("password") as string,
          });
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
          <h2 className="text-xl font-700 text-gray-900">
            {success.mode === "invite" ? "Schüler eingeladen!" : "Schüler angelegt!"}
          </h2>
          {success.mode === "invite" ? (
            <p className="text-sm text-gray-500">
              Die Einladungs-E-Mail wurde gesendet. Der Schüler kann sich damit registrieren.
            </p>
          ) : (
            <div className="text-left space-y-3">
              <p className="text-sm text-gray-500 text-center">
                Bitte Zugangsdaten sicher an den Schüler weitergeben:
              </p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-700 uppercase tracking-wide text-gray-400 mb-0.5">E-Mail</p>
                    <p className="text-sm font-600 text-gray-900">{success.email}</p>
                  </div>
                  <CopyButton text={success.email} />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-3">
                  <div>
                    <p className="text-[11px] font-700 uppercase tracking-wide text-gray-400 mb-0.5">Passwort</p>
                    <p className="text-sm font-600 text-gray-900 font-mono">{success.password}</p>
                  </div>
                  <CopyButton text={success.password} />
                </div>
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">
                  Das Passwort wird nicht erneut angezeigt. Bitte jetzt kopieren.
                </p>
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => { setSuccess(null); setPassword(""); }}>
              Weiteren anlegen
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

      {/* Mode-Toggle */}
      <div className="relative inline-flex rounded-xl bg-gray-100 p-1 w-full">
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-transform"
          style={{
            width: "calc(50% - 4px)",
            left: 4,
            transform: mode === "invite" ? "translateX(calc(100% + 4px))" : "translateX(0)",
            transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
            transitionDuration: "260ms",
          }}
        />
        {(["direct", "invite"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`relative z-10 flex-1 py-2 rounded-lg text-sm font-600 transition-colors ${
              mode === m ? "text-[#1C244B]" : "text-gray-500"
            }`}
          >
            {m === "direct" ? "Direkt anlegen" : "Per E-Mail einladen"}
          </button>
        ))}
      </div>

      {mode === "direct" && (
        <p className="text-xs text-gray-500 -mt-2 px-1">
          Du setzt das Passwort selbst und gibst die Zugangsdaten weiter. Keine E-Mail wird gesendet.
        </p>
      )}
      {mode === "invite" && (
        <p className="text-xs text-gray-500 -mt-2 px-1">
          Der Schüler erhält eine Einladungs-E-Mail und setzt sein Passwort selbst.
        </p>
      )}

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
            <Input name="email" type="email" placeholder="max@beispiel.ch" required />
          </div>

          {mode === "direct" && (
            <div className="space-y-1.5">
              <label className="text-sm font-500 text-gray-700">
                Passwort <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  name="password"
                  type={showPw ? "text" : "password"}
                  placeholder="Mindestens 8 Zeichen"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-500 text-gray-700">Telefon</label>
            <Input name="telefon" placeholder="+41 79 123 45 67" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-500 text-gray-700">Adresse</label>
            <Input name="adresse" placeholder="Musterstrasse 1, 8001 Zürich" />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {mode === "direct" ? "Anlegen…" : "Einladung senden…"}
              </>
            ) : mode === "direct" ? (
              "Schüler anlegen"
            ) : (
              "Einladungs-E-Mail senden"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
