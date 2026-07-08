"use client";

/**
 * components/nav-bar.tsx
 *
 * Top navigation bar with:
 * - Site title / home link
 * - Language switcher (中文 / 日文 / 中日双语)
 */

import Link from "next/link";
import { useLanguage } from "@/lib/language-context";
import type { LanguagePreference } from "@/lib/types";

const LANG_OPTIONS: { value: LanguagePreference; label: string; shortLabel: string }[] = [
  { value: "zh", label: "中文", shortLabel: "中" },
  { value: "ja", label: "日文", shortLabel: "日" },
  { value: "bilingual", label: "中日双语", shortLabel: "双" },
];

export function NavBar() {
  const { lang, setLang, hydrated } = useLanguage();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Site title */}
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-gray-900 hover:text-blue-600"
        >
          AWS Mondai
        </Link>

        {/* Language switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs sm:text-sm">
          {LANG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={!hydrated}
              onClick={() => setLang(opt.value)}
              className={`rounded-md px-1.5 py-0.5 sm:px-2.5 sm:py-1 transition-colors ${
                lang === opt.value
                  ? "bg-white font-medium text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="sm:hidden">{opt.shortLabel}</span>
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
          <span className="mx-0.5 text-gray-200">|</span>
          <span className="px-1 text-xs text-gray-400" title="Keyboard shortcuts: press ?">
            ?&nbsp;键
          </span>
        </div>
      </div>
    </header>
  );
}
