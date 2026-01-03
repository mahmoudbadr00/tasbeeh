// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-7xl font-extrabold text-emerald-500 mb-4">
          404
        </h1>

        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          الصفحة غير موجودة
        </h2>

        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          يبدو أن الصفحة التي تحاول الوصول إليها غير متاحة
          أو ربما تم نقلها أو حذفها.
        </p>

        <Link
          href="/"
          className="
            inline-flex items-center justify-center
            rounded-xl px-6 py-3
            bg-emerald-500 text-white font-medium
            hover:bg-emerald-600
            transition
          "
        >
          الرجوع إلى الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
