// Startseite – wird in der nächsten Phase mit echten Sektionen befüllt
export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen items-center justify-center bg-white">
      <div className="text-center space-y-4 px-6">
        <h1 className="text-4xl font-800 text-[#1C244B]">
          Spiel, was du fühlst –<br />
          <span className="text-[#C9A84C]">ich zeig dir wie.</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Individueller Klavierunterricht mit David, ganz ohne Schema F,
          dafür mit Gefühl und Verstand.
        </p>
        <p className="text-sm text-gray-400 mt-8">
          🚧 Website wird gerade aufgebaut – bald fertig!
        </p>
      </div>
    </main>
  );
}
