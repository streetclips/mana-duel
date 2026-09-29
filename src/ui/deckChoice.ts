import { DECK_LIST, DEFAULT_DECK_ID, getDeck, hasDeck, type DeckDef, type PlayerId } from '../engine';

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

export function deckOptions(seat: PlayerId): string[] {
  const decks = DECK_LIST.map((deck) => deck.id);
  return seat === 0 ? decks : [RANDOM_DECK, ...decks];
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
