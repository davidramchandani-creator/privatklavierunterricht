"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Check, AlertCircle, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  savePushSubscription,
  removePushSubscription,
  sendTestPush,
} from "@/lib/push-actions";

/** base64url (VAPID) → Uint8Array, wie von PushManager verlangt. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type State = "laden" | "nicht_unterstuetzt" | "ios_hinweis" | "aus" | "an" | "blockiert";

export default function PushToggle({
  vapidPublicKey,
}: {
  vapidPublicKey: string;
}) {
  const [state, setState] = useState<State>("laden");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!supported) {
        // iOS zeigt PushManager erst, wenn die PWA installiert ist.
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const standalone =
          window.matchMedia?.("(display-mode: standalone)").matches ||
          (window.navigator as { standalone?: boolean }).standalone === true;
        if (!cancelled) setState(isIos && !standalone ? "ios_hinweis" : "nicht_unterstuetzt");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setState("blockiert");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!cancelled) setState(sub ? "an" : "aus");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const aktivieren = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blockiert" : "aus");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const res = await savePushSubscription({
        endpoint: json.endpoint ?? sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });

      if ("error" in res && res.error) {
        setMsg(res.error);
        return;
      }
      setState("an");
      setMsg("Benachrichtigungen sind aktiviert.");
    } catch (err) {
      setMsg(
        err instanceof Error
          ? `Aktivierung fehlgeschlagen: ${err.message}`
          : "Aktivierung fehlgeschlagen."
      );
    } finally {
      setBusy(false);
    }
  }, [vapidPublicKey]);

  const deaktivieren = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("aus");
      setMsg("Benachrichtigungen sind deaktiviert.");
    } finally {
      setBusy(false);
    }
  }, []);

  const testen = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    const res = await sendTestPush();
    setMsg("error" in res && res.error ? res.error : "Test gesendet, schau auf dein Gerät.");
    setBusy(false);
  }, []);

  if (state === "laden") {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Prüfe Benachrichtigungen …
      </div>
    );
  }

  if (state === "ios_hinweis") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
        <p className="flex items-center gap-2 text-sm font-700 text-amber-900">
          <Share className="w-4 h-4" /> App zuerst installieren
        </p>
        <p className="text-sm text-amber-800 leading-relaxed">
          Auf dem iPhone funktionieren Benachrichtigungen nur, wenn du diese Seite
          zum Home-Bildschirm hinzufügst: unten auf <strong>Teilen</strong> tippen →
          <strong> Zum Home-Bildschirm</strong>. Danach die App von dort öffnen und
          Benachrichtigungen hier aktivieren.
        </p>
      </div>
    );
  }

  if (state === "nicht_unterstuetzt") {
    return (
      <p className="text-sm text-gray-500">
        Dieser Browser unterstützt keine Push-Benachrichtigungen. Du bekommst alles
        weiterhin per E-Mail.
      </p>
    );
  }

  if (state === "blockiert") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-1">
        <p className="flex items-center gap-2 text-sm font-700 text-red-900">
          <AlertCircle className="w-4 h-4" /> Benachrichtigungen blockiert
        </p>
        <p className="text-sm text-red-800 leading-relaxed">
          Du hast Benachrichtigungen für diese Seite abgelehnt. Erlaube sie in den
          Browser-Einstellungen (Schloss-Symbol in der Adresszeile) und lade die
          Seite neu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {state === "an" ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm font-600 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
              <Check className="w-3.5 h-3.5" /> Aktiv auf diesem Gerät
            </span>
            <Button variant="outline" size="sm" onClick={testen} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test senden"}
            </Button>
            <Button variant="ghost" size="sm" onClick={deaktivieren} disabled={busy}>
              <BellOff className="w-4 h-4 mr-1.5" /> Ausschalten
            </Button>
          </>
        ) : (
          <Button onClick={aktivieren} disabled={busy}>
            {busy ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Bell className="w-4 h-4 mr-1.5" />
            )}
            Benachrichtigungen aktivieren
          </Button>
        )}
      </div>
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
      <p className="text-xs text-gray-400 leading-relaxed">
        Gilt pro Gerät. E-Mails bekommst du unabhängig davon weiterhin.
      </p>
    </div>
  );
}
