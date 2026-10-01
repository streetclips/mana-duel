import { DECK_LIST, DEFAULT_DECK_ID, getDeck, hasDeck, type DeckDef, type PlayerId } from '../engine';

export const RANDOM_DECK = 'random';

export interface DeckChoice {
  deck: string;
  opponent: string;
}

const STORAGE_KEY = 'manaDuel.decks';

export const DEFAULT_CHOICE: DeckChoice = { deck: DEFAULT_DECK_ID, opponent: RANDOM_DECK };

function isDeckOption(id: unknown): id is string {
  return typeof id === 'string' && (id === RANDOM_DECK || hasDeck(id));
}

export function isDeckChoice(value: unknown): value is DeckChoice {
  if (!value || typeof value !== 'object') return false;
  const { deck, opponent } = value as Record<string, unknown>;
  return isDeckOption(deck) && isDeckOption(opponent);
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
  const resolve = (id: string): string => (id === RANDOM_DECK ? pickRandom() : id);
  return [resolve(choice.deck), resolve(choice.opponent)];
}

export function deckOptions(): string[] {
  return [RANDOM_DECK, ...DECK_LIST.map((deck) => deck.id)];
}

export function seatDeck(choice: DeckChoice, seat: PlayerId): string {
  return seat === 0 ? choice.deck : choice.opponent;
}

export function withSeatDeck(choice: DeckChoice, seat: PlayerId, id: string): DeckChoice {
  return seat === 0 ? { ...choice, deck: id } : { ...choice, opponent: id };
}

export function chosenDeck(id: string): DeckDef | null {
  return id !== RANDOM_DECK && hasDeck(id) ? getDeck(id) : null;
}
