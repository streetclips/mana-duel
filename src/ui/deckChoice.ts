import { DECK_LIST, DEFAULT_DECK_ID, getDeck, hasDeck, type DeckDef, type DeckSpec, type PlayerId } from '../engine';

export const RANDOM_DECK = 'random';

export interface DeckChoice {
  deck: string;
  opponent: string;
}

const STORAGE_KEY = 'manaDuel.decks';

export const DEFAULT_CHOICE: DeckChoice = { deck: DEFAULT_DECK_ID, opponent: RANDOM_DECK };

function isDeckOption(id: unknown, customs: readonly DeckDef[]): id is string {
  return typeof id === 'string' && (id === RANDOM_DECK || hasDeck(id) || customs.some((deck) => deck.id === id));
}

export function isDeckChoice(value: unknown, customs: readonly DeckDef[] = []): value is DeckChoice {
  if (!value || typeof value !== 'object') return false;
  const { deck, opponent } = value as Record<string, unknown>;
  return isDeckOption(deck, customs) && isDeckOption(opponent, customs);
}

export function loadDeckChoice(customs: readonly DeckDef[] = []): DeckChoice {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return isDeckChoice(stored, customs) ? { deck: stored.deck, opponent: stored.opponent } : { ...DEFAULT_CHOICE };
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

export function knownChoice(choice: DeckChoice, customs: readonly DeckDef[]): DeckChoice {
  return {
    deck: isDeckOption(choice.deck, customs) ? choice.deck : DEFAULT_CHOICE.deck,
    opponent: isDeckOption(choice.opponent, customs) ? choice.opponent : DEFAULT_CHOICE.opponent,
  };
}

export function resolveMatchup(choice: DeckChoice, pickRandom: () => string, customs: readonly DeckDef[] = []): [DeckSpec, DeckSpec] {
  const resolve = (id: string): DeckSpec => {
    if (id === RANDOM_DECK) return pickRandom();
    return customs.find((deck) => deck.id === id) ?? id;
  };
  return [resolve(choice.deck), resolve(choice.opponent)];
}

export function deckOptions(customs: readonly DeckDef[] = []): string[] {
  return [RANDOM_DECK, ...DECK_LIST.map((deck) => deck.id), ...customs.map((deck) => deck.id)];
}

export function seatDeck(choice: DeckChoice, seat: PlayerId): string {
  return seat === 0 ? choice.deck : choice.opponent;
}

export function withSeatDeck(choice: DeckChoice, seat: PlayerId, id: string): DeckChoice {
  return seat === 0 ? { ...choice, deck: id } : { ...choice, opponent: id };
}

export function chosenDeck(id: string, customs: readonly DeckDef[] = []): DeckDef | null {
  if (id === RANDOM_DECK) return null;
  if (hasDeck(id)) return getDeck(id);
  return customs.find((deck) => deck.id === id) ?? null;
}
