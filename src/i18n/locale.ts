export type Locale = 'es' | 'en';

export const LOCALES: readonly Locale[] = ['es', 'en'];

export const DEFAULT_LOCALE: Locale = 'es';

export const LOCALE_NAMES: Record<Locale, string> = { es: 'Español', en: 'English' };

let current: Locale = DEFAULT_LOCALE;

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
}

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

export function matchLocale(languages: readonly string[]): Locale | null {
  for (const language of languages) {
    const primary = language.trim().toLowerCase().split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return null;
}

export function withLocale<T>(locale: Locale, run: () => T): T {
  const previous = current;
  current = locale;
  try {
    return run();
  } finally {
    current = previous;
  }
}
