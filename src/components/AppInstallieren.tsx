"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Share, SquarePlus, X } from "lucide-react";
import {
  RUHEZEIT_TAGE,
  SPEICHERSCHLUESSEL,
  SPEICHERSCHLUESSEL_INSTALLIERT,
  darfHinweisZeigen,
  istIos,
  istStandalone,
  leseZeitstempel,
} from "@/lib/app-install";

/**
 * Das Ereignis, mit dem Chrome die Installation anbietet. Es steht nicht in
 * den TypeScript-Standardtypen, weil es kein Webstandard ist.
 */
type InstallEreignis = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Die Aufforderung, das Portal als App aufs Handy zu holen.
 *
 * Zwei Welten, die sich nicht angleichen lassen:
 *
 *   **Android und Chrome** melden über `beforeinstallprompt`, dass eine
 *   Installation möglich ist. Wir fangen das Ereignis ab, unterdrücken den
 *   Standardbalken des Browsers und zeigen stattdessen unseren eigenen
 *   Hinweis. Ein Tippen auf „Installieren" öffnet den echten Dialog.
 *
 *   **iOS** kennt dieses Ereignis nicht und wird es nach Lage der Dinge auch
 *   nicht bekommen. Dort führt der einzige Weg über das Teilen-Menü von
 *   Safari, weshalb es hier nur eine Anleitung gibt und keinen Knopf.
 *
 * Alles andere, also Desktop-Browser und Browser ohne Installationsweg,
 * bekommt bewusst nichts zu sehen. Eine Aufforderung, die man nicht
 * befolgen kann, ist schlimmer als keine.
 */
export default function AppInstallieren() {
  const [sichtbar, setSichtbar] = useState(false);
  const [ios, setIos] = useState(false);
  const [ereignis, setEreignis] = useState<InstallEreignis | null>(null);
  const [anleitungOffen, setAnleitungOffen] = useState(false);

  const wegLegen = useCallback((dauerhaft: boolean) => {
    setSichtbar(false);
    try {
      if (dauerhaft) {
        window.localStorage.setItem(SPEICHERSCHLUESSEL_INSTALLIERT, "1");
      } else {
        window.localStorage.setItem(SPEICHERSCHLUESSEL, String(Date.now()));
      }
    } catch {
      // Privater Modus ohne Speicher. Dann erscheint der Hinweis eben
      // beim nächsten Mal wieder, das ist verkraftbar.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mobil = window.matchMedia("(max-width: 768px)").matches;
    const standalone = istStandalone(
      window.matchMedia("(display-mode: standalone)").matches,
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
    );

    let weggeklicktAm: number | null = null;
    let bereitsInstalliert = false;
    try {
      weggeklicktAm = leseZeitstempel(
        window.localStorage.getItem(SPEICHERSCHLUESSEL),
      );
      bereitsInstalliert =
        window.localStorage.getItem(SPEICHERSCHLUESSEL_INSTALLIERT) === "1";
    } catch {
      // Speicher nicht verfügbar, dann gelten die Vorgaben.
    }

    const erlaubt = darfHinweisZeigen({
      istMobil: mobil,
      standalone,
      bereitsInstalliert,
      weggeklicktAm,
      jetzt: Date.now(),
    });
    if (!erlaubt) return;

    const aufIos = istIos(
      window.navigator.userAgent,
      window.navigator.maxTouchPoints ?? 0,
    );

    // Kurz warten, damit der Hinweis nicht mitten in den Seitenaufbau
    // platzt. Er soll auffallen, nicht überfallen.
    let timer: ReturnType<typeof setTimeout> | null = null;

    function beiInstallAngebot(e: Event) {
      e.preventDefault();
      setEreignis(e as InstallEreignis);
      timer = setTimeout(() => setSichtbar(true), 1200);
    }

    function beiInstalliert() {
      setSichtbar(false);
      try {
        window.localStorage.setItem(SPEICHERSCHLUESSEL_INSTALLIERT, "1");
      } catch {
        // Ohne Speicher fragt der Browser selbst nicht mehr, das genügt.
      }
    }

    window.addEventListener("beforeinstallprompt", beiInstallAngebot);
    window.addEventListener("appinstalled", beiInstalliert);

    // Auf iOS kommt kein Ereignis, auf das wir warten könnten.
    if (aufIos) {
      timer = setTimeout(() => {
        setIos(true);
        setSichtbar(true);
      }, 1200);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", beiInstallAngebot);
      window.removeEventListener("appinstalled", beiInstalliert);
      if (timer) clearTimeout(timer);
    };
  }, []);

  async function installieren() {
    if (!ereignis) return;
    setSichtbar(false);
    await ereignis.prompt();
    const { outcome } = await ereignis.userChoice;
    setEreignis(null);
    wegLegen(outcome === "accepted");
  }

  if (!sichtbar) return null;

  return (
    <div
      role="dialog"
      aria-label="App installieren"
      className="md:hidden fixed inset-x-0 bottom-0 z-50 animate-enter-up"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="m-3 rounded-2xl bg-white border border-[#EAECEF] shadow-[0_8px_30px_rgba(28,36,75,0.18)] overflow-hidden">
        <div className="p-4 flex items-start gap-3">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={44}
            height={44}
            className="rounded-xl shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="font-700 text-[#1C244B] leading-tight">
              Portal als App
            </p>
            <p className="text-sm text-gray-500 mt-0.5 leading-snug">
              Direkt vom Startbildschirm öffnen, ohne Umweg über den Browser.
            </p>
          </div>
          <button
            onClick={() => wegLegen(false)}
            aria-label="Hinweis schliessen"
            className="press w-8 h-8 -mt-1 -mr-1 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {ios && anleitungOffen && (
          <div className="px-4 pb-1 animate-fade-in">
            <ol className="space-y-2.5 text-sm text-gray-600">
              <li className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#F3F5F8] flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4 text-[#1C244B]" />
                </span>
                <span>
                  Unten in Safari auf <strong className="font-600">Teilen</strong> tippen
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#F3F5F8] flex items-center justify-center shrink-0">
                  <SquarePlus className="w-4 h-4 text-[#1C244B]" />
                </span>
                <span>
                  <strong className="font-600">Zum Home-Bildschirm</strong> wählen
                </span>
              </li>
            </ol>
          </div>
        )}

        <div className="p-4 pt-3 flex items-center gap-2">
          {ios ? (
            <button
              onClick={() =>
                anleitungOffen ? wegLegen(false) : setAnleitungOffen(true)
              }
              className="press flex-1 h-11 rounded-xl bg-[#1C244B] text-white font-600 text-sm"
            >
              {anleitungOffen ? "Alles klar" : "So gehts"}
            </button>
          ) : (
            <button
              onClick={installieren}
              className="press flex-1 h-11 rounded-xl bg-[#1C244B] text-white font-600 text-sm"
            >
              Installieren
            </button>
          )}
          <button
            onClick={() => wegLegen(false)}
            className="press h-11 px-4 rounded-xl text-gray-500 font-600 text-sm hover:bg-gray-50"
            title={`Für ${RUHEZEIT_TAGE} Tage ausblenden`}
          >
            Später
          </button>
        </div>
      </div>
    </div>
  );
}
