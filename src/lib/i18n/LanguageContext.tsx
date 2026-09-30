"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations, LOCALE_LABELS, LOCALE_FLAGS, type Locale } from "./translations";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: "pt",
  setLocale: () => {},
  t: (key: string) => key,
});

const STORAGE_KEY = "europcar_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pt");
  const [mounted, setMounted] = useState(false);

  // Load saved language on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && translations[saved]) {
        setLocaleState(saved);
      }
    } catch {}
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {}
    // Update the html lang attribute
    if (typeof document !== "undefined") {
      const langMap: Record<Locale, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };
      document.documentElement.lang = langMap[newLocale] || "pt-BR";
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      const dict = translations[locale] as Record<string, string>;
      return dict[key] || (translations.pt as Record<string, string>)[key] || key;
    },
    [locale]
  );

  // Prevent hydration mismatch: render children only after mount
  if (!mounted) {
    return (
      <LanguageContext.Provider value={{ locale: "pt", setLocale, t: (key) => (translations.pt as Record<string, string>)[key] || key }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access translations and the current locale.
 * 
 * Usage:
 * ```tsx
 * const { t, locale, setLocale } = useLanguage();
 * return <span>{t('hero.search')}</span>;
 * ```
 */
export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Language Selector component — dropdown with flag + language name.
 * Designed to be placed in the site header.
 */
export function LanguageSelector({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const locales: Locale[] = ["pt", "en", "es"];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-bold hover:text-[#008d36] transition-colors px-2 py-1 rounded"
        aria-label="Select language"
      >
        <span className="text-base">{LOCALE_FLAGS[locale]}</span>
        <span className="hidden sm:inline">{LOCALE_LABELS[locale]}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-[100] min-w-[150px]">
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => { setLocale(l); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors ${
                l === locale ? "bg-green-50 text-[#008d36]" : "text-gray-700"
              }`}
            >
              <span className="text-lg">{LOCALE_FLAGS[l]}</span>
              <span>{LOCALE_LABELS[l]}</span>
              {l === locale && (
                <svg className="w-4 h-4 ml-auto text-[#008d36]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
