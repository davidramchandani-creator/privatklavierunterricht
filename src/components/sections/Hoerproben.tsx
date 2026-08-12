"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { formatDauer, type Hoerprobe } from "@/lib/hoerproben";

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
    <section className="py-16 md:py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
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
        </div>

        <div className="mt-10 bg-white rounded-2xl ring-1 ring-[#EAECEF] overflow-hidden">
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
        </div>
      </div>
    </section>
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
      className={`flex items-center gap-4 px-4 sm:px-5 py-4 transition-colors ${
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

      <div className="min-w-0 w-40 sm:w-52 flex-shrink-0">
        <p className="text-base font-600 text-navy-900 truncate">{probe.titel}</p>
        <p className="text-sm text-gray-400 truncate">
          {fehler ? "Aufnahme nicht verfügbar" : probe.herkunft}
        </p>
      </div>

      <Wellenform
        werte={probe.wellenform}
        fortschritt={fortschritt}
        laeuft={aktiv}
        dauer={dauer}
        position={position}
        titel={probe.titel}
        onSpringen={springen}
      />

      <span className="text-sm tabular-nums text-gray-400 flex-shrink-0 w-11 text-right">
        {formatDauer(aktiv ? position : dauer)}
      </span>
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
