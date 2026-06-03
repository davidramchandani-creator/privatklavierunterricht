"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateSchueler,
  deleteSchueler,
  reactivateSchueler,
  hardDeleteSchueler,
  resendInvite,
  updateInvoiceStatus,
  updateStudentPrices,
  createPackageAdmin,
  createDirectBooking,
  completeAppointmentNew,
  cancelAppointmentNew,
  pausePackage,
  resumePackage,
  extendPackage,
  cancelPackage,
} from "../../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCHF } from "@/lib/utils";
import {
  CANCELLATION_SINGLE_BASE,
  CANCELLATION_SINGLE_THRESHOLD,
} from "@/lib/packages";
import { Loader2, Pencil, Trash2, CheckCircle2, XCircle, Plus, Mail, AlertTriangle, Calendar, Pause, Play, Clock, Ban } from "lucide-react";

type Profile = {
  id: string;
  vorname: string;
  nachname: string;
  email: string;
  telefon: string | null;
  adresse: string | null;
  notizen: string | null;
  aktiv: boolean;
};

function SchuelerDetailActionsRoot({ profile }: { profile: Profile }) {
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
      const result = await updateSchueler(profile.id, formData);
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  }

  function handleDeactivate() {
    if (!confirm("Schüler deaktivieren?")) return;
    startTransition(async () => {
      const result = await deleteSchueler(profile.id);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateSchueler(profile.id);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleHardDelete() {
    if (!confirm(`${profile.vorname} ${profile.nachname} wirklich permanent löschen? Alle Daten (Pakete, Termine, Zahlungen) werden unwiderruflich gelöscht.`)) return;
    startTransition(async () => {
      const result = await hardDeleteSchueler(profile.id);
      if (result?.error) setError(result.error);
      else router.push("/admin/schueler");
    });
  }

  function handleResendInvite() {
    startTransition(async () => {
      const result = await resendInvite(profile.email);
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
            <Input name="vorname" defaultValue={profile.vorname} required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">Nachname</label>
            <Input name="nachname" defaultValue={profile.nachname} required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">E-Mail</label>
            <Input name="email" type="email" defaultValue={profile.email} required />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">Telefon</label>
            <Input name="telefon" defaultValue={profile.telefon ?? ""} />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-xs font-500 text-gray-600">Adresse</label>
            <Input name="adresse" defaultValue={profile.adresse ?? ""} />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-xs font-500 text-gray-600">Notizen</label>
            <textarea
              name="notizen"
              defaultValue={profile.notizen ?? ""}
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
        {profile.aktiv ? (
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


function InvoiceAction({ invoiceId, currentStatus }: { invoiceId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-1.5">
      {currentStatus === "pending_confirmation" && (
        <button
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await updateInvoiceStatus(invoiceId, "paid");
            });
          }}
          className="text-xs font-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? "…" : "Bestätigen"}
        </button>
      )}
      {currentStatus === "pending_confirmation" && (
        <button
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await updateInvoiceStatus(invoiceId, "rejected");
            });
          }}
          className="text-xs font-600 text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? "…" : "Ablehnen"}
        </button>
      )}
      {currentStatus === "unpaid" && (
        <button
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await updateInvoiceStatus(invoiceId, "paid");
            });
          }}
          className="text-xs font-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? "…" : "Als bezahlt"}
        </button>
      )}
    </div>
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
    payment_method: string;
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
  const [paymentMethod, setPaymentMethod] = useState(initial.payment_method || "qr");

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
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Zahlungsart</label>
          <select
            name="payment_method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="qr">QR-Rechnung</option>
            <option value="twint">TWINT</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl bg-[#1C244B]/5 px-4 py-3 text-sm text-[#1C244B] space-y-1">
        <p className="text-xs font-600 uppercase tracking-wide text-[#1C244B]/70">Effektiver Preis/Lektion (inkl. Wegaufschlag)</p>
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
        className="flex items-center gap-2 text-sm font-600 text-[#1C244B] px-4 py-2.5 rounded-xl border border-[#1C244B]/20 hover:bg-[#1C244B]/5 transition-colors"
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
      if (result && "error" in result && result.error) setError(result.error);
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
        className="flex items-center gap-2 text-sm font-600 text-[#1C244B] px-4 py-2.5 rounded-xl border border-[#1C244B]/20 hover:bg-[#1C244B]/5 transition-colors"
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
  canCancel = false,
  pricePerLesson = 0,
  totalPrice = 0,
  lessonsUsed = 0,
}: {
  packageId: string;
  schuelerId: string;
  paused: boolean;
  canCancel?: boolean;
  pricePerLesson?: number;
  totalPrice?: number;
  lessonsUsed?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Einzelpreis-Vorschau (Spec §10): 70 + max(0, Paketpreis − 60).
  const singleLessonPrice =
    CANCELLATION_SINGLE_BASE +
    Math.max(0, pricePerLesson - CANCELLATION_SINGLE_THRESHOLD);
  const usedCost = lessonsUsed * singleLessonPrice;
  const diff = totalPrice - usedCost;
  const refund = Math.max(0, diff);
  const owed = Math.max(0, -diff);

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

  function handleCancel() {
    setCancelError(null);
    startTransition(async () => {
      const result = await cancelPackage(packageId, schuelerId);
      if (result?.error) setCancelError(result.error);
      else {
        setShowCancel(false);
        router.refresh();
      }
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
        className="p-1.5 rounded-lg hover:bg-[#1C244B]/10 text-gray-400 hover:text-[#1C244B] transition-colors disabled:opacity-50"
        title="Verlängern"
      >
        <Clock className="w-3.5 h-3.5" />
      </button>
      {canCancel && (
        <button
          disabled={isPending}
          onClick={() => {
            setCancelError(null);
            setShowCancel(true);
          }}
          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
          title="Paket stornieren"
        >
          <Ban className="w-3.5 h-3.5" />
        </button>
      )}

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-700 text-gray-900">Paket stornieren</h3>
            </div>
            <p className="text-sm text-gray-600">
              Die bereits besuchten Lektionen werden zum Einzelpreis verrechnet.
              Künftige gebuchte Termine dieses Pakets werden storniert.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Besuchte Lektionen</span>
                <span className="font-600 text-gray-900">
                  {lessonsUsed} × {formatCHF(singleLessonPrice)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Verrechnet</span>
                <span className="font-600 text-gray-900">{formatCHF(usedCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Bezahlt (Paket)</span>
                <span className="font-600 text-gray-900">{formatCHF(totalPrice)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                {owed > 0 ? (
                  <>
                    <span className="text-gray-700 font-600">Nachzahlung</span>
                    <span className="font-700 text-red-600">{formatCHF(owed)}</span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-700 font-600">Rückerstattung</span>
                    <span className="font-700 text-emerald-700">{formatCHF(refund)}</span>
                  </>
                )}
              </div>
            </div>
            {cancelError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {cancelError}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCancel(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-500 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCancel}
                disabled={isPending}
                className="px-4 py-2 text-sm font-600 text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Verbindlich stornieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export {
  PackageTimerActions,
  InvoiceAction,
  PreiseForm,
  PackageFormNew,
  DirektBuchung,
  AppointmentActions,
};
export default SchuelerDetailActionsRoot;
