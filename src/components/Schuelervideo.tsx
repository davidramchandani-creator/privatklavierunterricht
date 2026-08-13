"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import type { Schuelervideo as VideoDaten } from "@/lib/schuelervideos";

/**
 * Ein Schülervideo.
 *
 * Vier Entscheidungen, die zusammengehören:
 *
 * **`preload="none"`.** Ohne das lädt jedes Video beim Seitenaufbau seine
 * ersten Sekunden — bei vier Videos mehrere Megabyte, bevor jemand auch nur
 * eines angesehen hat. Das Standbild zeigt derweil, worum es geht.
 *
 * **Standbild statt schwarzem Kasten.** Ein `<video>` ohne `poster` ist eine
 * schwarze Fläche. Vier davon nebeneinander sehen nach kaputter Seite aus.
 *
 * **Stumm starten.** Browser blockieren Autoplay mit Ton ohnehin. Wichtiger:
 * Hört man ein Kind lachen oder sprechen, ist die Stimme wieder ein
 * personenbezogenes Merkmal — wer den Ton will, schaltet ihn selbst ein.
 *
 * **Kein Autoplay beim Scrollen.** Ein Video, das von selbst losläuft, weil
 * man daran vorbeikommt, ist auf einer ruhigen Seite ein Fremdkörper.
 */
export default function Schuelervideo({
  video,
  laeuft,
  onStart,
  onStopp,
}: {
  video: VideoDaten;
  laeuft: boolean;
  onStart: () => void;
  onStopp: () => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [ton, setTon] = useState(false);
  const [fehler, setFehler] = useState(false);

  // Läuft ein anderes Video an, hält dieses an — zwei Klavierstücke
  // gleichzeitig klingen nach Fehler, nicht nach Musik.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!laeuft && !el.paused) el.pause();
  }, [laeuft]);

  async function umschalten() {
    const el = ref.current;
    if (!el || fehler) return;
    if (!el.paused) {
      el.pause();
      onStopp();
      return;
    }
    onStart();
    try {
      await el.play();
    } catch {
      setFehler(true);
      onStopp();
    }
  }

  return (
    <div className="group bg-white rounded-2xl border border-[#EAECEF] overflow-hidden hover:shadow-lg hover:shadow-navy-100/60 hover:-translate-y-1 transition-all duration-300">
      <div className="relative aspect-video bg-navy-900">
        <video
          ref={ref}
          src={video.datei}
          poster={video.poster}
          preload="none"
          muted={!ton}
          playsInline
          className="w-full h-full object-cover"
          onEnded={onStopp}
          onError={() => setFehler(true)}
        />

        {/* Abspielen: ganze Fläche, nicht nur ein kleiner Knopf. */}
        <button
          onClick={umschalten}
          disabled={fehler}
          aria-label={`${video.titel} ${laeuft ? "pausieren" : "abspielen"}`}
          className="absolute inset-0 flex items-center justify-center disabled:cursor-not-allowed"
        >
          <span
            className={`w-14 h-14 rounded-full bg-white/95 text-navy-900 flex items-center justify-center shadow-lg transition-all ${
              laeuft
                ? "opacity-0 group-hover:opacity-100 scale-90"
                : "opacity-100 group-hover:scale-105"
            }`}
          >
            {laeuft ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </span>
        </button>

        {/*
          Ton getrennt vom Abspielen. Wer nur sehen will, wie jemand spielt,
          soll das im Grossraumbüro tun können, ohne dass es alle hören.
        */}
        {laeuft && (
          <button
            onClick={() => setTon((t) => !t)}
            aria-label={ton ? "Ton ausschalten" : "Ton einschalten"}
            className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-navy-900/70 text-white flex items-center justify-center hover:bg-navy-900/90 transition-colors"
          >
            {ton ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        )}

        {fehler && (
          <p className="absolute inset-0 flex items-center justify-center text-white/70 text-sm px-4 text-center">
            Video nicht verfügbar
          </p>
        )}
      </div>

      <div className="p-5">
        <p className="font-700 text-navy-900">{video.titel}</p>
        <p className="text-sm text-gray-400 mt-0.5">{video.wer}</p>
      </div>
    </div>
  );
}
