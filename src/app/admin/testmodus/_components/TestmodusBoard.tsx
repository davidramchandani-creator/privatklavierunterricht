"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FlaskConical,
  Loader2,
  Info,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  ArrowRight,
  Check,
} from "lucide-react";
import { TEST_SCHUELER, TEST_HINWEIS } from "@/lib/testdaten";
import {
  testdatenAnlegen,
  testdatenEntfernen,
  type TestStand,
} from "../actions";

export default function TestmodusBoard({ stand }: { stand: TestStand }) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const geschuetzt = stand.umleitung != null;

  function anlegen() {
    setFehler(null);
    setMeldung(null);
    startTransition(async () => {
      const res = await testdatenAnlegen();
      if (res.error) {
        setFehler(res.error);
        return;
      }
      if (!("angelegt" in res)) return;
      const teile: string[] = [];
      if (res.angelegt > 0) teile.push(`${res.angelegt} Testschüler angelegt.`);
      if (res.aufgefrischt > 0) {
        teile.push(
          `${res.aufgefrischt} vorhandene aufgefrischt — ihre Zeiten passen jetzt zu deinen Unterrichtstagen.`
        );
      }
      if (teile.length === 0) teile.push("Alles war bereits aktuell.");
      if (res.ohneKoordinaten.length > 0) {
        teile.push(
          `Ohne Koordinaten: ${res.ohneKoordinaten.join(", ")} — unter Routenplanung „Adressen auflösen“ drücken.`
        );
      }
      setMeldung(teile.join(" "));
      router.refresh();
    });
  }

  function entfernen() {
    if (
      !confirm(
        "Alle Testschüler samt Terminen, Abos und Rechnungen entfernen? Echte Schüler bleiben unberührt."
      )
    )
      return;
    setFehler(null);
    setMeldung(null);
    startTransition(async () => {
      const res = await testdatenEntfernen();
      if (res.error) {
        setFehler(res.error);
        return;
      }
      if (!("entfernt" in res)) return;
      setMeldung(`${res.entfernt} Testschüler entfernt.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Sicherungsstatus – das Wichtigste zuoberst */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 flex gap-3 ${
          geschuetzt
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        {geschuetzt ? (
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <p
            className={`font-600 ${
              geschuetzt ? "text-emerald-900" : "text-amber-900"
            }`}
          >
            {geschuetzt
              ? "Mail-Umleitung aktiv — kein Schüler bekommt Post"
              : "Mail-Umleitung aus — Mails gehen an echte Schüler"}
          </p>
          <div
            className={`text-sm leading-snug mt-1 space-y-1.5 ${
              geschuetzt ? "text-emerald-800" : "text-amber-800"
            }`}
          >
            {geschuetzt ? (
              <>
                <p>
                  Jede Mail geht an <strong>{stand.umleitung}</strong>, mit dem
                  echten Empfänger im Betreff. Das gilt für alles: Runden,
                  Einzelanfragen, Rechnungen, geplante Mails aus der Warteschlange.
                </p>
                <p className="font-600">
                  Wenn du fertig bist, muss EMAIL_REDIRECT_TO in Vercel wieder
                  weg — sonst bekommt nie wieder ein Schüler eine Mail.
                </p>
              </>
            ) : (
              <>
                <p>
                  Setze in Vercel die Umgebungsvariable{" "}
                  <code className="bg-white/60 px-1.5 py-0.5 rounded text-[13px]">
                    EMAIL_REDIRECT_TO
                  </code>{" "}
                  auf deine eigene Adresse und starte neu. Solange sie fehlt,
                  lege ich keine Testdaten an.
                </p>
                <p>
                  Ohne sie würde ein Probelauf echte Mails an deine{" "}
                  {stand.anzahlEcht} Schüler verschicken.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-[#F3F5F8] border border-[#E3E7EE] p-4 flex gap-3">
        <Info className="w-4 h-4 text-[#1C244B] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600 leading-snug space-y-1.5">
          <p>
            Testschüler sind <strong>ganz normale Schüler</strong> mit einem
            Merker — kein Sondermodus. Nur so testest du den Ablauf, den du
            später wirklich fährst.
          </p>
          <p>
            Sie erscheinen überall: in der Schülerliste, im Kalender, in der
            Routenplanung. Der Merker dient dazu, sie in einem Rutsch wieder zu
            entfernen und eine Runde wahlweise nur auf sie zu beschränken.
          </p>
          <p className="text-gray-500">
            Deine {stand.anzahlEcht} echten Schüler bleiben davon unberührt.
          </p>
        </div>
      </div>

      {/* Bestand */}
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-[#1C244B]" />
          <p className="font-600 text-[#1C244B]">
            Testschüler ({stand.anzahlTest})
          </p>
        </div>

        {stand.anzahlTest === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 leading-snug">
              Noch keine angelegt. Die fünf Fälle decken zusammen ab, woran die
              Planung scheitern kann:
            </p>
            <ul className="space-y-2">
              {TEST_SCHUELER.map((t) => (
                <li
                  key={t.adresse}
                  className="text-sm border border-gray-100 rounded-xl p-3"
                >
                  <p className="font-600 text-gray-900">
                    {t.vorname} {t.nachname}
                    <span className="font-400 text-gray-500">
                      {" "}
                      · {t.variante === "halbjahr" ? "Halbjahr" : "Jahr"},{" "}
                      {t.rhythmus === "woechentlich"
                        ? "wöchentlich"
                        : "alle zwei Wochen"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 flex items-start gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {t.adresse}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 leading-snug">
                    {t.zweck}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 leading-snug">{TEST_HINWEIS}</p>
            <button
              onClick={anlegen}
              disabled={isPending || !geschuetzt}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl px-5 min-h-[44px] hover:bg-[#151c3d] disabled:opacity-40"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Testschüler anlegen
            </button>
            {!geschuetzt && (
              <p className="text-xs text-gray-500">
                Gesperrt, solange die Mail-Umleitung nicht aktiv ist.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="divide-y divide-[#F1F3F6]">
              {stand.schueler.map((s) => (
                <li key={s.id} className="py-2.5 text-sm">
                  <p className="font-600 text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.adresse}</p>
                  <p className="text-xs text-gray-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className={s.hatKoordinaten ? "" : "text-amber-700"}>
                      {s.hatKoordinaten ? "✓ Koordinaten" : "⚠ keine Koordinaten"}
                    </span>
                    <span>{s.hatAbo ? "✓ Abo aktiv" : "kein Abo"}</span>
                    <span>{s.zeiten} Zeitfenster</span>
                    <span>{s.termine} Termine</span>
                  </p>
                </li>
              ))}
            </ul>

            <div className="rounded-xl bg-[#F3F5F8] p-3.5 space-y-2">
              <p className="text-sm font-600 text-[#1C244B]">So testest du</p>
              <ol className="text-sm text-gray-600 leading-snug space-y-1.5 list-decimal list-inside">
                <li>
                  <Link
                    href="/admin/planung"
                    className="text-[#1C244B] font-600 underline"
                  >
                    Terminplanung
                  </Link>{" "}
                  → Runde starten, Häkchen bei „Probelauf“. Nur diese fünf
                  bekommen die Anfrage.
                </li>
                <li>
                  Ihre Zeiten sind schon hinterlegt — du kannst direkt
                  „Zuteilung rechnen“ drücken und siehst das Ergebnis.
                </li>
                <li>
                  „Anwenden“ bucht die Termine. Danach unter{" "}
                  <Link
                    href="/admin/routenplanung"
                    className="text-[#1C244B] font-600 underline"
                  >
                    Routenplanung
                  </Link>{" "}
                  die Route ansehen.
                </li>
                <li>Zum Schluss hier alles wieder entfernen.</li>
              </ol>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/planung"
                className="inline-flex items-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl px-5 min-h-[44px] hover:bg-[#151c3d]"
              >
                Zur Terminplanung
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={anlegen}
                disabled={isPending || !geschuetzt}
                className="inline-flex items-center gap-2 text-sm font-600 border border-gray-200 rounded-xl px-4 min-h-[44px] active:bg-gray-50 disabled:opacity-40"
              >
                <Check className="w-4 h-4" />
                Ergänzen und auffrischen
              </button>
              <button
                onClick={entfernen}
                disabled={isPending}
                className="inline-flex items-center gap-2 text-sm font-600 text-red-700 border border-red-200 rounded-xl px-4 min-h-[44px] active:bg-red-50 disabled:opacity-40"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Alle Testdaten entfernen
              </button>
            </div>
          </div>
        )}

        {fehler && (
          <p className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3 leading-snug">
            {fehler}
          </p>
        )}
        {meldung && (
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 leading-snug">
            {meldung}
          </p>
        )}
      </div>
    </div>
  );
}
