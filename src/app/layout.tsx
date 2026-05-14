import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Klavierunterricht mit David – Neftenbach & Umgebung",
    template: "%s | David – Klavierunterricht",
  },
  description:
    "Individueller Klavierunterricht mit David in Neftenbach. Ohne Noten, ohne Schema F – mit Gefühl und Verstand. Probelektion buchen.",
  keywords: ["Klavierunterricht", "Neftenbach", "Winterthur", "Klavier", "Privatunterricht"],
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
        <Navbar />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
