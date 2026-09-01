"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import type { Schuelervideo as VideoDaten } from "@/lib/schuelervideos";
import { formatDauer } from "@/lib/dauer";

/**
 * Ein Schülervideo.
 *
 * Vier Entscheidungen, die zusammengehören:
 *
 * **`preload="none"`.** Ohne das lädt jedes Video beim Seitenaufbau seine
 * ersten Sekunden, bei vier Videos mehrere Megabyte, bevor jemand auch nur
 * eines angesehen hat. Das Standbild zeigt derweil, worum es geht.
 *
 * **Standbild statt schwarzem Kasten.** Ein `<video>` ohne `poster` ist eine
 * schwarze Fläche. Vier davon nebeneinander sehen nach kaputter Seite aus.
 *
 * **Stumm starten.** Browser blockieren Autoplay mit Ton ohnehin. Wichtiger:
 * Hört man ein Kind lachen oder sprechen, ist die Stimme wieder ein
 * personenbezogenes Merkmal, wer den Ton will, schaltet ihn selbst ein.
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

  // Läuft ein anderes Video an, hält dieses an. Zwei Klavierstücke
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

        {/*
          Auf dem Standbild liegt nichts ausser dem Abspielknopf.
          Vorher lagen hier ein dunkler Verlauf, die Wochenzahl und die
          Länge, zusammen so viel, dass man das Bild kaum noch sah. Ein
          Verlauf über einem Foto ist ausserdem der Griff, mit dem sich
          Bildunterschriften seit fünfzehn Jahren lesbar machen lassen; er
          sieht danach aus. Die Angaben stehen jetzt darunter, wo sie
          niemanden stören und trotzdem gelesen werden.
        */}

        {/* Abspielen: ganze Fläche, nicht nur ein kleiner Knopf. */}
        <button
          onClick={umschalten}
          disabled={fehler}
          aria-label={`${video.titel} ${laeuft ? "pausieren" : "abspielen"}`}
          className="absolute inset-0 flex items-center justify-center disabled:cursor-not-allowed"
        >
          {/*
            Dunkler, milchiger Kreis statt weisser Scheibe: Auf den hellen
            Standbildern verschwände Weiss auf Weiss. Kleiner als zuvor,
            er muss auffindbar sein, nicht das Bild beherrschen.
          */}
          <span
            className={`w-12 h-12 rounded-full bg-navy-900/50 backdrop-blur-md text-white flex items-center justify-center transition-all duration-300 ${
              laeuft
                ? "opacity-0 group-hover:opacity-100 scale-90"
                : "opacity-100 group-hover:scale-110 group-hover:bg-navy-900/70"
            }`}
          >
            {laeuft ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
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

      {/*
        Der Stand steht als Zeile über dem Titel, nicht auf dem Bild. Er
        bleibt damit das Erste, was man in diesem Block liest, denn er ist
        der Beweis; „Für Elise" allein ist keiner. Das Standbild bleibt
        dabei unverdeckt.
      */}
      <div className="p-5">
        <p className="text-[11px] font-700 uppercase tracking-[0.18em] text-navy-600">
          {video.stand}
        </p>
        <p className="font-700 text-navy-900 mt-1.5">{video.titel}</p>
        <p className="text-sm text-gray-400 mt-0.5">
          {video.name}
          <span className="mx-1.5 text-gray-300">·</span>
          <span className="tabular-nums">{formatDauer(video.dauer)}</span>
        </p>
      </div>
    </div>
  );
}
