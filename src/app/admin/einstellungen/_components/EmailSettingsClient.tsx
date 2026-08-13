"use client";

import { useState, useTransition } from "react";
import { saveEmailSettings } from "@/app/admin/actions";
import { Check, Loader2 } from "lucide-react";

type EmailType = {
  id: string;
  label: string;
};

const GROUPS: { label: string; types: EmailType[] }[] = [
  {
    label: "Admin-Benachrichtigungen",
    types: [
      { id: "booking_request_admin", label: "Neue Terminanfrage" },
      { id: "reschedule_request_admin", label: "Neue Verschiebungsanfrage" },
      { id: "appointment_cancelled_by_student", label: "Termin storniert (Schüler)" },
      { id: "booking_request_withdrawn", label: "Anfrage zurückgezogen" },
      { id: "reschedule_request_withdrawn", label: "Verschiebungsanfrage zurückgezogen" },
      { id: "proposal_rejected_admin", label: "Vorschlag abgelehnt" },
      { id: "group_session_admin", label: "Neue Gruppen-Session" },
    ],
  },
  {
    label: "Schüler, Buchung",
    types: [
      { id: "booking_request_received", label: "Terminanfrage erhalten" },
      { id: "booking_confirmed", label: "Termine bestätigt" },
      { id: "booking_rejected", label: "Terminanfrage abgelehnt" },
      { id: "proposal_new", label: "Neuer Terminvorschlag" },
    ],
  },
  {
    label: "Schüler, Verschiebung",
    types: [
      { id: "reschedule_request_received", label: "Verschiebungsanfrage eingegangen" },
      { id: "reschedule_confirmed", label: "Verschiebung bestätigt" },
      { id: "reschedule_rejected", label: "Verschiebung abgelehnt" },
    ],
  },
  {
    label: "Schüler, Stornierung",
    types: [
      { id: "appointment_cancelled_student", label: "Termin storniert (durch Schüler)" },
      { id: "appointment_cancelled_by_admin", label: "Termin storniert (durch Admin)" },
      { id: "package_cancelled", label: "Paket storniert" },
      { id: "package_settlement_paid", label: "Stornierungsbetrag bestätigt" },
    ],
  },
  {
    label: "Zahlungen",
    types: [
      { id: "twint_payment_request", label: "TWINT-Zahlungsaufforderung" },
      { id: "qr_invoice", label: "QR-Rechnung" },
      { id: "payment_confirmed", label: "Zahlung bestätigt" },
      { id: "payment_rejected", label: "Zahlung abgelehnt" },
      { id: "group_payment_request", label: "Gruppen-Zahlung" },
    ],
  },
  {
    label: "Gruppenkurse",
    types: [
      { id: "group_session_created", label: "Session eröffnet" },
      { id: "group_session_joined", label: "Session beigetreten" },
      { id: "group_session_left", label: "Session verlassen" },
    ],
  },
  {
    label: "Pakete & Abos",
    types: [
      { id: "package_created", label: "Paket angelegt" },
      { id: "abo_gestartet", label: "Abo gestartet" },
      { id: "abo_beendet", label: "Abo beendet" },
      { id: "subscription_cancelled", label: "Abo gekündigt" },
      { id: "rhythmus_changed", label: "Rhythmus geändert" },
      { id: "fixplatz_confirmed", label: "Fixplatz bestätigt" },
    ],
  },
  {
    label: "Verfügbarkeit & Planung",
    types: [
      { id: "verfuegbarkeit_anfrage", label: "Verfügbarkeit angefragt" },
      { id: "verfuegbarkeit_einzelanfrage", label: "Verfügbarkeit einzeln angefragt" },
      { id: "verfuegbarkeit_erinnerung", label: "Erinnerung an die Verfügbarkeit" },
      { id: "verfuegbarkeit_zuteilung", label: "Termine zugeteilt" },
    ],
  },
  {
    label: "Ausfälle",
    types: [
      { id: "ausfall_gutschrift", label: "Gutschrift nach Ausfall" },
      { id: "ausfall_admin", label: "Ausfall gemeldet (an mich)" },
    ],
  },
  {
    label: "Weitere Admin-Benachrichtigungen",
    types: [
      { id: "abo_gestartet_admin", label: "Abo gestartet (an mich)" },
      { id: "subscription_cancelled_admin", label: "Abo gekündigt (an mich)" },
      { id: "payment_reported_admin", label: "Zahlung gemeldet (an mich)" },
      { id: "proposal_accepted_admin", label: "Vorschlag angenommen (an mich)" },
    ],
  },
];

export default function EmailSettingsClient({
  initialDisabled,
}: {
  initialDisabled: string[];
}) {
  const [disabled, setDisabled] = useState<Set<string>>(new Set(initialDisabled));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaved(false);
    startTransition(async () => {
      const next = new Set(disabled);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      await saveEmailSettings(Array.from(next));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function toggleGroup(groupTypes: EmailType[], enableAll: boolean) {
    setDisabled((prev) => {
      const next = new Set(prev);
      for (const t of groupTypes) {
        if (enableAll) next.delete(t.id);
        else next.add(t.id);
      }
      return next;
    });
    setSaved(false);
    startTransition(async () => {
      const next = new Set(disabled);
      for (const t of groupTypes) {
        if (enableAll) next.delete(t.id);
        else next.add(t.id);
      }
      await saveEmailSettings(Array.from(next));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Deaktivierte Typen werden nicht gesendet, auch wenn der Auslöser eintritt.
        </p>
        <span className={`flex items-center gap-1.5 text-xs font-600 transition-opacity duration-300 ${saved ? "opacity-100 text-emerald-600" : "opacity-0"}`}>
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" /> : <Check className="w-3.5 h-3.5" />}
          {!isPending && "Gespeichert"}
        </span>
      </div>

      {GROUPS.map((group) => {
        const allEnabled = group.types.every((t) => !disabled.has(t.id));
        const allDisabled = group.types.every((t) => disabled.has(t.id));
        return (
          <div key={group.label} className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50/70">
              <span className="text-sm font-700 text-gray-700">{group.label}</span>
              <button
                onClick={() => toggleGroup(group.types, !allEnabled)}
                disabled={isPending}
                className={`text-[11px] font-600 px-2.5 py-1 rounded-lg transition-colors ${
                  allEnabled
                    ? "text-gray-500 hover:bg-gray-200"
                    : allDisabled
                      ? "text-[#1C244B] hover:bg-[#1C244B]/10"
                      : "text-gray-500 hover:bg-gray-200"
                }`}
              >
                {allEnabled ? "Alle deaktivieren" : "Alle aktivieren"}
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {group.types.map((t) => {
                const isDisabled = disabled.has(t.id);
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors"
                  >
                    <span className={`text-sm ${isDisabled ? "text-gray-400 line-through" : "text-gray-700"}`}>
                      {t.label}
                    </span>
                    <button
                      role="switch"
                      aria-checked={!isDisabled}
                      disabled={isPending}
                      onClick={() => toggle(t.id)}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                        isDisabled ? "bg-gray-200" : "bg-emerald-500"
                      } disabled:opacity-60`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                          isDisabled ? "translate-x-0" : "translate-x-5"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
