import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Music, LogOut } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/auth/actions";
import AdminMobileMenu from "./_components/AdminMobileMenu";
import { AdminNavLinks } from "./_components/AdminNav";

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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100">
          <span className="w-8 h-8 rounded-lg bg-[#1C244B] flex items-center justify-center flex-shrink-0">
            <Music className="w-4 h-4 text-white" />
          </span>
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
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Top bar (mobile) */}
        <header className="md:hidden bg-white border-b border-gray-200 sticky top-0 z-20 h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#1C244B] flex items-center justify-center">
              <Music className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="font-700 text-[#1C244B] text-sm">Admin</span>
          </div>
          <AdminMobileMenu />
        </header>

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

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
