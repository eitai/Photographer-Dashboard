import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { I18nManager, Platform } from 'react-native';

import { translations } from './translations';

// ── Types ────────────────────────────────────────────────────────────────────

export type SupportedLocale = 'he' | 'en';

export const defaultLocale: SupportedLocale = 'he';

const LOCALE_STORAGE_KEY = 'koral_locale';

// ── RTL helper ───────────────────────────────────────────────────────────────

/**
 * Call once at app startup (before any UI renders) to force RTL for Hebrew.
 * Typically called in the root layout after reading the persisted locale.
 */
export function setupRTL(locale: SupportedLocale): void {
  I18nManager.forceRTL(locale === 'he');
}

// ── Translation lookup ───────────────────────────────────────────────────────

/**
 * Resolve a dot-notation key against the flat translations map for the given locale.
 * Falls back to the key itself when no match is found.
 *
 * @example t('nav.home', 'he') // 'בית'
 */
export function t(key: string, locale: SupportedLocale): string {
  return translations[key]?.[locale] ?? key;
}

// ── Context ──────────────────────────────────────────────────────────────────

interface LanguageContextValue {
  locale: SupportedLocale;
  /** Typed translation lookup bound to the current locale. */
  t: (key: string) => string;
  setLocale: (locale: SupportedLocale) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

interface LanguageProviderProps {
  children: React.ReactNode;
  /** Override initial locale (useful for testing or SSR). Defaults to 'he'. */
  initialLocale?: SupportedLocale;
}

export function LanguageProvider({
  children,
  initialLocale = defaultLocale,
}: LanguageProviderProps): React.JSX.Element {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);

  // Rehydrate persisted locale on mount.
  useEffect(() => {
    const load = async () => {
      try {
        let stored: string | null = null;
        if (Platform.OS === 'web') {
          stored = localStorage.getItem(LOCALE_STORAGE_KEY);
        } else {
          const SecureStore = await import('expo-secure-store');
          stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
        }
        if (stored === 'he' || stored === 'en') {
          setLocaleState(stored);
          setupRTL(stored);
        } else {
          setupRTL(initialLocale);
        }
      } catch {
        setupRTL(initialLocale);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback(async (next: SupportedLocale): Promise<void> => {
    setLocaleState(next);
    setupRTL(next);
    if (Platform.OS === 'web') {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } else {
      const SecureStore = await import('expo-secure-store');
      await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, next);
    }
  }, []);

  const translate = useCallback(
    (key: string): string => t(key, locale),
    [locale],
  );

  const value: LanguageContextValue = { locale, t: translate, setLocale };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access the current locale, the `t()` translation function, and `setLocale`.
 *
 * Must be used within a `<LanguageProvider>`.
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a <LanguageProvider>');
  }
  return ctx;
}
