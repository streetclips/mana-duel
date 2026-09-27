import { DEFAULT_DECK_ID, hasDeck } from '../engine';

export const RANDOM_DECK = 'random';

export interface DeckChoice {
  deck: string;
  opponent: string;
}

const STORAGE_KEY = 'manaDuel.decks';

export const DEFAULT_CHOICE: DeckChoice = { deck: DEFAULT_DECK_ID, opponent: RANDOM_DECK };

export function isDeckChoice(value: unknown): value is DeckChoice {
  if (!value || typeof value !== 'object') return false;
  const { deck, opponent } = value as Record<string, unknown>;
  return typeof deck === 'string' && hasDeck(deck) && typeof opponent === 'string' && (opponent === RANDOM_DECK || hasDeck(opponent));
}

export function loadDeckChoice(): DeckChoice {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return isDeckChoice(stored) ? { deck: stored.deck, opponent: stored.opponent } : { ...DEFAULT_CHOICE };
  } catch {
    return { ...DEFAULT_CHOICE };
  }
}

export function saveDeckChoice(choice: DeckChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    return;
  }
}

export function resolveMatchup(choice: DeckChoice, pickRandom: () => string): [string, string] {
  return [choice.deck, choice.opponent === RANDOM_DECK ? pickRandom() : choice.opponent];
}
