import { WifiOff } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#F3F5F8] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto">
          <WifiOff className="w-7 h-7 text-gray-400" />
        </div>
        <div>
          <h1 className="text-lg font-700 text-[#1C244B]">Keine Verbindung</h1>
          <p className="text-sm text-gray-500 mt-1">
            Du bist offline. Bitte prüfe deine Internetverbindung und versuche
            es erneut.
          </p>
        </div>
        <Link
          href="/schueler/portal"
          className="block w-full bg-[#1C244B] text-white text-sm font-600 py-2.5 rounded-xl hover:bg-[#151c3d] transition-colors"
        >
          Erneut versuchen
        </Link>
      </div>
    </div>
  );
}
