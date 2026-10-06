import { DEFAULT_LOCALE, isLocale, matchLocale, setLocale, type Locale } from '../i18n';
import { commonText } from './text/common';

const LOCALE_KEY = 'manaDuel.locale';

export function loadLocaleChoice(): Locale | null {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function saveLocaleChoice(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    return;
  }
}

export function localeFrom(params: URLSearchParams, stored: Locale | null, languages: readonly string[]): Locale {
  const param = params.get('lang');
  if (isLocale(param)) return param;
  return stored ?? matchLocale(languages) ?? DEFAULT_LOCALE;
}

export function applyLocale(locale: Locale, doc: Document = document): void {
  setLocale(locale);
  const text = commonText();
  doc.documentElement.lang = locale;
  doc.title = text.title;
  doc.querySelector('meta[name="description"]')?.setAttribute('content', text.description);
}
