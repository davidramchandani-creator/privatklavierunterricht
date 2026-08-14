import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PwaInit from "@/components/PwaInit";
import AppInstallieren from "@/components/AppInstallieren";
import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/manifest.json",
  themeColor: "#1C244B",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Klavierunterricht",
  },
};

export default async function SchuelerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <>
      <PwaInit />
      {children}
      <AppInstallieren />
    </>
  );
}
