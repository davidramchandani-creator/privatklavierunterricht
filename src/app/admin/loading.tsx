export default function AdminLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page title bar */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-gray-200 rounded-xl" />
        <div className="h-9 w-28 bg-gray-200 rounded-xl" />
      </div>

      {/* Card row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <div className="h-3 w-16 bg-gray-100 rounded" />
            <div className="h-7 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Main content card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="h-5 w-32 bg-gray-200 rounded-lg" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
            <div className="h-6 w-20 bg-gray-100 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Second card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div className="h-5 w-40 bg-gray-200 rounded-lg" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
