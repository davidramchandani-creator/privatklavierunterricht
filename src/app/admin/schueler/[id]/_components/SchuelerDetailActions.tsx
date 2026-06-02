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
  updateStudentPrices,
  createPackageAdmin,
  createDirectBooking,
  completeAppointmentNew,
  cancelAppointmentNew,
  pausePackage,
  resumePackage,
  extendPackage,
} from "../../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCHF } from "@/lib/utils";
import { Loader2, Pencil, Trash2, CheckCircle2, XCircle, Plus, Mail, AlertTriangle, Calendar, Pause, Play, Clock } from "lucide-react";

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

function PreiseForm({
  userId,
  schuelerId,
  initial,
}: {
  userId: string;
  schuelerId: string;
  initial: {
    price_single: number;
    price_10er: number;
    price_20er: number;
    travel_surcharge: number;
    buffer_time_minutes: number;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [priceSingle, setPriceSingle] = useState(String(initial.price_single));
  const [price10er, setPrice10er] = useState(String(initial.price_10er));
  const [price20er, setPrice20er] = useState(String(initial.price_20er));
  const [travel, setTravel] = useState(String(initial.travel_surcharge));
  const [buffer, setBuffer] = useState(String(initial.buffer_time_minutes));

  const t = Number(travel) || 0;
  const effSingle = (Number(priceSingle) || 0) + t;
  const eff10er = (Number(price10er) || 0) + t;
  const eff20er = (Number(price20er) || 0) + t;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateStudentPrices(userId, schuelerId, formData);
      if (result?.error) setError(result.error);
      else {
        setSuccess(true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Einzellektion (CHF)</label>
          <Input
            name="price_single"
            type="number"
            step="0.01"
            min="0"
            value={priceSingle}
            onChange={(e) => setPriceSingle(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">10er (CHF)</label>
          <Input
            name="price_10er"
            type="number"
            step="0.01"
            min="0"
            value={price10er}
            onChange={(e) => setPrice10er(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">20er (CHF)</label>
          <Input
            name="price_20er"
            type="number"
            step="0.01"
            min="0"
            value={price20er}
            onChange={(e) => setPrice20er(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Wegaufschlag (CHF)</label>
          <Input
            name="travel_surcharge"
            type="number"
            step="0.01"
            min="0"
            value={travel}
            onChange={(e) => setTravel(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Pufferzeit</label>
          <select
            name="buffer_time_minutes"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="15">15 Minuten</option>
            <option value="30">30 Minuten</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl bg-[#3730A3]/5 px-4 py-3 text-sm text-[#3730A3] space-y-1">
        <p className="text-xs font-600 uppercase tracking-wide text-[#3730A3]/70">Effektiver Preis/Lektion (inkl. Wegaufschlag)</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-500">
          <span>Einzellektion: {formatCHF(effSingle)}</span>
          <span>10er: {formatCHF(eff10er)}</span>
          <span>20er: {formatCHF(eff20er)}</span>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Speichern"}
        </Button>
        {success && !isPending && (
          <span className="text-xs font-600 text-emerald-700">Gespeichert ✓</span>
        )}
      </div>
    </form>
  );
}

function PackageFormNew({
  schueler_id,
  student_user_id,
  defaultPrices,
}: {
  schueler_id: string;
  student_user_id: string;
  defaultPrices: {
    price_single: number;
    price_10er: number;
    price_20er: number;
    travel_surcharge: number;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const priceFor = (type: string) => {
    const base =
      type === "single"
        ? defaultPrices.price_single
        : type === "10er"
        ? defaultPrices.price_10er
        : defaultPrices.price_20er;
    return (Number(base) || 0) + (Number(defaultPrices.travel_surcharge) || 0);
  };

  const [type, setType] = useState<string>("10er");
  const [price, setPrice] = useState(String(priceFor("10er")));

  function handleTypeChange(value: string) {
    setType(value);
    setPrice(String(priceFor(value)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createPackageAdmin(formData);
      if (result?.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
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
      <input type="hidden" name="student_user_id" value={student_user_id} />
      <input type="hidden" name="schueler_id" value={schueler_id} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Typ</label>
          <select
            name="type"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          >
            <option value="single">Einzellektion</option>
            <option value="10er">10er-Paket</option>
            <option value="20er">20er-Paket</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Zahlungsart</label>
          <select
            name="payment_method"
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          >
            <option value="twint">TWINT</option>
            <option value="qr">QR-Rechnung</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Preis/Lektion (CHF)</label>
          <Input
            name="price_per_lesson"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
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

function DirektBuchung({
  schueler_id,
  student_user_id,
}: {
  schueler_id: string;
  student_user_id: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [start, setStart] = useState("");
  const [lessonsCount, setLessonsCount] = useState("1");
  const [intervalDays, setIntervalDays] = useState("7");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!start) {
      setError("Bitte Datum und Zeit wählen.");
      return;
    }
    const formData = new FormData();
    formData.set("student_user_id", student_user_id);
    formData.set("schueler_id", schueler_id);
    formData.set("start", new Date(start).toISOString());
    formData.set("lessons_count", lessonsCount);
    formData.set("interval_days", intervalDays);
    startTransition(async () => {
      const result = await createDirectBooking(formData);
      if (result?.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-600 text-[#3730A3] px-4 py-2.5 rounded-xl border border-[#3730A3]/20 hover:bg-[#3730A3]/5 transition-colors"
      >
        <Calendar className="w-4 h-4" />
        Direkt buchen
      </button>
    );
  }

  const isSingle = lessonsCount === "1";

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-4 space-y-3 mb-4">
      <h3 className="text-sm font-600 text-gray-900">Direkt buchen</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Start</label>
          <Input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Anzahl Lektionen</label>
          <select
            value={lessonsCount}
            onChange={(e) => setLessonsCount(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="1">1</option>
            <option value="5">5</option>
            <option value="10">10</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Intervall</label>
          <select
            value={intervalDays}
            onChange={(e) => setIntervalDays(e.target.value)}
            disabled={isSingle}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="7">Wöchentlich</option>
            <option value="14">Zweiwöchentlich</option>
          </select>
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Buchen"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

function AppointmentActions({
  appointmentId,
  schuelerId,
  status,
}: {
  appointmentId: string;
  schuelerId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (status === "cancelled" || status === "completed") return null;

  return (
    <div className="flex gap-1.5">
      <button
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await completeAppointmentNew(appointmentId, schuelerId);
            router.refresh();
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
            await cancelAppointmentNew(appointmentId, schuelerId);
            router.refresh();
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

function PackageTimerActions({
  packageId,
  schuelerId,
  paused,
}: {
  packageId: string;
  schuelerId: string;
  paused: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleExtend() {
    const input = prompt("Um wie viele Tage verlängern?");
    if (input === null) return;
    const days = parseInt(input, 10);
    if (!Number.isFinite(days) || days <= 0) return;
    startTransition(async () => {
      await extendPackage(packageId, schuelerId, days);
      router.refresh();
    });
  }

  function handlePause() {
    startTransition(async () => {
      await pausePackage(packageId, schuelerId);
      router.refresh();
    });
  }

  function handleResume() {
    startTransition(async () => {
      await resumePackage(packageId, schuelerId);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-1.5">
      {paused ? (
        <button
          disabled={isPending}
          onClick={handleResume}
          className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
          title="Fortsetzen"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>
      ) : (
        <button
          disabled={isPending}
          onClick={handlePause}
          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
          title="Pausieren"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Pause className="w-3.5 h-3.5" />
          )}
        </button>
      )}
      <button
        disabled={isPending}
        onClick={handleExtend}
        className="p-1.5 rounded-lg hover:bg-[#3730A3]/10 text-gray-400 hover:text-[#3730A3] transition-colors disabled:opacity-50"
        title="Verlängern"
      >
        <Clock className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export {
  PaketForm,
  PackageTimerActions,
  TerminActions,
  ZahlungAction,
  PreiseForm,
  PackageFormNew,
  DirektBuchung,
  AppointmentActions,
};
export default SchuelerDetailActionsRoot;
