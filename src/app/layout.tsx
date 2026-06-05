import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SiteChrome from "@/components/layout/SiteChrome";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1C244B",
};

export const metadata: Metadata = {
  title: {
    default: "Klavierunterricht mit David – Neftenbach & Umgebung",
    template: "%s | David – Klavierunterricht",
  },
  description:
    "Individueller Klavierunterricht mit David in Neftenbach. Ohne Noten, ohne Schema F – mit Gefühl und Verstand. Probelektion buchen.",
  keywords: ["Klavierunterricht", "Neftenbach", "Winterthur", "Klavier", "Privatunterricht"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Klavierunterricht",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Spiel, was du fühlst – ich zeig dir wie.",
    description: "Individueller Klavierunterricht mit David, ganz ohne Schema F.",
    locale: "de_CH",
    type: "website",
    url: "https://privatklavierunterricht.ch",
  },
  metadataBase: new URL("https://privatklavierunterricht.ch"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${jakartaSans.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans antialiased">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
