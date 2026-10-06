import type { Locale } from '../../i18n/locale';
import { CARD_TEXT_EN } from './cards.en';
import { DECK_TEXT_EN } from './decks.en';
import type { CardText, DeckText } from './types';

export const CARD_TEXTS: Partial<Record<Locale, Readonly<Record<string, CardText>>>> = { en: CARD_TEXT_EN };

export const DECK_TEXTS: Partial<Record<Locale, Readonly<Record<string, DeckText>>>> = { en: DECK_TEXT_EN };
