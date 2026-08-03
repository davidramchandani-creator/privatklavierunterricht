"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";

type PaketOption = "einzellektion" | "10er" | "20er";

interface PaketConfig {
  label: string;
  preis: number;
}

const PAKETE: Record<PaketOption, PaketConfig> = {
  einzellektion: { label: "Einzellektion", preis: 105 },
  "10er": { label: "10er-Paket", preis: 90 },
  "20er": { label: "20er-Paket", preis: 85 },
};

const ZIEL = "Sattleracherstrasse 59, 8413 Neftenbach, Schweiz";

interface GoogleMapsDistanceMatrixService {
  getDistanceMatrix(
    request: {
      origins: string[];
      destinations: string[];
      travelMode: string;
    },
    callback: (result: GoogleDistanceMatrixResult | null, status: string) => void
  ): void;
}

interface GoogleDistanceMatrixResult {
  rows: Array<{
    elements: Array<{
      status: string;
      distance: { text: string; value: number };
    }>;
  }>;
}

declare global {
  interface Window {
    google: {
      maps: {
        DistanceMatrixService: new () => GoogleMapsDistanceMatrixService;
        TravelMode: { DRIVING: string };
      };
    };
    initGoogleMaps?: () => void;
  }
}

export default function Preisrechner() {
  const [paket, setPaket] = useState<PaketOption>("einzellektion");
  const [adresse, setAdresse] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [result, setResult] = useState<string>("");
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastQuery = useRef({ adresse: "", paket: "" });

  // Load Google Maps
  useEffect(() => {
    if (window.google?.maps) {
      setMapsLoaded(true);
      return;
    }
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    window.initGoogleMaps = () => setMapsLoaded(true);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => {
      delete window.initGoogleMaps;
    };
  }, []);

  const berechne = useCallback(
    (addr: string, selectedPaket: PaketOption) => {
      if (!addr || addr.length < 5 || !mapsLoaded || !window.google?.maps) {
        setStatus("idle");
        setResult("");
        return;
      }
      if (
        lastQuery.current.adresse === addr &&
        lastQuery.current.paket === selectedPaket
      )
        return;

      lastQuery.current = { adresse: addr, paket: selectedPaket };
      setStatus("loading");

      new window.google.maps.DistanceMatrixService().getDistanceMatrix(
        {
          origins: [addr],
          destinations: [ZIEL],
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (res: GoogleDistanceMatrixResult | null, status: string) => {
          if (
            status !== "OK" ||
            !res ||
            res.rows[0].elements[0].status !== "OK"
          ) {
            setStatus("error");
            setResult("Adresse nicht gefunden. Bitte überprüfen.");
            return;
          }

          const distText = res.rows[0].elements[0].distance.text;
          const km = parseFloat(distText.replace(",", "."));
          const basis = PAKETE[selectedPaket].preis;

          // Wegvergütung (Preise-Seite): innerhalb von 5 km keine Wegkosten,
          // ab 5 km pro angefangene 5 km zusätzlich CHF 5.–
          const stufen = Math.max(0, Math.ceil((km - 5) / 5));
          const aufschlag = stufen * 5;

          if (aufschlag > 25) {
            setStatus("error");
            setResult("Die Entfernung ist leider zu weit für Hausunterricht.");
            return;
          }

          const gesamt = basis + aufschlag;
          const paketLabel = PAKETE[selectedPaket].label;

          if (km <= 5) {
            setResult(
              `${paketLabel} · ${km.toFixed(1)} km · CHF ${gesamt.toFixed(2)} (erste 5 km kostenlos)`
            );
          } else {
            setResult(
              `${paketLabel} · ${km.toFixed(1)} km · CHF ${gesamt.toFixed(2)}${
                aufschlag > 0 ? ` (inkl. ${aufschlag} CHF Wegkosten)` : ""
              }`
            );
          }
          setStatus("success");
        }
      );
    },
    [mapsLoaded]
  );

  function handleAdresseChange(val: string) {
    setAdresse(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!val || val.length < 5) {
      setStatus("idle");
      setResult("");
      lastQuery.current = { adresse: "", paket: "" };
      return;
    }
    debounceTimer.current = setTimeout(() => berechne(val, paket), 600);
  }

  function handlePaketChange(p: PaketOption) {
    setPaket(p);
    lastQuery.current = { adresse: "", paket: "" };
    if (adresse.length >= 5) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => berechne(adresse, p), 100);
    }
  }

  return (
    <section id="preise" className="py-24 bg-surface">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Header */}
        <p className="text-gray-400 font-600 text-xs uppercase tracking-widest mb-3">
          Preisrechner
        </p>
        <h2 className="text-3xl sm:text-4xl font-800 text-navy-900 mb-4 tracking-tight">
          Geschätzten Preis berechnen
        </h2>
        <p className="text-gray-500 mb-10">
          Gib deine Adresse ein und wähle ein Paket – ich zeige dir den
          Gesamtpreis inklusive allfälliger Wegkosten.
        </p>

        {/* Paket-Auswahl */}
        <div className="flex gap-3 justify-center flex-wrap mb-8">
          {(Object.entries(PAKETE) as [PaketOption, PaketConfig][]).map(
            ([key, val]) => (
              <button
                key={key}
                onClick={() => handlePaketChange(key)}
                className={`flex flex-col items-center px-5 py-3.5 rounded-xl border-2 transition-all duration-200 min-w-[130px] ${
                  paket === key
                    ? "border-navy-900 bg-navy-900 text-white shadow-md shadow-navy-900/20 -translate-y-0.5"
                    : "border-[#EAECEF] bg-white text-gray-700 hover:border-navy-900/40 hover:-translate-y-0.5"
                }`}
              >
                <span className="font-600 text-sm">{val.label}</span>
                <span
                  className={`text-xs mt-0.5 ${
                    paket === key ? "text-white/80" : "text-gray-400"
                  }`}
                >
                  CHF {val.preis}
                </span>
              </button>
            )
          )}
        </div>

        {/* Adress-Input */}
        <div className="relative max-w-lg mx-auto mb-6">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            value={adresse}
            onChange={(e) => handleAdresseChange(e.target.value)}
            placeholder="z. B. Musterstrasse 12, 8400 Winterthur"
            className="pl-11 h-12 text-base"
          />
        </div>

        {/* Ergebnis */}
        <div className="min-h-[56px] flex items-center justify-center">
          {status === "loading" && (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Berechne…</span>
            </div>
          )}
          {status === "success" && (
            <div className="inline-flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-5 py-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-600 text-sm">{result}</span>
            </div>
          )}
          {status === "error" && (
            <div className="inline-flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <span className="text-sm">{result}</span>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          * Ab 5 km Entfernung von Neftenbach fallen Wegkosten an. Der Preis ist
          eine Schätzung und kann geringfügig abweichen.
        </p>
      </div>
    </section>
  );
}
