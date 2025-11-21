/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: Array<Array<{ transcript: string }>>;
}

const DEFAULT_KEY = "subha_count_v1";
const DEFAULT_PHRASES = ["سبحان الله", "الحمد لله", "الله أكبر"];

export default function VoiceSubha() {
  const [count, setCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(DEFAULT_KEY);
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch { return 0; }
  });
  const [listening, setListening] = useState(false);
  const [phrase, setPhrase] = useState<string>(DEFAULT_PHRASES[0]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [supported] = useState(() => {
    if (typeof window === 'undefined') return false;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SpeechRecognition;
  });
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
  if (!recognitionRef.current) return;

  const recognition = recognitionRef.current;
  recognition.onend = () => {
    if (listening) {
      try {
        recognition.start(); // أعد تشغيل التسجيل
      } catch (e) {
        console.warn("Failed to restart recognition", e);
      }
    }
  };
}, [listening]);


  useEffect(() => {
    try { localStorage.setItem(DEFAULT_KEY, String(count)); } catch {}
  }, [count]);

  function normalizeArabic(s: string) {
    return s
      .replace(/[ًٌٍَُِّْـ]/g, "")
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/[.,!?؛؟"'()«»]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findOccurrences(text: string, target: string) {
    if (!target) return 0;
    let count = 0;
    let pos = 0;
    while (true) {
      const index = text.indexOf(target, pos);
      if (index === -1) break;
      count++;
      pos = index + 1;
    }
    return count;
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const recognition: SpeechRecognition = new SpeechRecognition();
    recognition.lang = "ar-EG";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      const text = last[0].transcript.trim();
      setTranscript(text);

      try {
        const normalized = normalizeArabic(text);
        const target = normalizeArabic(phrase);
        const matches = findOccurrences(normalized, target);
        if (matches > 0) setCount((c) => c + matches);
      } catch (e) {
        console.error(e);
      }
    };

    recognition.onerror = (e: any) => {
      console.error("Speech error", e);
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {}
    };
  }, [phrase]);

  const start = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch (e) {
      console.warn(e);
    }
  };

  const stop = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {}
    setListening(false);
  };

  const toggle = () => {
    if (listening) stop(); else start();
  };

  const reset = () => {
    setCount(0);
    try { localStorage.removeItem(DEFAULT_KEY); } catch {}
  };

  const addManual = (n = 1) => setCount((c) => c + n);

  if (!supported) {
    return (
      <div className="min-h-screen bg-linear-to-br from-emerald-900 to-teal-900 text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">المتصفح لا يدعم التعرف على الصوت</h2>
          <p className="mt-4 text-sm text-gray-300">استخدم Chrome أو Edge على الهاتف أو سطح المكتب.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-900 to-teal-900 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">السبحة الصوتية</h1>
          <div className="text-sm text-emerald-200">حفظ تلقائي ✓</div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1 md:col-span-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-sm text-emerald-200 mb-2">الذكر المختار</div>
                  <select 
                    value={phrase} 
                    onChange={(e) => setPhrase(e.target.value)} 
                    className="p-2 rounded bg-white/5 border border-white/20 text-white cursor-pointer hover:bg-white/10 transition"
                  >
                    {DEFAULT_PHRASES.map((p) => (
                      <option key={p} value={p} className="bg-emerald-900">{p}</option>
                    ))}
                  </select>
                </div>

                <div className="text-center">
                  <div className="text-xs text-emerald-200 mb-1">العداد</div>
                  <div className="text-5xl md:text-6xl font-extrabold text-emerald-300">{count}</div>
                  <div className="mt-3 flex gap-2 justify-center">
                    <button 
                      onClick={() => addManual(-1)} 
                      className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition"
                    >
                      -
                    </button>
                    <button 
                      onClick={() => addManual(1)} 
                      className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-sm text-emerald-200 mb-2">آخر نص مسموع:</div>
                <div className="bg-white/5 rounded p-3 min-h-[60px] text-lg">
                  {transcript || <span className="text-gray-400">لا يوجد</span>}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mb-4">
                <button 
                  onClick={toggle} 
                  className={`px-6 py-3 rounded-lg font-semibold transition ${
                    listening 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {listening ? '⏸ إيقاف الاستماع' : '🎤 ابدأ الاستماع'}
                </button>
                <button 
                  onClick={reset} 
                  className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition"
                >
                  🔄 إعادة ضبط العداد
                </button>
              </div>

              <div className="text-xs text-emerald-200 bg-white/5 rounded p-3">
                💡 نصيحة: تحدث بوضوح وقل الذكر نفسه أكثر من مرة. التعرف على الكلام يعتمد على جودة الميكروفون والضوضاء المحيطة.
              </div>
            </div>
          </div>

          <aside className="bg-white/10 backdrop-blur-sm rounded-lg p-6 shadow-xl">
            <h3 className="font-semibold text-lg mb-4">إعدادات إضافية</h3>
            <div className="text-sm text-emerald-200 space-y-3">
              <div>• اللغة: <strong>العربية (مصر)</strong></div>
              <div>• الاستماع: مستمر</div>
              <div>• الحفظ: تلقائي</div>
            </div>

            <div className="mt-6">
              <button 
                onClick={() => { 
                  if (navigator?.share) {
                    navigator.share({ 
                      title: 'السبحة الصوتية', 
                      text: 'جرّب تطبيق السبحة الصوتية - عدّاد ذكر بالصوت' 
                    });
                  } else {
                    alert('مشاركة غير مدعومة في هذا المتصفح');
                  }
                }} 
                className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
              >
                📤 مشاركة التطبيق
              </button>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}