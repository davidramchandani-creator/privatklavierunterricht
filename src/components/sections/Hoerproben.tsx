"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Pause, Loader2, CalendarCheck } from "lucide-react";
import { formatDauer, type Hoerprobe } from "@/lib/hoerproben";
import Reveal from "@/components/Reveal";
import Klaviatur from "@/components/Klaviatur";
import { starteAnalyse, type Analyse } from "@/lib/audio-analyse";

/**
 * Hörproben mit Wellenform-Anzeige.
 *
 * Zwei Entscheidungen, die den Aufbau bestimmen:
 *
 * 1. **Alles gestapelt, kein Karussell.** Man soll auf einen Blick sehen, dass
 *    es mehrere Aufnahmen gibt. Ein Karussell versteckt genau das.
 *
 * 2. **Nur eine Aufnahme gleichzeitig.** Zwei übereinanderliegende Klavierstücke
 *    klingen nach Fehler, nicht nach Musik.
 */
export default function Hoerproben({ proben }: { proben: Hoerprobe[] }) {
  const [aktiv, setAktiv] = useState<string | null>(null);

  // Der Abschnitt verschwindet ganz, wenn es nichts zu hören gibt. Ein
  // „Bald verfügbar" wäre auf einer Verkaufsseite schädlicher als Schweigen.
  if (proben.length === 0) return null;

  return (
    <section id="hoerproben" className="py-16 md:py-24 bg-surface scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <p className="text-navy-600 font-600 text-xs uppercase tracking-widest mb-3">
            Hörproben
          </p>
          <h2 className="text-3xl sm:text-4xl font-800 text-navy-900 tracking-tight leading-[1.15]">
            Hör dir an, wie es klingt.
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed mt-4">
            Ein paar Aufnahmen aus dem Unterricht und von mir selbst. Damit du
            weisst, worauf du dich einlässt.
          </p>
        </Reveal>

        <Reveal delay={80} className="mt-10 bg-white rounded-2xl ring-1 ring-[#EAECEF] overflow-hidden">
          {proben.map((p, i) => (
            <ProbenZeile
              key={p.id}
              probe={p}
              istLetzte={i === proben.length - 1}
              aktiv={aktiv === p.id}
              onStart={() => setAktiv(p.id)}
              onStopp={() => setAktiv((v) => (v === p.id ? null : v))}
            />
          ))}
        </Reveal>

        {/*
          Die stärkste Stelle der ganzen Seite: Wer gerade zugehört hat, ist
          überzeugter als an jedem anderen Punkt. Ihn hier scrollen zu lassen,
          um etwas zu tun, verschenkt genau diesen Moment.
        */}
        <Reveal delay={160}>
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-navy-900 rounded-2xl px-5 sm:px-6 py-5">
            <div>
              <p className="text-white font-700">Klingt nach deinem Ding?</p>
              <p className="text-white/60 text-sm mt-0.5">
                In der Probelektion spielen wir zusammen — unverbindlich, kein
                Abo nötig.
              </p>
            </div>
            <Link
              href="/probelektion"
              className="flex-shrink-0 inline-flex items-center justify-center gap-2 bg-white text-navy-900 font-700 text-sm rounded-xl px-5 min-h-[44px] hover:bg-white/90 active:scale-[0.98] transition-all"
            >
              <CalendarCheck className="w-4 h-4" />
              Probelektion buchen
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Eine einzelne Hörprobe, die sich selbst verwaltet.
 *
 * Für Stellen ausserhalb der Startseite — etwa auf der Probelektionsseite,
 * wo eine Aufnahme daran erinnert, warum man überhaupt hier ist. Dort gibt
 * es keine Geschwister, mit denen sie sich abstimmen müsste.
 */
export function HoerprobeEinzeln({ probe }: { probe: Hoerprobe }) {
  const [laeuft, setLaeuft] = useState(false);
  return (
    <div className="bg-white rounded-2xl ring-1 ring-[#EAECEF] overflow-hidden">
      <ProbenZeile
        probe={probe}
        istLetzte
        aktiv={laeuft}
        onStart={() => setLaeuft(true)}
        onStopp={() => setLaeuft(false)}
      />
    </div>
  );
}

function ProbenZeile({
  probe,
  istLetzte,
  aktiv,
  onStart,
  onStopp,
}: {
  probe: Hoerprobe;
  istLetzte: boolean;
  aktiv: boolean;
  onStart: () => void;
  onStopp: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [position, setPosition] = useState(0);
  const [dauer, setDauer] = useState(probe.dauer);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState(false);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  // createMediaElementSource darf je Element nur einmal laufen – ein zweiter
  // Aufruf wirft, und ab dann ist der Ton weg.
  const analyseGestartet = useRef(false);

  // AudioContext schliessen, wenn die Zeile verschwindet – ein offener
  // Kontext je Aufnahme summiert sich, und Browser begrenzen die Anzahl.
  useEffect(() => {
    return () => analyse?.schliessen();
  }, [analyse]);

  // Sobald eine andere Aufnahme startet, hält diese an. Der Zustand liegt
  // eine Ebene höher, damit es genau eine Wahrheit gibt, was gerade läuft.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!aktiv && !el.paused) {
      el.pause();
    }
  }, [aktiv]);

  async function umschalten() {
    const el = audioRef.current;
    if (!el || fehler) return;

    if (!el.paused) {
      el.pause();
      onStopp();
      return;
    }

    onStart();
    setLaedt(true);

    // Erst hier, nicht beim Aufbau der Seite: Ein AudioContext je Aufnahme
    // im Voraus wäre vier schlafende Kontexte für nichts, und Browser
    // erlauben ihn ohnehin erst nach einer Geste. Der Klick ist die Geste.
    if (!analyseGestartet.current) {
      analyseGestartet.current = true;
      setAnalyse(starteAnalyse(el));
    }

    try {
      await el.play();
    } catch {
      // Manche Browser weisen das Abspielen ab, wenn es nicht direkt aus
      // einer Geste kommt. Dann bleibt der Knopf stehen, statt still zu
      // versagen.
      setFehler(true);
      onStopp();
    } finally {
      setLaedt(false);
    }
  }

  function springen(anteil: number) {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.max(0, Math.min(1, anteil)) * el.duration;
    setPosition(el.currentTime);
  }

  const fortschritt = dauer > 0 ? position / dauer : 0;

  return (
    <div
      className={`px-4 sm:px-5 py-4 transition-colors ${
        istLetzte ? "" : "border-b border-[#EAECEF]"
      } ${aktiv ? "bg-navy-50/40" : "hover:bg-navy-50/30"}`}
    >
      <audio
        ref={audioRef}
        src={probe.datei}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDauer(d);
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onEnded={() => {
          setPosition(0);
          onStopp();
        }}
        onError={() => setFehler(true)}
      />

      {/*
        Auf dem Handy gestapelt statt nebeneinander.

        Vorher lag alles in einer Zeile: Knopf, Titel, Wellenform, Dauer. Auf
        einem 375-Pixel-Bildschirm blieben der Wellenform 75 Pixel — für
        etwas, das 144 bräuchte. Sie war auf die Hälfte gequetscht und die
        Bewegung darin praktisch unsichtbar. Ab sm liegt wieder alles in
        einer Zeile, dort ist der Platz da.
      */}
      <div className="flex items-center gap-4">
        <button
          onClick={umschalten}
          disabled={fehler}
          aria-label={`${probe.titel} ${aktiv ? "pausieren" : "abspielen"}`}
          className="w-12 h-12 rounded-full bg-navy-900 text-white flex items-center justify-center flex-shrink-0 hover:bg-navy-800 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {laedt ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : aktiv ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>

        <div className="min-w-0 flex-1 sm:flex-none sm:w-60">
          <p className="text-base font-600 text-navy-900 truncate">{probe.titel}</p>
          <p className="text-sm text-gray-400 truncate">
            {fehler ? "Aufnahme nicht verfügbar" : probe.herkunft}
          </p>
        </div>

        <div className="hidden sm:flex flex-1 min-w-0 items-center gap-4">
          <Wellenform
            werte={probe.wellenform}
            fortschritt={fortschritt}
            laeuft={aktiv}
            dauer={dauer}
            position={position}
            titel={probe.titel}
            onSpringen={springen}
          />
        </div>

        <span className="text-sm tabular-nums text-gray-400 flex-shrink-0 w-11 text-right">
          {formatDauer(aktiv ? position : dauer)}
        </span>
      </div>

      {/* Handy: Wellenform über die volle Breite, darunter die Klaviatur. */}
      <div className="sm:hidden mt-3">
        <Wellenform
          werte={probe.wellenform}
          fortschritt={fortschritt}
          laeuft={aktiv}
          dauer={dauer}
          position={position}
          titel={probe.titel}
          onSpringen={springen}
        />
      </div>

      {/*
        Die Klaviatur erscheint nur, während gespielt wird — sie ist kein
        Bedienelement, sondern die Antwort auf „was passiert gerade".
        Dauerhaft sichtbar wäre sie vier stumme Tastaturen untereinander.
      */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          aktiv ? "h-14 mt-3 opacity-100" : "h-0 mt-0 opacity-0"
        }`}
        style={{ transitionTimingFunction: "var(--ease-out-soft)" }}
      >
        <Klaviatur analyse={analyse} laeuft={aktiv} className="h-14" />
      </div>
    </div>
  );
}

/**
 * Balkenwellenform mit Abspielkopf.
 *
 * Die Trefffläche ist bewusst höher als die Balken: Wer auf einem Handy an
 * eine Stelle springen will, trifft sonst zwischen zwei Balken hindurch.
 */
function Wellenform({
  werte,
  fortschritt,
  laeuft,
  dauer,
  position,
  titel,
  onSpringen,
}: {
  werte: number[];
  fortschritt: number;
  laeuft: boolean;
  dauer: number;
  position: number;
  titel: string;
  onSpringen: (anteil: number) => void;
}) {
  // Auf schmalen Geräten weniger Balken – sonst werden sie dünner als ein
  // Pixel und die Wellenform franst zu einem grauen Band aus.
  const [maxBalken, setMaxBalken] = useState(64);
  useEffect(() => {
    const messen = () => setMaxBalken(window.innerWidth < 640 ? 32 : 64);
    messen();
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, []);

  const schritt = Math.max(1, Math.ceil(werte.length / maxBalken));
  const balken = werte.filter((_, i) => i % schritt === 0);
  const kopfIndex = Math.floor(fortschritt * balken.length);

  function ausKlick(e: React.MouseEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    onSpringen((e.clientX - box.left) / box.width);
  }

  function ausTaste(e: React.KeyboardEvent<HTMLDivElement>) {
    if (dauer <= 0) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onSpringen((position + 5) / dauer);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSpringen((position - 5) / dauer);
    }
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`Position in ${titel}`}
      aria-valuemin={0}
      aria-valuemax={Math.round(dauer)}
      aria-valuenow={Math.round(position)}
      aria-valuetext={`${formatDauer(position)} von ${formatDauer(dauer)}`}
      onClick={ausKlick}
      onKeyDown={ausTaste}
      className="flex-1 min-w-0 h-12 flex items-center gap-[1.5px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-900 focus-visible:ring-offset-2 rounded"
    >
      {balken.map((h, i) => {
        const gespielt = i <= kopfIndex;
        // Nur die drei Balken direkt am Abspielkopf pulsieren. Alle zappeln
        // zu lassen sähe nach Equalizer aus statt nach Fortschritt.
        const amKopf = laeuft && Math.abs(i - kopfIndex) <= 2;
        return (
          <span
            key={i}
            className={`flex-1 rounded-full origin-center transition-colors duration-150 ${
              gespielt ? "bg-navy-900" : "bg-navy-100"
            } ${amKopf ? "animate-wave-pulse" : ""}`}
            style={{ height: `${Math.max(8, h * 100)}%` }}
          />
        );
      })}
    </div>
  );
}
