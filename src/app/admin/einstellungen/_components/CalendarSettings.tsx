"use client";

import { useState, useTransition } from "react";
import { Loader2, Plug, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { testGoogleCalendar, runFullCalendarSync } from "@/app/admin/actions";

export default function CalendarSettings({ configured }: { configured: boolean }) {
  const [testing, startTest] = useTransition();
  const [syncing, startSync] = useTransition();
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleTest = () => {
    setTestResult(null);
    startTest(async () => {
      const res = await testGoogleCalendar();
      // Fehlt die Berechtigung, kommt nur { error } zurück.
      setTestResult(
        "ok" in res ? res : { ok: false, message: res.error ?? "Keine Berechtigung." }
      );
    });
  };

  const handleSync = () => {
    setSyncResult(null);
    startSync(async () => {
      const res = await runFullCalendarSync();
      if ("synced" in res) {
        setSyncResult(
          `${res.synced} Termin(e) synchronisiert${res.failed ? `, ${res.failed} fehlgeschlagen` : ""}.`
        );
      }
    });
  };

  return (
    <div className="space-y-3 pt-1">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleTest}
          disabled={testing || !configured}
          className="inline-flex items-center gap-2 text-sm font-600 text-white bg-[#1C244B] px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
          Verbindung testen
        </button>
        <button
          onClick={handleSync}
          disabled={syncing || !configured}
          className="inline-flex items-center gap-2 text-sm font-600 text-[#1C244B] bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Vollsync starten
        </button>
      </div>

      {testResult && (
        <div
          className={`flex items-start gap-2 text-sm rounded-xl p-3 ${
            testResult.ok
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      {syncResult && (
        <div className="flex items-start gap-2 text-sm rounded-xl p-3 bg-blue-50 text-blue-700 border border-blue-200">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{syncResult}</span>
        </div>
      )}
    </div>
  );
}
