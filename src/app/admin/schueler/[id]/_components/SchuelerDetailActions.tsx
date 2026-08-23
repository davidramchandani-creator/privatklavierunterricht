"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateSchueler,
  deleteSchueler,
  reactivateSchueler,
  hardDeleteSchueler,
  resendInvite,
  bewertungAnfordern,
  updateInvoiceStatus,
  updateStudentPrices,
  aboAnlegenAdmin,
  createPackageAdmin,
  aboVorschauAdmin,
  createDirectBooking,
  createProposal,
  withdrawProposal,
  markAppointmentNoShow,
  cancelAppointmentNew,
  moveAppointment,
  pausePackage,
  resumePackage,
  extendPackage,
  cancelPackage,
  calculateTravelBuffer,
  adjustPackageLessons,
  fixplaetzeFuerSchueler,
} from "../../../actions";
import { Button } from "@/components/ui/button";
import GuenstigeSlots from "./GuenstigeSlots";
import { Input } from "@/components/ui/input";
import { formatCHF } from "@/lib/utils";

import type { BookingMode, Rhythmus } from "@/lib/rhythmus";
import type { FixplatzAngebot } from "@/lib/fixplatz-suche";
import type { AboVorschau } from "@/lib/abo-server";
import { formatDay } from "@/lib/instalment-view";
import {
  CANCELLATION_SINGLE_BASE,
  CANCELLATION_SINGLE_THRESHOLD,
} from "@/lib/packages";
import {
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  Send,
  SlidersHorizontal,
  Star,
  Trash2,
  UserX,
  XCircle,
  CalendarClock,
} from "lucide-react";

type Profile = {
  id: string;
  vorname: string;
  nachname: string;
  /** Bei Externen null — sie bekommen nie Post. */
  email: string | null;
  telefon: string | null;
  adresse: string | null;
  notizen: string | null;
  aktiv: boolean;
  extern?: boolean | null;
};

function SchuelerDetailActionsRoot({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [bewertungGesendet, setBewertungGesendet] = useState(false);

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateSchueler(profile.id, formData);
      if (result?.error) setError(result.error ?? null);
      else setEditing(false);
    });
  }

  function handleDeactivate() {
    if (!confirm("Schüler deaktivieren?")) return;
    startTransition(async () => {
      const result = await deleteSchueler(profile.id);
      if (result?.error) setError(result.error ?? null);
      else router.refresh();
    });
  }

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateSchueler(profile.id);
      if (result?.error) setError(result.error ?? null);
      else router.refresh();
    });
  }

  function handleHardDelete() {
    if (!confirm(`${profile.vorname} ${profile.nachname} wirklich permanent löschen? Alle Daten (Pakete, Termine, Zahlungen) werden unwiderruflich gelöscht.`)) return;
    startTransition(async () => {
      const result = await hardDeleteSchueler(profile.id);
      if (result?.error) setError(result.error ?? null);
      else router.push("/admin/schueler");
    });
  }

  // Die Bitte um eine Bewertung. Bewusst ein Knopf und kein Automatismus:
  // David weiss selbst am besten, wann bei wem der Moment passt. Ein zweiter
  // Klick schickt denselben Link nochmal, statt einen weiteren gueltigen
  // anzulegen.
  function handleBewertungAnfordern() {
    startTransition(async () => {
      const result = await bewertungAnfordern(profile.id);
      if (result?.error) setError(result.error ?? null);
      else setBewertungGesendet(true);
    });
  }

  function handleResendInvite() {
    // Ohne Mailadresse gibt es nichts zu verschicken — bei Externen ist das
    // der Normalfall, nicht ein fehlender Eintrag.
    if (!profile.email) {
      setError("Für diesen Schüler ist keine E-Mail hinterlegt.");
      return;
    }
    const adresse = profile.email;
    startTransition(async () => {
      const result = await resendInvite(adresse);
      if (result?.error) setError(result.error ?? null);
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
            <label className="text-xs font-500 text-gray-600">
              E-Mail
              {profile.extern && (
                <span className="text-gray-400 font-400"> — bei Externen leer</span>
              )}
            </label>
            {/* Für Externe kein Pflichtfeld: Sie haben bewusst keine
                Mailadresse, weil sie nie Post bekommen dürfen. Das
                `required` machte ihr Profil unspeicherbar — man konnte
                nicht einmal die Adresse korrigieren. */}
            <Input
              name="email"
              type="email"
              defaultValue={profile.email ?? ""}
              required={!profile.extern}
            />
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleBewertungAnfordern}
          disabled={isPending || bewertungGesendet}
          className="flex items-center gap-1.5"
        >
          <Star className="w-3.5 h-3.5" />
          {bewertungGesendet ? "Angefragt ✓" : "Um Bewertung bitten"}
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
  studentAddress,
  mapsConfigured,
  initial,
}: {
  userId: string;
  schuelerId: string;
  studentAddress: string | null;
  mapsConfigured: boolean;
  initial: {
    price_single: number;
    price_halbjahr: number;
    price_jahr: number;
    price_10er: number;
    price_20er: number;
    travel_surcharge: number;
    buffer_time_minutes: number;
    buffer_mode: string;
    payment_method: string;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [priceSingle, setPriceSingle] = useState(String(initial.price_single));
  const [priceHalbjahr, setPriceHalbjahr] = useState(String(initial.price_halbjahr));
  const [priceJahr, setPriceJahr] = useState(String(initial.price_jahr));
  // Paketpreise: gelten, wenn du diesem Schüler ein Lektionspaket statt eines
  // Abos gibst. Ein Paket bindet weniger, darum liegt der Preis pro Lektion
  // in der Regel zwischen Einzellektion und Abo.
  const [price10er, setPrice10er] = useState(String(initial.price_10er));
  const [price20er, setPrice20er] = useState(String(initial.price_20er));
  const [travel, setTravel] = useState(String(initial.travel_surcharge));
  const [buffer, setBuffer] = useState(String(initial.buffer_time_minutes));
  const [bufferMode, setBufferMode] = useState<"fixed" | "auto">(
    initial.buffer_mode === "auto" ? "auto" : "fixed"
  );
  const [paymentMethod, setPaymentMethod] = useState(initial.payment_method || "qr");

  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsResult, setMapsResult] = useState<number | null>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const t = Number(travel) || 0;
  const effSingle = (Number(priceSingle) || 0) + t;
  const effHalbjahr = (Number(priceHalbjahr) || 0) + t;
  const effJahr = (Number(priceJahr) || 0) + t;
  const eff10er = (Number(price10er) || 0) + t;
  const eff20er = (Number(price20er) || 0) + t;

  async function handleCalculateMaps() {
    if (!studentAddress) return;
    setMapsLoading(true);
    setMapsError(null);
    setMapsResult(null);
    const result = await calculateTravelBuffer(studentAddress);
    setMapsLoading(false);
    if ("error" in result) {
      setMapsError(result.error);
    } else {
      setMapsResult(result.minutes);
      setBuffer(String(result.minutes));
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateStudentPrices(userId, schuelerId, formData);
      if (result?.error) setError(result.error ?? null);
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
          <Input name="price_single" type="number" step="0.01" min="0" value={priceSingle}
            onChange={(e) => setPriceSingle(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Halbjahr (CHF)</label>
          <Input name="price_halbjahr" type="number" step="0.01" min="0" value={priceHalbjahr}
            onChange={(e) => setPriceHalbjahr(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Jahr (CHF)</label>
          <Input name="price_jahr" type="number" step="0.01" min="0" value={priceJahr}
            onChange={(e) => setPriceJahr(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">10er-Paket (CHF)</label>
          <Input name="price_10er" type="number" step="0.01" min="0" value={price10er}
            onChange={(e) => setPrice10er(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">20er-Paket (CHF)</label>
          <Input name="price_20er" type="number" step="0.01" min="0" value={price20er}
            onChange={(e) => setPrice20er(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Wegaufschlag (CHF)</label>
          <Input name="travel_surcharge" type="number" step="0.01" min="0" value={travel}
            onChange={(e) => setTravel(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Zahlungsart</label>
          <select name="payment_method" value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="qr">QR-Rechnung</option>
            <option value="twint">TWINT</option>
          </select>
        </div>
      </div>

      {/* Pufferzeit */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-600 text-gray-700">Pufferzeit zwischen Terminen</p>
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
            {(["fixed", "auto"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setBufferMode(m); setMapsResult(null); setMapsError(null); }}
                className={`px-3 py-1.5 font-500 transition-colors ${
                  bufferMode === m
                    ? "bg-[#1C244B] text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {m === "fixed" ? "Fixiert" : "Google Maps"}
              </button>
            ))}
          </div>
        </div>

        <input type="hidden" name="buffer_mode" value={bufferMode} />

        {bufferMode === "fixed" ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Input
                name="buffer_time_minutes"
                type="number"
                min="1"
                max="120"
                value={buffer}
                onChange={(e) => setBuffer(e.target.value)}
                className="w-20 text-center"
                required
              />
              <span className="text-sm text-gray-500">Min.</span>
            </div>
            <div className="flex gap-1.5">
              {[15, 20, 30, 45].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBuffer(String(v))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-500 border transition-colors ${
                    buffer === String(v)
                      ? "bg-[#1C244B] text-white border-[#1C244B]"
                      : "border-gray-200 text-gray-600 hover:border-[#1C244B]/40"
                  }`}
                >
                  {v}&apos;
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <input type="hidden" name="buffer_time_minutes" value={buffer} />
            {!mapsConfigured ? (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Setze <code className="font-mono">GOOGLE_MAPS_API_KEY</code> in den Umgebungsvariablen,
                um die automatische Fahrzeitberechnung zu nutzen.
              </div>
            ) : !studentAddress ? (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Keine Adresse hinterlegt. Trage zuerst die Adresse des Schülers ein.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Von: Neftenbach → {studentAddress}</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCalculateMaps}
                    disabled={mapsLoading}
                    className="text-xs h-8"
                  >
                    {mapsLoading ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Berechne…</>
                    ) : (
                      "Fahrzeit berechnen"
                    )}
                  </Button>
                  {mapsResult !== null && (
                    <span className="text-sm font-600 text-emerald-700">
                      ~{mapsResult} Min. ermittelt ✓
                    </span>
                  )}
                  {buffer !== String(initial.buffer_time_minutes) && mapsResult !== null && (
                    <span className="text-xs text-gray-500">(wird beim Speichern übernommen)</span>
                  )}
                  {mapsError && (
                    <span className="text-xs text-red-600">{mapsError}</span>
                  )}
                </div>
                {!mapsResult && (
                  <p className="text-xs text-gray-400">
                    Aktuell gespeichert: {initial.buffer_time_minutes} Min.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-[#1C244B]/5 px-4 py-3 text-sm text-[#1C244B] space-y-1">
        <p className="text-xs font-600 uppercase tracking-wide text-[#1C244B]/70">Effektiver Preis/Lektion (inkl. Wegaufschlag)</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-500">
          <span>Einzellektion: {formatCHF(effSingle)}</span>
          <span>Halbjahr: {formatCHF(effHalbjahr)}</span>
          <span>Jahr: {formatCHF(effJahr)}</span>
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

export type PaketPreise = {
  price_single: number;
  price_10er: number;
  price_20er: number;
  travel_surcharge: number;
};

/**
 * Abo oder Paket, die Entscheidung trifft der Admin, nicht der Schüler.
 *
 * Beides nebeneinander anzubieten wäre für den Schüler eine Zumutung: Er
 * müsste Bindung, Laufzeit und Preis gegeneinander abwägen, ohne zu wissen,
 * was für ihn sinnvoll ist. Im Portal gibt es darum weiterhin nur das Abo.
 * Das Paket ist der Weg für Fälle, die nicht ins Abo passen. Jemand, der
 * nur ein paar Stunden will, oder eine Schnupperlektion.
 */
function PackageFormNew({
  schueler_id,
  student_user_id,
  defaultPrices,
}: {
  schueler_id: string;
  student_user_id: string;
  defaultPrices?: PaketPreise;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [art, setArt] = useState<"abo" | "paket" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [ladend, startLaden] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [variante, setVariante] = useState<"halbjahr" | "jahr">("halbjahr");
  const [rhythmus, setRhythmus] = useState<Rhythmus>("woechentlich");
  const [bookingMode, setBookingMode] = useState<BookingMode>("fix");
  const [autoRenew, setAutoRenew] = useState(true);
  const [angebote, setAngebote] = useState<FixplatzAngebot[] | null>(null);
  const [platz, setPlatz] = useState<FixplatzAngebot | null>(null);
  const [vorschau, setVorschau] = useState<AboVorschau | null>(null);
  // Vorgabe: die Planung entscheidet. Wer jeden Termin einzeln von Hand
  // setzt, bekommt eine Route aus lauter einzeln vernünftigen Entscheidungen,
  // die in der Summe trotzdem schlecht ist.
  const [quelle, setQuelle] = useState<"planung" | "jetzt">("planung");

  function plaetzeSuchen() {
    setError(null);
    setAngebote(null);
    setPlatz(null);
    setVorschau(null);
    startLaden(async () => {
      const res = await fixplaetzeFuerSchueler(
        student_user_id,
        variante === "halbjahr" ? "10er" : "20er",
        rhythmus
      );
      if ("error" in res) {
        setError(res.error ?? null);
        setAngebote([]);
        return;
      }
      setAngebote(res.angebote);
    });
  }

  /** Ohne Wochentag: vorsichtige Rechnung über den ungünstigsten Tag. */
  function vorschauLaden(weekday?: number) {
    setVorschau(null);
    startLaden(async () => {
      const res = await aboVorschauAdmin({
        studentUserId: student_user_id,
        variante,
        rhythmus,
        bookingMode,
        weekday: weekday ?? null,
      });
      if ("error" in res) {
        setError(res.error ?? null);
        return;
      }
      setVorschau(res.vorschau);
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await aboAnlegenAdmin(formData);
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setArt(null);
        }}
        className="flex items-center gap-2 text-sm font-600 text-[#1C244B] px-4 py-2.5 rounded-xl border border-[#1C244B]/20 hover:bg-[#1C244B]/5 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Abo oder Paket anlegen
      </button>
    );
  }

  // ── Erst die Art wählen ──────────────────────────────────
  if (art === null) {
    return (
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-600 text-gray-900">Was soll es sein?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setArt("abo")}
            className="text-left rounded-xl border border-gray-200 hover:border-[#1C244B] p-4 transition-colors"
          >
            <p className="font-600 text-gray-900 text-sm">Abo</p>
            <p className="text-xs text-gray-500 leading-snug mt-1">
              Halbjahr oder Jahr, fester Rhythmus, Zahlung in Monatsraten.
              Verlängert sich, wenn nicht gekündigt. Der Regelfall.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setArt("paket")}
            className="text-left rounded-xl border border-gray-200 hover:border-[#1C244B] p-4 transition-colors"
          >
            <p className="font-600 text-gray-900 text-sm">Paket</p>
            <p className="text-xs text-gray-500 leading-snug mt-1">
              Einzellektion, 10er oder 20er. Wird beim Anlegen als Ganzes in
              Rechnung gestellt und endet, wenn die Lektionen aufgebraucht
              sind. Für alle, die sich nicht binden wollen.
            </p>
          </button>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
    );
  }

  if (art === "paket") {
    return (
      <PaketForm
        schueler_id={schueler_id}
        student_user_id={student_user_id}
        preise={defaultPrices}
        onZurueck={() => setArt(null)}
        onFertig={() => {
          setOpen(false);
          setArt(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-600 text-gray-900">Neues Abo</h3>
        <button
          type="button"
          onClick={() => setArt(null)}
          className="text-xs text-gray-500 hover:text-gray-900 underline"
        >
          Doch ein Paket
        </button>
      </div>
      <input type="hidden" name="student_user_id" value={student_user_id} />
      <input type="hidden" name="schueler_id" value={schueler_id} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Abo</label>
          <select
            name="abo_variante"
            value={variante}
            onChange={(e) => {
              setVariante(e.target.value as "halbjahr" | "jahr");
              setAngebote(null);
              setPlatz(null);
              setVorschau(null);
            }}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="halbjahr">Halbjahr (6 Monate)</option>
            <option value="jahr">Jahr (12 Monate)</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Rhythmus</label>
          <select
            name="rhythmus"
            value={rhythmus}
            onChange={(e) => {
              setRhythmus(e.target.value as Rhythmus);
              setAngebote(null);
              setPlatz(null);
              setVorschau(null);
            }}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="woechentlich">Jede Woche</option>
            <option value="zweiwoechentlich">Alle zwei Wochen</option>
          </select>
        </div>
        <div className="space-y-1 col-span-2">
          <label className="text-xs font-500 text-gray-600">Buchungsart</label>
          <select
            name="booking_mode"
            value={bookingMode}
            onChange={(e) => {
              setBookingMode(e.target.value as BookingMode);
              setPlatz(null);
              setVorschau(null);
              setQuelle("planung");
            }}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="fix">Fixplatz</option>
            <option value="flex">Flexibel</option>
          </select>
        </div>
      </div>

      {bookingMode === "fix" && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-2.5">
          <input type="hidden" name="fixplatz_quelle" value={quelle} />

          <p className="text-xs font-600 text-gray-900">Fester Termin</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setQuelle("planung");
                setPlatz(null);
                vorschauLaden();
              }}
              className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                quelle === "planung"
                  ? "border-[#1C244B] bg-[#1C244B]/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="text-xs font-600 text-gray-900">
                Die Planung entscheidet
              </p>
              <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                Abo läuft sofort, der Termin kommt aus der Zuteilung. Zusammen
                mit den anderen und mit der kürzesten Route.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setQuelle("jetzt")}
              className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                quelle === "jetzt"
                  ? "border-[#1C244B] bg-[#1C244B]/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="text-xs font-600 text-gray-900">
                Termin jetzt festlegen
              </p>
              <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                Wenn die Zeit schon abgemacht ist. Der Platz wird sofort
                gebucht.
              </p>
            </button>
          </div>

          {quelle === "planung" && (
            <p className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-snug">
              Der Schüler erscheint danach unter Terminplanung als wartend. Ist
              gerade keine Runde offen, kannst du ihn dort einzeln einpassen
              oder nach seinen Zeiten fragen.
            </p>
          )}

          {quelle === "jetzt" && (
          <>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={plaetzeSuchen}
              disabled={ladend}
              className="text-xs font-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              {ladend && <Loader2 className="w-3 h-3 animate-spin" />}
              {angebote ? "Neu suchen" : "Freie Termine suchen"}
            </button>
          </div>

          {angebote && angebote.length === 0 && !ladend && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Kein Termin über die ganze Laufzeit frei.
            </p>
          )}

          {angebote && angebote.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {angebote.slice(0, 10).map((a) => {
                const aktiv =
                  platz?.weekday === a.weekday &&
                  platz?.time === a.time &&
                  platz?.parity === a.parity;
                return (
                  <button
                    key={`${a.weekday}-${a.time}-${a.parity}`}
                    type="button"
                    onClick={() => {
                      setPlatz(a);
                      vorschauLaden(a.weekday);
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors ${
                      aktiv
                        ? "border-[#1C244B] bg-[#1C244B]/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="font-600 text-gray-900">{a.beschreibung}</p>
                  </button>
                );
              })}
            </div>
          )}

          {platz && (
            <>
              <input type="hidden" name="fixplatz_weekday" value={platz.weekday} />
              <input type="hidden" name="fixplatz_time" value={platz.time} />
              {platz.parity != null && (
                <input type="hidden" name="fixplatz_week_parity" value={platz.parity} />
              )}
            </>
          )}
          </>
          )}
        </div>
      )}

      {bookingMode === "flex" && !vorschau && (
        <button
          type="button"
          onClick={() => vorschauLaden(3)}
          disabled={ladend}
          className="text-xs font-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-1.5"
        >
          {ladend && <Loader2 className="w-3 h-3 animate-spin" />}
          Preis berechnen
        </button>
      )}

      {vorschau && (
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 space-y-1">
          <p className="font-600 text-gray-900">
            {vorschau.lektionen} Lektionen · {formatCHF(vorschau.monatsbetrag)} pro
            Monat · total {formatCHF(vorschau.gesamtpreis)}
          </p>
          <p>
            {formatDay(vorschau.periodeStart)}, {formatDay(vorschau.periodeEnde)} ·{" "}
            {formatCHF(vorschau.preisProLektion)} pro Lektion
          </p>
          {vorschau.ferientage.length > 0 && (
            <p className="text-gray-500">
              {vorschau.ferientage.length} Termine fallen auf Ferien und sind bereits
              abgezogen.
            </p>
          )}
        </div>
      )}

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          name="auto_renew"
          checked={autoRenew}
          onChange={(e) => setAutoRenew(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1C244B] focus:ring-[#1C244B]"
        />
        <span className="text-xs text-gray-600 leading-snug">
          Automatisch verlängern, das Abo geht am Ende der Periode mit demselben
          Platz weiter. Der Schüler kann das im Portal abschalten.
        </span>
      </label>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={
            isPending ||
            (bookingMode === "fix" && quelle === "jetzt" && !platz)
          }
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Abo anlegen"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
      {bookingMode === "fix" && quelle === "jetzt" && !platz && (
        <p className="text-xs text-gray-400">
          Zuerst einen freien Termin auswählen.
        </p>
      )}
    </form>
  );
}

/**
 * Lektionspaket anlegen.
 *
 * Anders als beim Abo wird der ganze Betrag beim Anlegen in Rechnung gestellt
 *, das ist der Grund, warum man ein Paket überhaupt verkauft: das Geld ist
 * da, bevor die Lektionen stattfinden. Es läuft aus, wenn die Lektionen
 * aufgebraucht sind, und verlängert sich nicht von selbst.
 */
function PaketForm({
  schueler_id,
  student_user_id,
  preise,
  onZurueck,
  onFertig,
}: {
  schueler_id: string;
  student_user_id: string;
  preise?: PaketPreise;
  onZurueck: () => void;
  onFertig: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [typ, setTyp] = useState<"single" | "10er" | "20er">("10er");
  const [rhythmus, setRhythmus] = useState<Rhythmus>("woechentlich");
  const [bookingMode, setBookingMode] = useState<BookingMode>("flex");
  // Vorbelegt auf „pro Lektion": Das ist der Fall der bestehenden Schüler,
  // und die falsche Voreinstellung verschickt sofort eine Rechnung.
  const [abrechnung, setAbrechnung] = useState<"pro_lektion" | "einmalig">(
    "pro_lektion",
  );

  const lektionen = typ === "single" ? 1 : typ === "10er" ? 10 : 20;

  // Der hinterlegte Preis je Pakettyp, plus Wegaufschlag. Dieselbe Rechnung
  // wie beim Abo, damit im Preisformular steht, was hier herauskommt.
  const basis =
    typ === "single"
      ? (preise?.price_single ?? 85)
      : typ === "10er"
        ? (preise?.price_10er ?? 75)
        : (preise?.price_20er ?? 70);
  const proLektion = basis + (preise?.travel_surcharge ?? 0);

  const [preisText, setPreisText] = useState(String(proLektion));

  // Beim Wechsel des Typs den hinterlegten Preis übernehmen, sonst bliebe
  // der Preis des vorher gewählten Pakets stehen und niemand merkt es.
  function typWechseln(neu: "single" | "10er" | "20er") {
    setTyp(neu);
    const b =
      neu === "single"
        ? (preise?.price_single ?? 85)
        : neu === "10er"
          ? (preise?.price_10er ?? 75)
          : (preise?.price_20er ?? 70);
    setPreisText(String(b + (preise?.travel_surcharge ?? 0)));
    if (neu === "single") setBookingMode("flex");
  }

  const gesamt = (Number(preisText) || 0) * lektionen;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createPackageAdmin(formData);
      if (result?.error) setError(result.error);
      else onFertig();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-600 text-gray-900">Neues Paket</h3>
        <button
          type="button"
          onClick={onZurueck}
          className="text-xs text-gray-500 hover:text-gray-900 underline"
        >
          Doch ein Abo
        </button>
      </div>

      <input type="hidden" name="student_user_id" value={student_user_id} />
      <input type="hidden" name="schueler_id" value={schueler_id} />
      <input type="hidden" name="billing_mode" value={abrechnung} />

      {/*
        Wann bezahlt wird. Vorher stand hier ein verstecktes Feld auf
        „Gesamtbetrag beim Anlegen" — wer ein Paket anlegte, verschickte
        damit ungewollt eine Rechnung über den vollen Betrag. Für alle
        bestehenden Schüler ist das falsch: Sie zahlen nach der Lektion.
      */}
      <div className="space-y-1.5">
        <label className="text-xs font-500 text-gray-600">Bezahlung</label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              {
                wert: "pro_lektion" as const,
                titel: "Pro Lektion",
                text: "Nach jeder Lektion einzeln abrechnen. Jetzt keine Rechnung.",
              },
              {
                wert: "einmalig" as const,
                titel: "Im Voraus",
                text: "Gesamtbetrag sofort in Rechnung stellen, 15 Tage Frist.",
              },
            ]
          ).map((o) => (
            <button
              key={o.wert}
              type="button"
              onClick={() => setAbrechnung(o.wert)}
              className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                abrechnung === o.wert
                  ? "border-[#1C244B] bg-[#1C244B]/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="text-xs font-700 text-gray-900">{o.titel}</p>
              <p className="text-[11px] text-gray-500 leading-snug mt-0.5">
                {o.text}
              </p>
            </button>
          ))}
        </div>
        {abrechnung === "pro_lektion" && (
          <p className="text-[11px] text-gray-500 leading-snug">
            Abgerechnet wird unter <strong>Zahlungen → Offene Lektionen</strong>,
            sobald die Lektion stattgefunden hat.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">Paket</label>
          <select
            name="type"
            value={typ}
            onChange={(e) => typWechseln(e.target.value as "single" | "10er" | "20er")}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="single">Einzellektion</option>
            <option value="10er">10er-Paket</option>
            <option value="20er">20er-Paket</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-500 text-gray-600">
            Preis pro Lektion (CHF)
          </label>
          <Input
            name="price_per_lesson"
            type="number"
            step="0.01"
            min="0"
            value={preisText}
            onChange={(e) => setPreisText(e.target.value)}
            required
          />
        </div>
      </div>

      {typ !== "single" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">Rhythmus</label>
            <select
              name="rhythmus"
              value={rhythmus}
              onChange={(e) => setRhythmus(e.target.value as Rhythmus)}
              className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="woechentlich">Jede Woche</option>
              <option value="zweiwoechentlich">Alle zwei Wochen</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">Buchungsart</label>
            <select
              name="booking_mode"
              value={bookingMode}
              onChange={(e) => setBookingMode(e.target.value as BookingMode)}
              className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="flex">Flexibel, bucht selbst</option>
              <option value="fix">Fixplatz, Termin folgt aus der Planung</option>
            </select>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 space-y-1">
        <p className="font-600 text-gray-900">
          {lektionen} Lektion{lektionen === 1 ? "" : "en"} ·{" "}
          {formatCHF(Number(preisText) || 0)} pro Lektion · total{" "}
          {formatCHF(gesamt)}
        </p>
        <p>
          Der Gesamtbetrag wird beim Anlegen in Rechnung gestellt, zahlbar
          innert 15 Tagen. Das Paket endet, wenn die Lektionen aufgebraucht
          sind, es verlängert sich nicht.
        </p>
        {typ === "single" && (
          <p className="text-gray-500">
            Bei einer Einzellektion gibt es weder Rhythmus noch Fixplatz.
          </p>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Paket anlegen"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onFertig}>
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
      if (result && "error" in result && result.error) setError(result.error ?? null);
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
      {/* Nicht ins Blaue tippen: Die Engine kennt die freien Slots und die
          Route kennt ihre Kosten. Ein Klick übernimmt die Zeit ins Feld. */}
      <GuenstigeSlots studentUserId={student_user_id} onPick={setStart} />
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

function ProposalForm({
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
      const result = await createProposal(formData);
      if (result && "error" in result && result.error) setError(result.error ?? null);
      else {
        setOpen(false);
        setStart("");
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
        <Send className="w-4 h-4" />
        Termin vorschlagen
      </button>
    );
  }

  const isSingle = lessonsCount === "1";

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-4 space-y-3 mb-4">
      <h3 className="text-sm font-600 text-gray-900">Termin vorschlagen</h3>
      <p className="text-xs text-gray-500">
        Der Schüler erhält eine E-Mail und bestätigt oder lehnt im Portal ab.
        Erst bei Annahme werden die Termine gebucht.
      </p>
      <GuenstigeSlots studentUserId={student_user_id} onPick={setStart} />
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
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Vorschlag senden"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

/** Admin zieht einen offenen Vorschlag zurück. */
function ProposalWithdraw({
  proposalId,
  schuelerId,
}: {
  proposalId: string;
  schuelerId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await withdrawProposal(proposalId, schuelerId);
          router.refresh();
        })
      }
      disabled={isPending}
      className="text-xs font-500 text-gray-500 hover:text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {isPending ? "…" : "Zurückziehen"}
    </button>
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
  const [verschiebenOffen, setVerschiebenOffen] = useState(false);
  const [neuerStart, setNeuerStart] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  if (status === "cancelled" || status === "completed" || status === "no_show") return null;

  function verschieben() {
    if (!neuerStart) {
      setFehler("Bitte Datum und Zeit wählen.");
      return;
    }
    setFehler(null);
    startTransition(async () => {
      const res = await moveAppointment(
        appointmentId,
        schuelerId,
        new Date(neuerStart).toISOString()
      );
      if (res && "error" in res && res.error) {
        setFehler(res.error);
        return;
      }
      setVerschiebenOffen(false);
      setNeuerStart("");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-1.5">
      <button
        disabled={isPending}
        onClick={() => setVerschiebenOffen(true)}
        className="p-1.5 rounded-lg hover:bg-[#1C244B]/5 text-gray-400 hover:text-[#1C244B] transition-colors"
        title="Verschieben"
      >
        <CalendarClock className="w-3.5 h-3.5" />
      </button>

      {/* Als Overlay statt in der Tabellenzeile: Das Formular braucht
          Platz für die günstigen Zeiten, und eine aufklappende Zeile würde
          die ganze Tabelle zerreissen. */}
      {verschiebenOffen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setVerschiebenOffen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-3 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-600 text-gray-900">Termin verschieben</h3>
            <p className="text-xs text-gray-500 leading-snug">
              Der Schüler bekommt eine Mail mit dem neuen Termin. Geprüft wird
              wie bei jeder Buchung — auch gegen deinen Apple-Kalender.
            </p>
            <GuenstigeSlots
              studentUserId={schuelerId}
              onPick={setNeuerStart}
            />
            <div className="space-y-1">
              <label className="text-xs font-500 text-gray-600">
                Neuer Zeitpunkt
              </label>
              <Input
                type="datetime-local"
                value={neuerStart}
                onChange={(e) => setNeuerStart(e.target.value)}
              />
            </div>
            {fehler && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {fehler}
              </p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={verschieben} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Verschieben"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVerschiebenOffen(false)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </div>
      )}
      <button
        disabled={isPending}
        onClick={() => {
          if (!confirm("Schüler als nicht erschienen markieren?")) return;
          startTransition(async () => {
            await markAppointmentNoShow(appointmentId, schuelerId);
            router.refresh();
          });
        }}
        className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
        title="Nicht erschienen"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <UserX className="w-3.5 h-3.5" />
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
      if (result && "error" in result) setCancelError(result.error ?? null);
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

function AdjustLessonsButton({
  packageId,
  currentTotal,
  currentUsed,
}: {
  packageId: string;
  currentTotal: number;
  currentUsed: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState<number>(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const preview = currentTotal + delta;

  function handle() {
    if (delta === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await adjustPackageLessons(packageId, delta);
      if (result?.error) {
        setError(result.error ?? null);
      } else {
        setOpen(false);
        setDelta(1);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
        title="Lektionen anpassen"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-700 text-gray-900">Lektionen anpassen</h3>
            <p className="text-sm text-gray-500">
              Aktuell: <span className="font-600 text-gray-900">{currentTotal}</span> Lektionen
              ({currentUsed} verbraucht)
            </p>

            <div className="space-y-2">
              <label className="text-sm font-500 text-gray-700">Anpassung (+ hinzufügen / − abziehen)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDelta((d) => d - 1)}
                  className="w-9 h-9 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-700 text-lg flex items-center justify-center"
                >
                  −
                </button>
                <input
                  type="number"
                  value={delta}
                  onChange={(e) => setDelta(parseInt(e.target.value) || 0)}
                  className="flex-1 text-center border border-gray-200 rounded-xl py-2 text-sm font-600 focus:outline-none focus:ring-2 focus:ring-[#1C244B]/20"
                />
                <button
                  type="button"
                  onClick={() => setDelta((d) => d + 1)}
                  className="w-9 h-9 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-700 text-lg flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            {delta !== 0 && (
              <div className={`rounded-xl p-3 text-sm ${
                preview < currentUsed || preview < 1
                  ? "bg-red-50 text-red-700"
                  : "bg-indigo-50 text-indigo-700"
              }`}>
                {preview < 1 || preview < currentUsed
                  ? "Ungültig, Mindestanzahl unterschritten."
                  : `Neu: ${currentTotal} → ${preview} Lektionen`}
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setOpen(false); setDelta(1); setError(null); }}
                disabled={isPending}
                className="px-4 py-2 text-sm font-500 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handle}
                disabled={isPending || delta === 0 || preview < 1 || preview < currentUsed}
                className="px-4 py-2 text-sm font-600 text-white bg-[#1C244B] hover:bg-[#1C244B]/90 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export {
  PackageTimerActions,
  AdjustLessonsButton,
  InvoiceAction,
  PreiseForm,
  PackageFormNew,
  DirektBuchung,
  ProposalForm,
  ProposalWithdraw,
  AppointmentActions,
};
export default SchuelerDetailActionsRoot;
