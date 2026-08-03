import Link from "next/link";
import { LogOut, Bell } from "lucide-react";
import { logout } from "@/app/auth/actions";
import Logo from "@/components/layout/Logo";

/**
 * Minimale, kontextuelle Portal-Kopfzeile. Die Bereichs-Navigation übernimmt
 * die Tab-Leiste (PortalTabs); hier nur Marke + Abmelden.
 */
export default function PortalNav({ vorname }: { vorname?: string }) {
  return (
    <header
      className="liquid-glass-bar sticky top-0 z-40"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-navy-900">
          <Logo className="h-7 w-auto" />
          <span className="font-700 text-navy-900 text-[15px] tracking-tight">
            Mein Portal
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/benachrichtigungen"
            aria-label="Benachrichtigungen"
            title="Benachrichtigungen"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-500 text-gray-400 hover:text-navy-900 rounded-lg hover:bg-navy-50 transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
          </Link>

          <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-500 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Abmelden</span>
          </button>
          </form>
        </div>
      </div>
    </header>
  );
}
