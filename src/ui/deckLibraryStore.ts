import type { DeckDef } from '../engine';
import type { DeckStore } from '../app/deckLibrary';

const DECKS_KEY = 'manaDuel.customDecks';

export const localDeckStore: DeckStore = {
  load(): unknown {
    try {
      return JSON.parse(localStorage.getItem(DECKS_KEY) ?? '[]');
    } catch {
      return [];
    }
  },
  save(decks: DeckDef[]): void {
    try {
      localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
    } catch {
      return;
    }
  },
};
