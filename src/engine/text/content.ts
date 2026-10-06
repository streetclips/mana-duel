import { getLocale, type Locale } from '../../i18n/locale';
import { CARD_TEXT_EN } from './cards.en';
import { DECK_TEXT_EN } from './decks.en';
import type { CardText, DeckText } from './types';

export const CARD_TEXTS: Partial<Record<Locale, Readonly<Record<string, CardText>>>> = { en: CARD_TEXT_EN };

export const DECK_TEXTS: Partial<Record<Locale, Readonly<Record<string, DeckText>>>> = { en: DECK_TEXT_EN };

interface Localizer<T> {
  localize(base: T): T;
  forget(id: string): void;
}

export function localizer<T extends { id: string }>(
  texts: Partial<Record<Locale, Readonly<Record<string, Partial<T>>>>>,
): Localizer<T> {
  const copies = new Map<Locale, Map<string, T>>();
  return {
    localize(base) {
      const locale = getLocale();
      const text = texts[locale]?.[base.id];
      if (!text) return base;
      let cache = copies.get(locale);
      if (!cache) copies.set(locale, (cache = new Map()));
      let copy = cache.get(base.id);
      if (!copy) cache.set(base.id, (copy = { ...base, ...text }));
      return copy;
    },
    forget(id) {
      for (const cache of copies.values()) cache.delete(id);
    },
  };
}
