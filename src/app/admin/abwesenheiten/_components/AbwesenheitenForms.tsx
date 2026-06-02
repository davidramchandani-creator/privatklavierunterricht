"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAbsence,
  createTimeBlock,
  createTimeBlockRule,
  deleteAbsence,
  deleteTimeBlock,
  deleteTimeBlockRule,
} from "../../actions";

type Student = { id: string; vorname: string; nachname: string };

const selectClass =
  "flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function DeleteButton({
  onDelete,
  confirmMessage,
}: {
  onDelete: () => Promise<{ error?: string } | void>;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const result = await onDelete();
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
        title="Löschen"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1">{error}</p>
      )}
    </div>
  );
}

export function AbwesenheitDeleteButton({ id }: { id: string }) {
  return (
    <DeleteButton
      onDelete={() => deleteAbsence(id)}
      confirmMessage="Abwesenheit löschen? Timer-Verlängerungen werden zurückgerechnet."
    />
  );
}

export function ZeitblockDeleteButton({ id }: { id: string }) {
  return <DeleteButton onDelete={() => deleteTimeBlock(id)} confirmMessage="Zeitblock löschen?" />;
}

export function ZeitblockRegelDeleteButton({ id }: { id: string }) {
  return (
    <DeleteButton onDelete={() => deleteTimeBlockRule(id)} confirmMessage="Sperrregel löschen?" />
  );
}

export function AbwesenheitForm({ students }: { students: Student[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("admin");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    if (!formData.get("auto_extend")) formData.set("auto_extend", "false");
    startTransition(async () => {
      const result = await createAbsence(formData);
      if (result?.error) setError(result.error);
      else {
        form.reset();
        setScope("admin");
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-600 text-[#1C244B] px-4 py-2.5 rounded-xl border border-[#1C244B]/20 hover:bg-[#1C244B]/5 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Abwesenheit erstellen
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-600 text-gray-900">Neue Abwesenheit</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Geltungsbereich</label>
          <select
            name="scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className={selectClass}
          >
            <option value="admin">Admin</option>
            <option value="student">Schüler</option>
          </select>
        </div>
        {scope === "student" && (
          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">Schüler</label>
            <select name="student_user_id" className={selectClass} required>
              <option value="">— wählen —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.vorname} {s.nachname}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-500 text-gray-600">Titel</label>
          <Input name="title" placeholder="z.B. Ferien" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Von</label>
          <Input name="start_date" type="date" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Bis</label>
          <Input name="end_date" type="date" required />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="auto_extend"
          value="true"
          defaultChecked
          className="h-4 w-4 rounded border-gray-300 text-[#1C244B] focus:ring-[#1C244B]"
        />
        Paket-Laufzeit automatisch verlängern
      </label>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Erstellen"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

export function ZeitblockForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createTimeBlock(formData);
      if (result?.error) setError(result.error);
      else {
        form.reset();
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-600 text-[#1C244B] px-4 py-2.5 rounded-xl border border-[#1C244B]/20 hover:bg-[#1C244B]/5 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Zeitblock erstellen
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-600 text-gray-900">Neuer Zeitblock</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-500 text-gray-600">Titel</label>
          <Input name="title" placeholder="z.B. Arzttermin" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-500 text-gray-600">Datum</label>
          <Input name="date" type="date" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Von</label>
          <Input name="start_time" type="time" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Bis</label>
          <Input name="end_time" type="time" required />
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Erstellen"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

export function ZeitblockRegelForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createTimeBlockRule(formData);
      if (result?.error) setError(result.error);
      else {
        form.reset();
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-600 text-[#1C244B] px-4 py-2.5 rounded-xl border border-[#1C244B]/20 hover:bg-[#1C244B]/5 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Sperrregel erstellen
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-600 text-gray-900">Neue Wiederholungs-Sperre</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-500 text-gray-600">Titel</label>
          <Input name="title" placeholder="z.B. Wöchentliches Meeting" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Ab Datum</label>
          <Input name="start_date" type="date" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Intervall</label>
          <select name="interval_days" className={selectClass} defaultValue="7">
            <option value="7">Wöchentlich</option>
            <option value="14">Alle 2 Wochen</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Von</label>
          <Input name="start_time" type="time" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Bis</label>
          <Input name="end_time" type="time" required />
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Erstellen"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
