import type { DeckDef } from '../engine';
import { CUSTOM_PREFIX, buildDeck, checkDraft, collectionPool, draftOf, draftProblems, isCustomDeck, type DeckDraft } from './deckBuilding';

export interface DeckStore {
  load(): unknown;
  save(decks: DeckDef[]): void;
}

export const NO_DECK_STORE: DeckStore = { load: () => [], save: () => undefined };

export const DEFAULT_DECK_NAME = 'Mi mazo';

type Listener = () => void;

export class DeckLibrary {
  decks: DeckDef[];
  private listeners = new Set<Listener>();

  constructor(private readonly store: DeckStore = NO_DECK_STORE) {
    const stored = store.load();
    this.decks = Array.isArray(stored) ? stored.filter(isCustomDeck) : [];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get(id: string): DeckDef | null {
    return this.decks.find((deck) => deck.id === id) ?? null;
  }

  problems(deck: DeckDef): string[] {
    return draftProblems(draftOf(deck), collectionPool());
  }

  playable(): DeckDef[] {
    return this.decks.filter((deck) => this.problems(deck).length === 0);
  }

  nextName(base = DEFAULT_DECK_NAME): string {
    const taken = new Set(this.decks.map((deck) => deck.name));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
  }

  save(draft: DeckDraft): DeckDef {
    checkDraft(draft);
    const known = draft.id !== null && this.get(draft.id) !== null;
    const deck = buildDeck(draft, known && draft.id ? draft.id : this.nextId());
    this.update(known ? this.decks.map((existing) => (existing.id === deck.id ? deck : existing)) : [...this.decks, deck]);
    return deck;
  }

  remove(id: string): void {
    this.update(this.decks.filter((deck) => deck.id !== id));
  }

  private nextId(): string {
    const used = new Set(this.decks.map((deck) => deck.id));
    for (let n = 1; ; n++) if (!used.has(`${CUSTOM_PREFIX}${n}`)) return `${CUSTOM_PREFIX}${n}`;
  }

  private update(decks: DeckDef[]): void {
    this.decks = decks;
    this.store.save(decks);
    for (const listener of this.listeners) listener();
  }
}
