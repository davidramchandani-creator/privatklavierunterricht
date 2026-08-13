"use client";

import { usePathname } from "next/navigation";

/**
 * Spielt bei jedem Routenwechsel im Admin-Bereich eine dezente
 * „Hochgleiten"-Animation, gibt dem Portal ein cleanes App-Gefühl.
 * Der `key` erzwingt das Neu-Mounten und damit den Animations-Restart.
 */
export default function AdminPageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-enter-up">
      {children}
    </div>
  );
}
