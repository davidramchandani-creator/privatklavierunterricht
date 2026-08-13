"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Echtzeit-Aktualisierung: lauscht auf Postgres-Änderungen der relevanten
 * Tabellen und ruft bei jeder Änderung (entprellt) router.refresh() auf, sodass
 * die Server-Komponenten frisch geladen werden, ohne manuelles Neuladen.
 *
 * RLS greift automatisch: Schüler erhalten nur Events zu ihren eigenen Zeilen,
 * der Admin zu allen.
 */
const TABLES = [
  "invoices",
  "appointments",
  "booking_requests",
  "proposals",
  "reschedule_requests",
  "packages",
  "absences",
] as const;

export default function RealtimeRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const scheduleRefresh = () => {
      if (timer.current) clearTimeout(timer.current);
      // kurzes Entprellen, damit mehrere gleichzeitige Änderungen ein Refresh ergeben
      timer.current = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase.channel("portal-realtime");
    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh
      );
    }
    channel.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
