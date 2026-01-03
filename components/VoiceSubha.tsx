"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ============================================================================
// Types & Interfaces
// ============================================================================

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventType) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventType) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
}

interface SpeechRecognitionEventType {
  resultIndex: number;
  results: SpeechRecognitionResultListType;
}

interface SpeechRecognitionResultListType {
  length: number;
  item(index: number): SpeechRecognitionResultType;
  [index: number]: SpeechRecognitionResultType;
}

interface SpeechRecognitionResultType {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternativeType;
  [index: number]: SpeechRecognitionAlternativeType;
}

interface SpeechRecognitionAlternativeType {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEventType extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
  webkitAudioContext?: typeof AudioContext;
}

interface WakeLockSentinelType {
  release(): Promise<void>;
  released: boolean;
  type: "screen";
  onrelease: ((event: Event) => void) | null;
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request(type: "screen"): Promise<WakeLockSentinelType>;
  };
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface DhikrItem {
  id: string;
  arabic: string;
  transliteration?: string;
  meaning?: string;
  targetCount?: number;
  category: "tasbih" | "istighfar" | "salawat" | "custom";
  isCustom?: boolean;
}

interface SessionRecord {
  id: string;
  date: string;
  dhikrId: string;
  dhikrText: string;
  count: number;
  duration: number;
}

interface Stats {
  totalCount: number;
  todayCount: number;
  streak: number;
  lastActiveDate: string;
  sessions: SessionRecord[];
}

interface ReminderSettings {
  enabled: boolean;
  times: string[];
  lastNotificationDate?: string;
}

interface AppSettings {
  theme: "light" | "dark" | "system";
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  reminders: ReminderSettings;
}

type RecognitionStatus =
  | "idle"
  | "starting"
  | "listening"
  | "processing"
  | "error"
  | "paused";

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  STATS: "voice_subha_stats_v2",
  SETTINGS: "voice_subha_settings_v2",
  CUSTOM_DHIKR: "voice_subha_custom_dhikr_v1",
  THEME: "voice_subha_theme_v1",
} as const;

const DEFAULT_DHIKR_LIST: DhikrItem[] = [
  {
    id: "subhanallah",
    arabic: "سبحان الله",
    transliteration: "Subhan Allah",
    meaning: "Glory be to Allah",
    targetCount: 33,
    category: "tasbih",
  },
  {
    id: "alhamdulillah",
    arabic: "الحمد لله",
    transliteration: "Alhamdulillah",
    meaning: "Praise be to Allah",
    targetCount: 33,
    category: "tasbih",
  },
  {
    id: "allahuakbar",
    arabic: "الله أكبر",
    transliteration: "Allahu Akbar",
    meaning: "Allah is the Greatest",
    targetCount: 33,
    category: "tasbih",
  },
  {
    id: "istighfar",
    arabic: "استغفر الله العظيم واتوب اليه",
    transliteration: "Astaghfirullah al-Azim wa atubu ilayh",
    meaning: "I seek forgiveness from Allah",
    targetCount: 100,
    category: "istighfar",
  },
  {
    id: "salawat",
    arabic: "اللهم صل وسلم وبارك على سيدنا محمد وعلى اله وصحبه وسلم",
    transliteration: "Allahumma salli wa sallim ala Sayyidina Muhammad",
    meaning: "O Allah, send blessings upon our Master Muhammad",
    targetCount: 100,
    category: "salawat",
  },
  {
    id: "lailaha",
    arabic: "لا اله الا الله",
    transliteration: "La ilaha illa Allah",
    meaning: "There is no god but Allah",
    targetCount: 100,
    category: "tasbih",
  },
  {
    id: "hawqala",
    arabic: "لا حول ولا قوة الا بالله",
    transliteration: "La hawla wa la quwwata illa billah",
    meaning: "There is no power except with Allah",
    targetCount: 100,
    category: "tasbih",
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  vibrationEnabled: true,
  soundEnabled: false,
  reminders: {
    enabled: false,
    times: ["08:00", "12:00", "20:00"],
  },
};

const RECOGNITION_CONFIG = {
  RESTART_DELAY: 50,
  MAX_RESTART_ATTEMPTS: 10,
  RESTART_BACKOFF_MS: 500,
  DEBOUNCE_MS: 300,
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

function normalizeArabic(text: string): string {
  return text
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[.,!?؛؟"'()«»،]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function countOccurrences(text: string, target: string): number {
  if (!target || !text) return 0;

  const normalizedText = normalizeArabic(text);
  const normalizedTarget = normalizeArabic(target);

  // For short dhikr (like "سبحان الله"), use exact matching
  const targetWords = normalizedTarget.split(" ").filter(Boolean);
  
  if (targetWords.length <= 3) {
    // Count non-overlapping exact matches
    let count = 0;
    let pos = 0;
    while (true) {
      const index = normalizedText.indexOf(normalizedTarget, pos);
      if (index === -1) break;
      count++;
      // Move past this match completely to avoid double counting
      pos = index + normalizedTarget.length;
    }
    return count;
  }

  // For longer dhikr, use similarity matching
  const similarity = calculateSimilarity(normalizedText, normalizedTarget);
  return similarity > 0.6 ? 1 : 0;
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.split(" ").filter(Boolean);
  const words2 = str2.split(" ").filter(Boolean);
  if (words2.length === 0) return 0;

  let matches = 0;
  for (const word of words2) {
    if (words1.some((w) => w.includes(word) || word.includes(w))) {
      matches++;
    }
  }
  return matches / words2.length;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins + ":" + secs.toString().padStart(2, "0");
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function isSameDay(date1: string, date2: string): boolean {
  return date1.split("T")[0] === date2.split("T")[0];
}

function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dateStr === yesterday.toISOString().split("T")[0];
}

// ============================================================================
// Custom Hooks
// ============================================================================

function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.warn("Error reading localStorage:", error);
    }
    setIsHydrated(true);
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(newValue));
        } catch (error) {
          console.warn("Error setting localStorage:", error);
        }
        return newValue;
      });
    },
    [key]
  );

  return [storedValue, setValue, isHydrated];
}

function useTheme() {
  const [theme, setTheme] = useLocalStorage<"light" | "dark" | "system">(
    STORAGE_KEYS.THEME,
    "dark"
  );
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const updateResolvedTheme = () => {
      if (theme === "system") {
        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setResolvedTheme(isDark ? "dark" : "light");
      } else {
        setResolvedTheme(theme);
      }
    };

    updateResolvedTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", updateResolvedTheme);

    return () => mediaQuery.removeEventListener("change", updateResolvedTheme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(resolvedTheme);
  }, [resolvedTheme, mounted]);

  return { theme, setTheme, resolvedTheme, mounted };
}

function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsSupported("Notification" in window);
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!isSupported || permission !== "granted") return null;

      try {
        const notification = new Notification(title, {
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-72x72.png",
          dir: "rtl",
          lang: "ar",
          ...options,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        return notification;
      } catch (error) {
        console.error("Error sending notification:", error);
        return null;
      }
    },
    [isSupported, permission]
  );

  const scheduleReminder = useCallback(
    (times: string[]) => {
      if (!isSupported || permission !== "granted") return;

      const now = new Date();

      times.forEach((time) => {
        const [hours, minutes] = time.split(":").map(Number);
        const reminderTime = new Date();
        reminderTime.setHours(hours, minutes, 0, 0);

        if (reminderTime > now) {
          const delay = reminderTime.getTime() - now.getTime();

          setTimeout(() => {
            sendNotification("📿 وقت الأذكار", {
              body: "حان وقت ذكر الله. اللهم اجعلنا من الذاكرين.",
              tag: "dhikr-reminder-" + time,
            });
          }, delay);
        }
      });
    },
    [isSupported, permission, sendNotification]
  );

  return {
    isSupported: mounted && isSupported,
    permission,
    requestPermission,
    sendNotification,
    scheduleReminder,
  };
}

function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinelType | null>(null);

  const requestWakeLock = useCallback(async () => {
    const nav = navigator as NavigatorWithWakeLock;
    if (nav.wakeLock) {
      try {
        wakeLockRef.current = await nav.wakeLock.request("screen");
      } catch (err) {
        console.warn("Wake Lock failed:", err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleVisibility = async () => {
      if (
        document.visibilityState === "visible" &&
        wakeLockRef.current === null
      ) {
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      releaseWakeLock();
    };
  }, [requestWakeLock, releaseWakeLock]);

  return { requestWakeLock, releaseWakeLock };
}

function useSpeechRecognition(
  onResult: (transcript: string, confidence: number) => void,
  language: string = "ar-EG"
) {
  const [status, setStatus] = useState<RecognitionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [mounted, setMounted] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isListeningRef = useRef(false);
  const restartAttemptsRef = useRef(0);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedTranscriptsRef = useRef<Set<string>>(new Set());
  const lastProcessedTimeRef = useRef<number>(0);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    setMounted(true);
  }, []);

  const supported = useMemo(() => {
    if (!mounted) return false;
    const win = window as WindowWithSpeechRecognition;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }, [mounted]);

  const cleanup = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, []);

  const createRecognition = useCallback(() => {
    if (!mounted) return null;
    
    const win = window as WindowWithSpeechRecognition;
    const SpeechRecognitionAPI = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return null;

    const recognition: SpeechRecognitionInstance = new SpeechRecognitionAPI();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    return recognition;
  }, [language, mounted]);

  const scheduleRestart = useCallback(() => {
    if (!isListeningRef.current) return;

    if (restartAttemptsRef.current >= RECOGNITION_CONFIG.MAX_RESTART_ATTEMPTS) {
      setError("فشل في إعادة تشغيل التعرف على الصوت. اضغط لإعادة المحاولة.");
      setStatus("error");
      restartAttemptsRef.current = 0;
      return;
    }

    const delay =
      RECOGNITION_CONFIG.RESTART_DELAY +
      restartAttemptsRef.current * RECOGNITION_CONFIG.RESTART_BACKOFF_MS;

    restartTimeoutRef.current = setTimeout(() => {
      if (isListeningRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          restartAttemptsRef.current++;
        } catch (e) {
          console.warn("Restart failed:", e);
          scheduleRestart();
        }
      }
    }, delay);
  }, []);

  const setupRecognition = useCallback(() => {
    const recognition = createRecognition();
    if (!recognition) return;

    recognition.onstart = () => {
      setStatus("listening");
      setError(null);
      restartAttemptsRef.current = 0;
    };

    recognition.onspeechstart = () => {
      setStatus("processing");
    };

    recognition.onspeechend = () => {
      if (isListeningRef.current) {
        setStatus("listening");
      }
    };

    recognition.onresult = (event: SpeechRecognitionEventType) => {
      let interimText = "";
      const now = Date.now();

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();

        if (result.isFinal && transcript) {
          // Debounce: prevent processing the same or similar transcript too quickly
          const timeSinceLastProcess = now - lastProcessedTimeRef.current;
          
          if (timeSinceLastProcess < RECOGNITION_CONFIG.DEBOUNCE_MS) {
            // Check if this is likely a duplicate
            const normalizedTranscript = normalizeArabic(transcript);
            if (processedTranscriptsRef.current.has(normalizedTranscript)) {
              continue;
            }
          }
          
          // Clear old transcripts after debounce period
          if (timeSinceLastProcess > RECOGNITION_CONFIG.DEBOUNCE_MS * 2) {
            processedTranscriptsRef.current.clear();
          }
          
          const normalizedTranscript = normalizeArabic(transcript);
          processedTranscriptsRef.current.add(normalizedTranscript);
          lastProcessedTimeRef.current = now;
          
          onResultRef.current(transcript, result[0].confidence);
        } else if (!result.isFinal) {
          interimText += transcript;
        }
      }

      setInterimTranscript(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventType) => {
      console.error("Speech error:", event.error);

      switch (event.error) {
        case "network":
          setError("خطأ في الشبكة. تحقق من اتصالك بالإنترنت.");
          break;
        case "not-allowed":
        case "service-not-allowed":
          setError("لم يتم السماح بالوصول للميكروفون.");
          setStatus("error");
          isListeningRef.current = false;
          return;
        case "no-speech":
          // Don't show error, just restart silently
          if (isListeningRef.current) scheduleRestart();
          return;
        case "aborted":
          return;
        case "audio-capture":
          setError("لا يمكن الوصول للميكروفون.");
          break;
        default:
          if (isListeningRef.current) {
            scheduleRestart();
            return;
          }
          setError("خطأ: " + event.error);
      }

      if (isListeningRef.current && event.error !== "aborted") {
        scheduleRestart();
      }
    };

    recognition.onend = () => {
      setInterimTranscript("");

      if (isListeningRef.current) {
        setStatus("starting");
        scheduleRestart();
      } else {
        setStatus("idle");
      }
    };

    recognitionRef.current = recognition;
  }, [createRecognition, scheduleRestart]);

  const start = useCallback(() => {
    if (!supported) {
      setError("المتصفح لا يدعم التعرف على الصوت");
      return;
    }

    cleanup();
    isListeningRef.current = true;
    restartAttemptsRef.current = 0;
    processedTranscriptsRef.current.clear();
    lastProcessedTimeRef.current = 0;

    if (!recognitionRef.current) {
      setupRecognition();
    }

    if (recognitionRef.current) {
      try {
        setStatus("starting");
        recognitionRef.current.start();
      } catch (e: unknown) {
        const err = e as { name?: string };
        if (err.name !== "InvalidStateError") {
          console.error("Start failed:", e);
          setError("فشل في بدء التعرف على الصوت");
        }
      }
    }
  }, [supported, cleanup, setupRecognition]);

  const stop = useCallback(() => {
    isListeningRef.current = false;
    cleanup();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Stop error:", e);
      }
    }

    setStatus("idle");
    setInterimTranscript("");
  }, [cleanup]);

  const restart = useCallback(() => {
    stop();
    setTimeout(start, 300);
  }, [stop, start]);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      cleanup();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [cleanup]);

  useEffect(() => {
    if (!mounted) return;
    
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isListeningRef.current) {
        if (status !== "listening" && status !== "processing") {
          restart();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [status, restart, mounted]);

  useEffect(() => {
    if (!mounted) return;
    
    if (recognitionRef.current) {
      const wasListening = isListeningRef.current;
      stop();
      recognitionRef.current = null;
      setupRecognition();
      if (wasListening) {
        setTimeout(start, 100);
      }
    }
  }, [language, mounted, setupRecognition, start, stop]);

  return {
    supported: mounted && supported,
    status,
    error,
    interimTranscript,
    isListening: status === "listening" || status === "processing",
    start,
    stop,
    restart,
    clearError: () => setError(null),
  };
}

// ============================================================================
// Sub Components
// ============================================================================

function StatusIndicator({ status }: { status: RecognitionStatus }) {
  const config: Record<
    RecognitionStatus,
    { color: string; text: string; pulse: boolean }
  > = {
    idle: { color: "bg-gray-400", text: "متوقف", pulse: false },
    starting: { color: "bg-yellow-400", text: "جاري البدء...", pulse: true },
    listening: { color: "bg-green-400", text: "يستمع", pulse: true },
    processing: { color: "bg-blue-400", text: "يعالج الكلام", pulse: true },
    error: { color: "bg-red-400", text: "خطأ", pulse: false },
    paused: { color: "bg-orange-400", text: "متوقف مؤقتاً", pulse: false },
  };

  const c = config[status];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={"w-3 h-3 rounded-full " + c.color} />
        {c.pulse && (
          <div
            className={
              "absolute inset-0 w-3 h-3 rounded-full animate-ping " + c.color
            }
          />
        )}
      </div>
      <span className="text-sm opacity-80">{c.text}</span>
    </div>
  );
}

function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  isDark,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  isDark: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset =
    circumference - (Math.min(progress, 100) / 100) * circumference;
  const gradientId = "progressGradient_" + size;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={"url(#" + gradientId + ")"}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-300"
      />
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ThemeToggle({
  theme,
  setTheme,
}: {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
}) {
  const themes: Array<{ value: "light" | "dark" | "system"; icon: string; label: string }> = [
    { value: "light", icon: "☀️", label: "فاتح" },
    { value: "dark", icon: "🌙", label: "داكن" },
    { value: "system", icon: "💻", label: "تلقائي" },
  ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-black/10 dark:bg-white/10">
      {themes.map((t) => (
        <button
          key={t.value}
          onClick={() => setTheme(t.value)}
          className={
            "px-3 py-1.5 rounded-md text-sm transition-all " +
            (theme === t.value
              ? "bg-emerald-500 text-white shadow-md"
              : "hover:bg-black/10 dark:hover:bg-white/10")
          }
          title={t.label}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

function DhikrSelector({
  dhikrList,
  selectedId,
  onSelect,
  disabled,
}: {
  dhikrList: DhikrItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const categories: Record<string, string> = {
    tasbih: "التسبيح والتهليل",
    istighfar: "الاستغفار",
    salawat: "الصلاة على النبي",
    custom: "أذكار مخصصة",
  };

  const groupedDhikr = useMemo(() => {
    const groups: Record<string, DhikrItem[]> = {};
    for (const dhikr of dhikrList) {
      if (!groups[dhikr.category]) {
        groups[dhikr.category] = [];
      }
      groups[dhikr.category].push(dhikr);
    }
    return groups;
  }, [dhikrList]);

  return (
    <div className="space-y-2">
      <label className="block text-sm opacity-80">اختر الذكر</label>
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled}
        className="w-full p-3 rounded-lg bg-black/10 dark:bg-white/10 border border-black/20 dark:border-white/20 focus:ring-2 focus:ring-emerald-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        {Object.entries(groupedDhikr).map(([category, items]) => (
          <optgroup
            key={category}
            label={categories[category] || category}
            className="bg-white dark:bg-gray-800"
          >
            {items.map((dhikr) => (
              <option
                key={dhikr.id}
                value={dhikr.id}
                className="bg-white dark:bg-gray-800 py-2"
              >
                {dhikr.arabic}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function AddCustomDhikrModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (dhikr: DhikrItem) => void;
}) {
  const [arabic, setArabic] = useState("");
  const [transliteration, setTransliteration] = useState("");
  const [meaning, setMeaning] = useState("");
  const [targetCount, setTargetCount] = useState(33);

  const handleSubmit = () => {
    if (!arabic.trim()) return;

    const newDhikr: DhikrItem = {
      id: "custom_" + generateId(),
      arabic: arabic.trim(),
      transliteration: transliteration.trim() || undefined,
      meaning: meaning.trim() || undefined,
      targetCount,
      category: "custom",
      isCustom: true,
    };

    onAdd(newDhikr);
    setArabic("");
    setTransliteration("");
    setMeaning("");
    setTargetCount(33);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-xl font-bold mb-4">إضافة ذكر مخصص</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm opacity-80 mb-1">
              الذكر بالعربية *
            </label>
            <input
              type="text"
              value={arabic}
              onChange={(e) => setArabic(e.target.value)}
              className="w-full p-3 rounded-lg bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 focus:ring-2 focus:ring-emerald-400"
              placeholder="مثال: سبحان الله وبحمده"
              dir="rtl"
            />
          </div>

          <div>
            <label className="block text-sm opacity-80 mb-1">
              النطق (اختياري)
            </label>
            <input
              type="text"
              value={transliteration}
              onChange={(e) => setTransliteration(e.target.value)}
              className="w-full p-3 rounded-lg bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 focus:ring-2 focus:ring-emerald-400"
              placeholder="Subhan Allah wa bihamdihi"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm opacity-80 mb-1">
              المعنى (اختياري)
            </label>
            <input
              type="text"
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              className="w-full p-3 rounded-lg bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 focus:ring-2 focus:ring-emerald-400"
              placeholder="Glory be to Allah and praise Him"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-sm opacity-80 mb-1">العدد المستهدف</label>
            <input
              type="number"
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value) || 33)}
              className="w-full p-3 rounded-lg bg-black/5 dark:bg-white/10 border border-black/20 dark:border-white/20 focus:ring-2 focus:ring-emerald-400"
              min="1"
              max="1000"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={!arabic.trim()}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            إضافة
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomDhikrManager({
  customDhikrList,
  onDelete,
  onAddClick,
}: {
  customDhikrList: DhikrItem[];
  onDelete: (id: string) => void;
  onAddClick: () => void;
}) {
  return (
    <div className="bg-black/10 dark:bg-white/10 backdrop-blur-sm rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">📝 أذكاري المخصصة</h3>
        <button
          onClick={onAddClick}
          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
        >
          + إضافة
        </button>
      </div>

      {customDhikrList.length === 0 ? (
        <p className="text-sm opacity-60 text-center py-4">
          لم تقم بإضافة أذكار مخصصة بعد
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {customDhikrList.map((dhikr) => (
            <div
              key={dhikr.id}
              className="flex items-center justify-between p-3 rounded-lg bg-black/5 dark:bg-white/5"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{dhikr.arabic}</div>
                <div className="text-xs opacity-60">
                  الهدف: {dhikr.targetCount}
                </div>
              </div>
              <button
                onClick={() => onDelete(dhikr.id)}
                className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                title="حذف"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReminderSettingsPanel({
  settings,
  onUpdate,
  notificationPermission,
  onRequestPermission,
}: {
  settings: ReminderSettings;
  onUpdate: (settings: ReminderSettings) => void;
  notificationPermission: NotificationPermission;
  onRequestPermission: () => void;
}) {
  const handleTimeChange = (index: number, value: string) => {
    const newTimes = [...settings.times];
    newTimes[index] = value;
    onUpdate({ ...settings, times: newTimes });
  };

  const addTime = () => {
    if (settings.times.length < 5) {
      onUpdate({ ...settings, times: [...settings.times, "12:00"] });
    }
  };

  const removeTime = (index: number) => {
    const newTimes = settings.times.filter((_, i) => i !== index);
    onUpdate({ ...settings, times: newTimes });
  };

  return (
    <div className="bg-black/10 dark:bg-white/10 backdrop-blur-sm rounded-xl p-5 shadow-xl">
      <h3 className="font-bold text-lg mb-4">🔔 التذكيرات</h3>

      {notificationPermission !== "granted" ? (
        <div className="text-center py-4">
          <p className="text-sm opacity-80 mb-3">
            للحصول على تذكيرات، يجب السماح بالإشعارات
          </p>
          <button
            onClick={onRequestPermission}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
          >
            السماح بالإشعارات
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span>تفعيل التذكيرات</span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) =>
                onUpdate({ ...settings, enabled: e.target.checked })
              }
              className="w-5 h-5 rounded bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20"
            />
          </label>

          {settings.enabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm opacity-80">أوقات التذكير</span>
                {settings.times.length < 5 && (
                  <button
                    onClick={addTime}
                    className="text-sm text-emerald-400 hover:text-emerald-300"
                  >
                    + إضافة وقت
                  </button>
                )}
              </div>

              {settings.times.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => handleTimeChange(index, e.target.value)}
                    className="flex-1 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20"
                  />
                  {settings.times.length > 1 && (
                    <button
                      onClick={() => removeTime(index)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatsPanel({
  stats,
  onClearHistory,
}: {
  stats: Stats;
  onClearHistory: () => void;
}) {
  const todaySessions = stats.sessions.filter((s) =>
    isSameDay(s.date, getToday())
  );
  const totalDuration = todaySessions.reduce((acc, s) => acc + s.duration, 0);

  return (
    <div className="bg-black/10 dark:bg-white/10 backdrop-blur-sm rounded-xl p-5 shadow-xl">
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
        📊 الإحصائيات
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-500">
            {stats.totalCount}
          </div>
          <div className="text-xs opacity-60">الإجمالي</div>
        </div>
        <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-500">
            {stats.todayCount}
          </div>
          <div className="text-xs opacity-60">اليوم</div>
        </div>
        <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-500">
            {stats.streak}
          </div>
          <div className="text-xs opacity-60">أيام متتالية 🔥</div>
        </div>
        <div className="bg-black/5 dark:bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-500">
            {formatDuration(totalDuration)}
          </div>
          <div className="text-xs opacity-60">وقت اليوم</div>
        </div>
      </div>

      {todaySessions.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm opacity-80 font-medium">جلسات اليوم</div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {todaySessions.slice(-5).map((session) => (
              <div
                key={session.id}
                className="flex justify-between items-center text-xs bg-black/5 dark:bg-white/5 rounded p-2"
              >
                <span className="truncate max-w-[120px]">
                  {session.dhikrText}
                </span>
                <span className="text-emerald-500 font-medium">
                  {session.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onClearHistory}
        className="mt-4 w-full px-3 py-2 text-sm rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
      >
        🗑️ مسح السجل
      </button>
    </div>
  );
}

function HelpSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-black/10 dark:bg-white/10 backdrop-blur-sm rounded-xl p-5 shadow-xl">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between font-bold text-lg"
      >
        <span className="flex items-center gap-2">❓ المساعدة</span>
        <span
          className={
            "transform transition-transform " + (isOpen ? "rotate-180" : "")
          }
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-3 text-sm opacity-80">
          <div>
            <strong className="opacity-100">كيفية الاستخدام:</strong>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>اختر الذكر المراد قوله</li>
              <li>اضغط على زر ابدأ الاستماع</li>
              <li>ابدأ بترديد الذكر بصوت واضح</li>
              <li>سيتم عدّ كل مرة تقول فيها الذكر</li>
            </ol>
          </div>

          <div>
            <strong className="opacity-100">نصائح للأداء الأفضل:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>تحدث بوضوح وبسرعة معتدلة</li>
              <li>تأكد من هدوء المكان قدر الإمكان</li>
              <li>استخدم سماعة رأس للحصول على نتائج أفضل</li>
              <li>أبقِ الهاتف قريباً منك</li>
            </ul>
          </div>

          <div>
            <strong className="opacity-100">تثبيت التطبيق:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>iOS: اضغط على زر المشاركة ثم &quot;إضافة للشاشة الرئيسية&quot;</li>
              <li>Android: اضغط على قائمة المتصفح ثم &quot;تثبيت التطبيق&quot;</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function InstallPWAPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowPrompt(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!mounted || !showPrompt) return null;

  return (
    <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📲</span>
          <div>
            <div className="font-medium">تثبيت التطبيق</div>
            <div className="text-sm opacity-80">
              أضف السبحة الصوتية لشاشتك الرئيسية
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
          >
            تثبيت
          </button>
          <button
            onClick={() => setShowPrompt(false)}
            className="px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton Component
function LoadingSkeleton() {
  return (
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
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function VoiceSubha() {
  // Theme
  const { theme, setTheme, resolvedTheme, mounted } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Custom Dhikr
  const [customDhikrList, setCustomDhikrList] = useLocalStorage<DhikrItem[]>(
    STORAGE_KEYS.CUSTOM_DHIKR,
    []
  );
  const [showAddDhikrModal, setShowAddDhikrModal] = useState(false);

  // All Dhikr (default + custom)
  const allDhikrList = useMemo(
    () => [...DEFAULT_DHIKR_LIST, ...customDhikrList],
    [customDhikrList]
  );

  // App Settings
  const [settings, setSettings] = useLocalStorage<AppSettings>(
    STORAGE_KEYS.SETTINGS,
    DEFAULT_SETTINGS
  );

  // Session State
  const [selectedDhikrId, setSelectedDhikrId] = useState<string>(
    DEFAULT_DHIKR_LIST[0].id
  );
  const [sessionCount, setSessionCount] = useState(0);
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastConfidence, setLastConfidence] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Stats
  const [stats, setStats] = useLocalStorage<Stats>(STORAGE_KEYS.STATS, {
    totalCount: 0,
    todayCount: 0,
    streak: 0,
    lastActiveDate: "",
    sessions: [],
  });

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);

  // Selected Dhikr
  const selectedDhikr = useMemo(
    () =>
      allDhikrList.find((d) => d.id === selectedDhikrId) || allDhikrList[0],
    [allDhikrList, selectedDhikrId]
  );

  const selectedDhikrRef = useRef(selectedDhikr);
  selectedDhikrRef.current = selectedDhikr;

  // Progress
  const progress = useMemo(() => {
    if (!selectedDhikr.targetCount) return 0;
    return (sessionCount / selectedDhikr.targetCount) * 100;
  }, [sessionCount, selectedDhikr.targetCount]);

  // Hooks
  const { requestWakeLock, releaseWakeLock } = useWakeLock();
  const {
    permission: notificationPermission,
    requestPermission: requestNotificationPermission,
    scheduleReminder,
  } = useNotifications();

  // Schedule reminders when settings change
  useEffect(() => {
    if (settings.reminders.enabled && notificationPermission === "granted") {
      scheduleReminder(settings.reminders.times);
    }
  }, [settings.reminders, notificationPermission, scheduleReminder]);

  // Play beep sound
  const playBeep = useCallback(() => {
    if (typeof window === "undefined") return;
    
    const win = window as WindowWithSpeechRecognition;
    const AudioContextClass = window.AudioContext || win.webkitAudioContext;
    
    if (!audioContextRef.current && AudioContextClass) {
      audioContextRef.current = new AudioContextClass();
    }

    const ctx = audioContextRef.current;
    if (!ctx) return;
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 880;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }, []);

  // Handle speech result
  const handleSpeechResult = useCallback(
    (transcript: string, confidence: number) => {
      setLastTranscript(transcript);
      setLastConfidence(confidence);

      const currentDhikr = selectedDhikrRef.current;
      const matches = countOccurrences(transcript, currentDhikr.arabic);

      console.log("Speech Result:", {
        transcript,
        dhikr: currentDhikr.arabic,
        matches,
      });

      if (matches > 0) {
        setSessionCount((prev) => {
          const newCount = prev + matches;

          if (settings.vibrationEnabled && navigator.vibrate) {
            navigator.vibrate(50);
          }

          if (settings.soundEnabled) {
            playBeep();
          }

          if (
            currentDhikr.targetCount &&
            prev < currentDhikr.targetCount &&
            newCount >= currentDhikr.targetCount
          ) {
            setShowCelebration(true);
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100, 50, 100]);
            }
            setTimeout(() => setShowCelebration(false), 3000);
          }

          return newCount;
        });

        setStats((prev) => {
          const today = getToday();
          const isNewDay = prev.lastActiveDate !== today;
          const isConsecutiveDay = isYesterday(prev.lastActiveDate);

          return {
            ...prev,
            totalCount: prev.totalCount + matches,
            todayCount: isNewDay ? matches : prev.todayCount + matches,
            streak: isNewDay
              ? isConsecutiveDay
                ? prev.streak + 1
                : 1
              : prev.streak,
            lastActiveDate: today,
          };
        });
      }
    },
    [settings.vibrationEnabled, settings.soundEnabled, setStats, playBeep]
  );

  // Speech Recognition
  const {
    supported,
    status,
    error,
    interimTranscript,
    isListening,
    start: startRecognition,
    stop: stopRecognition,
    restart: restartRecognition,
    clearError,
  } = useSpeechRecognition(handleSpeechResult, "ar-EG");

  // Handlers
  const handleStart = useCallback(() => {
    clearError();
    setSessionStartTime(Date.now());
    startRecognition();
    requestWakeLock();
  }, [clearError, startRecognition, requestWakeLock]);

  const handleStop = useCallback(() => {
    stopRecognition();
    releaseWakeLock();

    const currentDhikr = selectedDhikrRef.current;

    if (sessionCount > 0 && sessionStartTime) {
      const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
      const session: SessionRecord = {
        id: generateId(),
        date: new Date().toISOString(),
        dhikrId: currentDhikr.id,
        dhikrText: currentDhikr.arabic,
        count: sessionCount,
        duration,
      };

      setStats((prev) => ({
        ...prev,
        sessions: [...prev.sessions.slice(-99), session],
      }));
    }

    setSessionStartTime(null);
  }, [stopRecognition, releaseWakeLock, sessionCount, sessionStartTime, setStats]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      handleStop();
    } else {
      handleStart();
    }
  }, [isListening, handleStart, handleStop]);

  const resetSession = useCallback(() => {
    setSessionCount(0);
    setLastTranscript("");
    setLastConfidence(0);
  }, []);

  const clearHistory = useCallback(() => {
    if (typeof window !== "undefined" && confirm("هل أنت متأكد من مسح جميع السجلات؟")) {
      setStats({
        totalCount: 0,
        todayCount: 0,
        streak: 0,
        lastActiveDate: "",
        sessions: [],
      });
      resetSession();
    }
  }, [setStats, resetSession]);

  const handleDhikrChange = useCallback(
    (id: string) => {
      const wasListening = isListening;

      if (wasListening) {
        stopRecognition();
      }

      const currentDhikr = selectedDhikrRef.current;

      if (sessionCount > 0 && sessionStartTime) {
        const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
        const session: SessionRecord = {
          id: generateId(),
          date: new Date().toISOString(),
          dhikrId: currentDhikr.id,
          dhikrText: currentDhikr.arabic,
          count: sessionCount,
          duration,
        };

        setStats((prev) => ({
          ...prev,
          sessions: [...prev.sessions.slice(-99), session],
        }));
      }

      setSelectedDhikrId(id);
      resetSession();

      if (wasListening) {
        setTimeout(() => {
          setSessionStartTime(Date.now());
          startRecognition();
        }, 200);
      }
    },
    [
      isListening,
      stopRecognition,
      sessionCount,
      sessionStartTime,
      setStats,
      resetSession,
      startRecognition,
    ]
  );

  // Custom Dhikr handlers
  const handleAddCustomDhikr = useCallback(
    (dhikr: DhikrItem) => {
      setCustomDhikrList((prev) => [...prev, dhikr]);
    },
    [setCustomDhikrList]
  );

  const handleDeleteCustomDhikr = useCallback(
    (id: string) => {
      if (typeof window !== "undefined" && confirm("هل أنت متأكد من حذف هذا الذكر؟")) {
        setCustomDhikrList((prev) => prev.filter((d) => d.id !== id));
        if (selectedDhikrId === id) {
          setSelectedDhikrId(DEFAULT_DHIKR_LIST[0].id);
        }
      }
    },
    [setCustomDhikrList, selectedDhikrId]
  );

  // Show loading skeleton until mounted
  if (!mounted) {
    return <LoadingSkeleton />;
  }

  // Unsupported browser
  if (!supported) {
    return (
      <div
        className={
          "min-h-screen p-6 flex items-center justify-center " +
          (isDark
            ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white"
            : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-gray-900")
        }
      >
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🎤</div>
          <h2 className="text-2xl font-bold mb-4">
            المتصفح لا يدعم التعرف على الصوت
          </h2>
          <p className="opacity-80 mb-6">
            للاستفادة من هذه الميزة، يرجى استخدام أحد المتصفحات التالية:
          </p>
          <ul
            className={
              "text-right space-y-2 rounded-lg p-4 " +
              (isDark ? "bg-white/10" : "bg-black/5")
            }
          >
            <li>• Google Chrome (موصى به)</li>
            <li>• Microsoft Edge</li>
            <li>• Safari (iOS/macOS)</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "min-h-screen transition-colors duration-300 " +
        (isDark
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white"
          : "bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-gray-900")
      }
    >
      {/* Celebration overlay */}
      {showCelebration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-pulse">
          <div className="text-center animate-bounce">
            <div className="text-8xl mb-4">🎉</div>
            <div className="text-3xl font-bold text-emerald-400">
              ما شاء الله!
            </div>
            <div className="text-xl opacity-80 mt-2">
              أتممت {selectedDhikr.targetCount} مرة
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Dhikr Modal */}
      <AddCustomDhikrModal
        isOpen={showAddDhikrModal}
        onClose={() => setShowAddDhikrModal(false)}
        onAdd={handleAddCustomDhikr}
      />

      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Install PWA Prompt */}
        <InstallPWAPrompt />

        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              📿 السبحة الصوتية
            </h1>
            <p className="opacity-60 text-sm mt-1">عدّ أذكارك بصوتك</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <StatusIndicator status={status} />
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div
            className={
              "mb-4 p-4 rounded-lg flex items-center justify-between " +
              (isDark
                ? "bg-red-500/20 border border-red-400/30"
                : "bg-red-100 border border-red-300")
            }
          >
            <span className="text-red-500">{error}</span>
            <button
              onClick={restartRecognition}
              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm transition-colors"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Counter card */}
            <div
              className={
                "backdrop-blur-sm rounded-2xl p-6 shadow-2xl " +
                (isDark ? "bg-white/10" : "bg-white/80")
              }
            >
              <DhikrSelector
                dhikrList={allDhikrList}
                selectedId={selectedDhikrId}
                onSelect={handleDhikrChange}
                disabled={isListening}
              />

              {/* Selected dhikr info */}
              {selectedDhikr.meaning && (
                <div
                  className={
                    "mt-3 text-sm rounded-lg p-3 " +
                    (isDark ? "bg-white/5" : "bg-black/5")
                  }
                >
                  <div className="font-medium opacity-90">
                    {selectedDhikr.transliteration}
                  </div>
                  <div className="mt-1 text-emerald-600 dark:text-emerald-400">
                    {selectedDhikr.meaning}
                  </div>
                </div>
              )}

              {/* Counter display */}
              <div className="mt-8 flex flex-col items-center">
                <div className="relative">
                  <ProgressRing
                    progress={progress}
                    size={160}
                    strokeWidth={10}
                    isDark={isDark}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-5xl md:text-6xl font-bold text-emerald-500">
                      {sessionCount}
                    </div>
                    {selectedDhikr.targetCount && (
                      <div className="text-sm opacity-60">
                        / {selectedDhikr.targetCount}
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual counter */}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => setSessionCount((c) => Math.max(0, c - 1))}
                    className={
                      "w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-colors " +
                      (isDark
                        ? "bg-white/10 hover:bg-white/20"
                        : "bg-black/10 hover:bg-black/20")
                    }
                  >
                    −
                  </button>
                  <button
                    onClick={() => setSessionCount((c) => c + 1)}
                    className={
                      "w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-colors " +
                      (isDark
                        ? "bg-white/10 hover:bg-white/20"
                        : "bg-black/10 hover:bg-black/20")
                    }
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Transcript display */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm opacity-60">آخر ما تم سماعه:</span>
                  {lastConfidence > 0 && (
                    <span className="text-xs text-emerald-500">
                      الدقة: {Math.round(lastConfidence * 100)}%
                    </span>
                  )}
                </div>
                <div
                  className={
                    "rounded-lg p-4 min-h-[80px] " +
                    (isDark ? "bg-white/5" : "bg-black/5")
                  }
                >
                  {interimTranscript && (
                    <div className="opacity-50 italic mb-2">
                      {interimTranscript}
                    </div>
                  )}
                  {lastTranscript ? (
                    <div className="text-lg">{lastTranscript}</div>
                  ) : (
                    <div className="opacity-40">
                      لم يتم التعرف على أي كلام بعد
                    </div>
                  )}
                </div>
              </div>

              {/* Control buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={toggleListening}
                  className={
                    "flex-1 min-w-[200px] py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-200 text-white " +
                    (isListening
                      ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25"
                      : "bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25")
                  }
                >
                  {isListening ? (
                    <>
                      <span className="text-2xl">⏸</span>
                      إيقاف الاستماع
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">🎤</span>
                      ابدأ الاستماع
                    </>
                  )}
                </button>

                <button
                  onClick={resetSession}
                  className={
                    "py-4 px-6 rounded-xl transition-colors flex items-center gap-2 " +
                    (isDark
                      ? "bg-white/10 hover:bg-white/20"
                      : "bg-black/10 hover:bg-black/20")
                  }
                >
                  🔄 إعادة ضبط
                </button>
              </div>

              {/* Quick settings */}
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.vibrationEnabled}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        vibrationEnabled: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="opacity-80">اهتزاز عند العدّ</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        soundEnabled: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span className="opacity-80">صوت عند العدّ</span>
                </label>
              </div>
            </div>

            {/* Tips */}
            <div
              className={
                "backdrop-blur-sm rounded-xl p-4 shadow-xl " +
                (isDark ? "bg-white/10" : "bg-white/80")
              }
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div className="text-sm opacity-80">
                  <strong className="opacity-100">نصيحة:</strong> تحدث بوضوح
                  وبسرعة معتدلة. التعرف على الكلام يعمل بشكل أفضل في مكان هادئ
                  وبميكروفون جيد.
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <StatsPanel stats={stats} onClearHistory={clearHistory} />

            <CustomDhikrManager
              customDhikrList={customDhikrList}
              onDelete={handleDeleteCustomDhikr}
              onAddClick={() => setShowAddDhikrModal(true)}
            />

            <ReminderSettingsPanel
              settings={settings.reminders}
              onUpdate={(reminders) =>
                setSettings((prev) => ({ ...prev, reminders }))
              }
              notificationPermission={notificationPermission}
              onRequestPermission={requestNotificationPermission}
            />

            <HelpSection />

            {/* Share button */}
            <button
              onClick={() => {
                if (navigator?.share) {
                  navigator.share({
                    title: "السبحة الصوتية",
                    text:
                      "لقد ذكرت الله " +
                      stats.totalCount +
                      " مرة باستخدام السبحة الصوتية!",
                    url: window.location.href,
                  });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  alert("تم نسخ الرابط!");
                }
              }}
              className={
                "w-full py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 " +
                (isDark
                  ? "bg-white/10 hover:bg-white/20"
                  : "bg-black/10 hover:bg-black/20")
              }
            >
              📤 مشاركة التطبيق
            </button>
          </aside>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm opacity-40">
          <p>اللهم تقبل منا ومنكم صالح الأعمال</p>
        </footer>
      </div>
    </div>
  );
}