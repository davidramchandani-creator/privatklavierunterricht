"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const TRIGGER = 72; // px Zugweite, ab der aktualisiert wird
const MAX = 110; // maximale sichtbare Zugweite
const RESIST = 0.5; // Gummiband-Widerstand

/**
 * Pull-to-Refresh für die installierte PWA. Im Standalone-Modus ist die native
 * Browser-Geste deaktiviert – diese Komponente bildet sie nach und löst
 * router.refresh() aus, wodurch die Server-Komponenten (Termine, Zahlungen,
 * Pakete …) frisch geladen werden. Nur auf Touch-Geräten aktiv.
 */
export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    function setPullValue(v: number) {
      pullRef.current = v;
      setPull(v);
    }

    function onStart(e: TouchEvent) {
      if (refreshingRef.current) return;
      if (window.scrollY > 0) return;
      if (e.touches.length !== 1) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
    }

    function onMove(e: TouchEvent) {
      if (!active.current || startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;

      // Nach oben gescrollt oder nach oben gewischt → abbrechen
      if (dy <= 0 || window.scrollY > 0) {
        active.current = false;
        if (pullRef.current !== 0) setPullValue(0);
        return;
      }

      const dist = Math.min(MAX, dy * RESIST);
      setPullValue(dist);
      // verhindert natives Überscrollen/Bounce während wir ziehen
      if (e.cancelable) e.preventDefault();
    }

    function onEnd() {
      if (!active.current) return;
      active.current = false;
      startY.current = null;

      if (pullRef.current >= TRIGGER && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPullValue(TRIGGER);
        startTransition(() => router.refresh());
      } else {
        setPullValue(0);
      }
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  // Wenn router.refresh() durch ist, sanft zurückfedern
  useEffect(() => {
    if (!isPending && refreshingRef.current) {
      const t = setTimeout(() => {
        refreshingRef.current = false;
        setRefreshing(false);
        pullRef.current = 0;
        setPull(0);
      }, 280);
      return () => clearTimeout(t);
    }
  }, [isPending]);

  const progress = Math.min(1, pull / TRIGGER);
  const showIndicator = pull > 1 || refreshing;

  return (
    <>
      {/* Indikator schwebt oben, taucht beim Ziehen auf */}
      <div
        aria-hidden
        className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{
          top: "max(env(safe-area-inset-top), 6px)",
          opacity: showIndicator ? 1 : 0,
          transform: `translateY(${(refreshing ? TRIGGER : pull) - 44}px)`,
          transition: active.current ? "none" : "transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.2s",
        }}
      >
        <div
          className="liquid-glass rounded-full w-10 h-10 flex items-center justify-center"
          style={{ transform: `scale(${0.7 + progress * 0.3})` }}
        >
          <RefreshCw
            className="w-[18px] h-[18px] text-navy-900"
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
              animation: refreshing ? "ptr-spin 0.7s linear infinite" : undefined,
              opacity: 0.5 + progress * 0.5,
            }}
          />
        </div>
      </div>

      {/* Inhalt federt mit dem Zug nach unten */}
      <div
        style={{
          transform: `translateY(${refreshing ? TRIGGER * 0.5 : pull}px)`,
          transition: active.current ? "none" : "transform 0.28s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {children}
      </div>
    </>
  );
}
