import type { DeckDef } from '../engine';
import {
  CUSTOM_PREFIX,
  buildDeck,
  checkDraft,
  collectionPool,
  deckDescription,
  draftOf,
  draftProblems,
  storedDeck,
  type DeckDraft,
} from './deckBuilding';
import { deckBuildingText } from './text/decks';

export interface DeckStore {
  load(): unknown;
  save(decks: DeckDef[]): void;
}

export const NO_DECK_STORE: DeckStore = { load: () => [], save: () => undefined };

export function defaultDeckName(): string {
  return deckBuildingText().defaultName;
}

type Listener = () => void;

export class DeckLibrary {
  private saved: DeckDef[];
  private listeners = new Set<Listener>();

  constructor(private readonly store: DeckStore = NO_DECK_STORE) {
    const stored = store.load();
    this.saved = Array.isArray(stored) ? stored.flatMap((value) => storedDeck(value, defaultDeckName()) ?? []) : [];
  }

  get decks(): DeckDef[] {
    return this.saved.map((deck) => ({ ...deck, description: deckDescription(deck.cards) }));
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

  nextName(base = defaultDeckName()): string {
    const taken = new Set(this.saved.map((deck) => deck.name));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
  }

  save(draft: DeckDraft): DeckDef {
    checkDraft(draft);
    const known = draft.id !== null && this.saved.some((deck) => deck.id === draft.id);
    const deck = buildDeck(draft, known && draft.id ? draft.id : this.nextId());
    this.update(
      known ? this.saved.map((existing) => (existing.id === deck.id ? deck : existing)) : [...this.saved, deck],
    );
    return deck;
  }

  remove(id: string): void {
    this.update(this.saved.filter((deck) => deck.id !== id));
  }

  private nextId(): string {
    const used = new Set(this.saved.map((deck) => deck.id));
    for (let n = 1; ; n++) if (!used.has(`${CUSTOM_PREFIX}${n}`)) return `${CUSTOM_PREFIX}${n}`;
  }

  private update(decks: DeckDef[]): void {
    this.saved = decks;
    this.store.save(decks);
    for (const listener of this.listeners) listener();
  }
}
