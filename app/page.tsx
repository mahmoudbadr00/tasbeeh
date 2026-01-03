"use client";

import dynamic from "next/dynamic";

// Dynamic import with SSR disabled to prevent hydration issues
const VoiceSubha = dynamic(() => import("@/components/VoiceSubha"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              📿 السبحة الصوتية
            </h1>
            <p className="opacity-60 text-sm mt-1">عدّ أذكارك بصوتك</p>
          </div>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="backdrop-blur-sm rounded-2xl p-6 shadow-2xl bg-white/10 animate-pulse">
              <div className="h-12 bg-white/20 rounded-lg mb-4" />
              <div className="flex flex-col items-center mt-8">
                <div className="w-40 h-40 rounded-full bg-white/20" />
              </div>
              <div className="mt-6 h-24 bg-white/20 rounded-lg" />
              <div className="mt-6 h-14 bg-white/20 rounded-xl" />
            </div>
          </div>
          <aside className="space-y-6">
            <div className="bg-white/10 rounded-xl p-5 h-48 animate-pulse" />
            <div className="bg-white/10 rounded-xl p-5 h-32 animate-pulse" />
          </aside>
        </div>
      </div>
    </div>
  ),
});

export default function Home() {
  return <VoiceSubha />;
}