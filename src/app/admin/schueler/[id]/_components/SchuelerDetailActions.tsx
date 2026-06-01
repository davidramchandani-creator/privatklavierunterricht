"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateSchueler,
  deleteSchueler,
  reactivateSchueler,
  hardDeleteSchueler,
  resendInvite,
  createPaket,
  bestaetigeTermin,
  storniereTerminAdmin,
  abschliessenTermin,
  updateZahlungStatus,
} from "../../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, Trash2, CheckCircle2, XCircle, Plus, Mail, AlertTriangle } from "lucide-react";

type Schueler = {
  id: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string | null;
  adresse: string | null;
  notizen: string | null;
  aktiv: boolean;
  user_id: string | null;
};

function SchuelerDetailActionsRoot({ schueler }: { schueler: Schueler }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateSchueler(schueler.id, formData);
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  }

  function handleDeactivate() {
    if (!confirm("Schüler deaktivieren?")) return;
    startTransition(async () => {
      const result = await deleteSchueler(schueler.id);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateSchueler(schueler.id);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleHardDelete() {
    if (!confirm(`${schueler.vorname} ${schueler.nachname} wirklich permanent löschen? Alle Daten (Pakete, Termine, Zahlungen) werden unwiderruflich gelöscht.`)) return;
    startTransition(async () => {
      const result = await hardDeleteSchueler(schueler.id);
      if (result?.error) setError(result.error);
      else router.push("/admin/schueler");
    });
  }

  function handleResendInvite() {
    startTransition(async () => {
      const result = await resendInvite(schueler.email);
      if (result?.error) setError(result.error);
      else setInviteSent(true);
    });
  }

  if (editing) {
    return (
      <form onSubmit={handleUpdate} className="mt-5 space-y-4 border-t border-gray-100 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">Vorname</label>
            <Input name="vorname" defaultValue={schueler.vorname} required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">Nachname</label>
            <Input name="nachname" defaultValue={schueler.nachname} required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">E-Mail</label>
            <Input name="email" type="email" defaultValue={schueler.email} required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">Telefon</label>
            <Input name="telefon" defaultValue={schueler.telefon ?? ""} />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-xs font-500 text-gray-600">Adresse</label>
            <Input name="adresse" defaultValue={schueler.adresse ?? ""} />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-xs font-500 text-gray-600">Notizen</label>
            <textarea
              name="notizen"
              defaultValue={schueler.notizen ?? ""}
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-4 py-2 text-sm font-400 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-all duration-200 resize-none"
            />
          </div>
        </div>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Speichern"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Abbrechen
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-5 border-t border-gray-100 pt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5"
        >
          <Pencil className="w-3.5 h-3.5" />
          Bearbeiten
        </Button>
        {schueler.user_id && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendInvite}
            disabled={isPending || inviteSent}
            className="flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
            {inviteSent ? "E-Mail gesendet ✓" : "Einladung erneut senden"}
          </Button>
        )}
        {schueler.aktiv ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeactivate}
            disabled={isPending}
            className="flex items-center gap-1.5 text-gray-500 hover:text-amber-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Deaktivieren
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReactivate}
            disabled={isPending}
            className="flex items-center gap-1.5 text-gray-500 hover:text-emerald-600"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Reaktivieren
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleHardDelete}
          disabled={isPending}
          className="flex items-center gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Permanent löschen
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}

function PaketForm({ schueler_id }: { schueler_id: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("schueler_id", schueler_id);
    startTransition(async () => {
      const result = await createPaket(formData);
      if (result?.error) setError(result.error);
      else {
        setOpen(false);
        e.currentTarget?.reset?.();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-600 text-[#3730A3] px-4 py-2.5 rounded-xl border border-[#3730A3]/20 hover:bg-[#3730A3]/5 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Neues Paket erstellen
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-600 text-gray-900">Neues Paket</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Typ</label>
          <select
            name="typ"
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          >
            <option value="einzellektion">Einzellektion</option>
            <option value="10er">10er-Paket</option>
            <option value="20er">20er-Paket</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Lektionen</label>
          <Input
            name="lektionen_gesamt"
            type="number"
            min="1"
            defaultValue="10"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Preis/Lektion (CHF)</label>
          <Input
            name="preis_pro_lektion"
            type="number"
            step="0.01"
            min="0"
            placeholder="80.00"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Gültig bis</label>
          <Input name="gueltig_bis" type="date" />
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Erstellen"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

function TerminActions({
  terminId,
  status,
}: {
  terminId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (status === "storniert" || status === "abgeschlossen") return null;

  if (status === "angefragt") {
    return (
      <div className="flex gap-1.5">
        <button
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await bestaetigeTermin(terminId);
            });
          }}
          className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors"
          title="Bestätigen"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        </button>
        <button
          disabled={isPending}
          onClick={() => {
            if (!confirm("Anfrage ablehnen?")) return;
            startTransition(async () => {
              await storniereTerminAdmin(terminId);
            });
          }}
          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
          title="Ablehnen"
        >
          <XCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <button
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await abschliessenTermin(terminId);
          });
        }}
        className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors"
        title="Abschliessen"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5" />
        )}
      </button>
      <button
        disabled={isPending}
        onClick={() => {
          if (!confirm("Termin stornieren?")) return;
          startTransition(async () => {
            await storniereTerminAdmin(terminId);
          });
        }}
        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
        title="Stornieren"
      >
        <XCircle className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ZahlungAction({ zahlungId }: { zahlungId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await updateZahlungStatus(zahlungId, "bezahlt");
        });
      }}
      className="text-xs font-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
    >
      {isPending ? "…" : "Als bezahlt"}
    </button>
  );
}

export { PaketForm, TerminActions, ZahlungAction };
export default SchuelerDetailActionsRoot;
