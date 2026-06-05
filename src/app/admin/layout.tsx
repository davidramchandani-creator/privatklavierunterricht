import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import PwaInit from "@/components/PwaInit";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  themeColor: "#1C244B",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Admin – Klavierunterricht",
  },
};
import { logout } from "@/app/auth/actions";
import Logo from "@/components/layout/Logo";
import { AdminNavLinks } from "./_components/AdminNav";
import AdminBottomNav from "./_components/AdminBottomNav";
import AdminPageTransition from "./_components/AdminPageTransition";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  return (
    <>
    <PwaInit />
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100 text-[#1C244B]">
          <Logo className="h-7 w-auto" />
          <span className="font-700 text-[#1C244B] text-sm">Admin</span>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <AdminNavLinks />
        </nav>

        <div className="p-3 border-t border-gray-100">
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-500 text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              Abmelden
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 md:ml-60 flex flex-col min-h-screen">
        {/* Desktop top bar */}
        <header className="hidden md:flex bg-white border-b border-gray-200 h-14 items-center justify-between px-6 sticky top-0 z-20">
          <span className="text-sm font-500 text-gray-400">
            {user.email}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              Abmelden
            </button>
          </form>
        </header>

        <main className="flex-1 px-4 md:px-6 pb-28 md:pb-6 pt-[max(env(safe-area-inset-top),1rem)] md:pt-6">
          <AdminPageTransition>{children}</AdminPageTransition>
        </main>
      </div>

      <AdminBottomNav />
    </div>
    </>
  );
}
