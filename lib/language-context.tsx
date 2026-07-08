"use client";

/**
 * lib/language-context.tsx
 *
 * React context + provider for language preference.
 * Persists to localStorage and defaults to "bilingual".
 * Switching language is instant — no page reload.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LanguagePreference } from "./types";

const STORAGE_KEY = "language-preference";

// ─── Context ────────────────────────────────────────────────────────────────

interface LanguageContextValue {
  /** Current language preference */
  lang: LanguagePreference;
  /** Switch language (persisted to localStorage, component re-renders instantly) */
  setLang: (lang: LanguagePreference) => void;
  /** True after initial hydration — avoids flash of wrong language on SSR */
  hydrated: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguagePreference>("bilingual");
  const [hydrated, setHydrated] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "zh" || stored === "ja" || stored === "bilingual") {
        setLangState(stored);
      }
    } catch {
      // localStorage unavailable (SSR, private browsing, etc.)
    }

    setHydrated(true);
  }, []);

  const setLang = useCallback((newLang: LanguagePreference) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // Silently fail — not critical
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang, hydrated }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
