import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDeck, collectionPool, draftNotes, draftProblems, type DeckDraft } from '../../src/app/deckBuilding';
import { DeckLibrary, defaultDeckName, type DeckStore } from '../../src/app/deckLibrary';
import { getDeck, type DeckDef } from '../../src/engine';
import { setLocale, withLocale } from '../../src/i18n';
import { spanishIn } from '../i18n';

beforeEach(() => setLocale('en'));

afterEach(() => setLocale('es'));

function draft(cards: DeckDraft['cards'], name = 'Test deck'): DeckDraft {
  return { id: null, name, featured: null, cards };
}

function memoryStore(initial: unknown = []): DeckStore {
  let saved = initial;
  return {
    load: () => JSON.parse(JSON.stringify(saved)) as unknown,
    save: (decks: DeckDef[]) => {
      saved = JSON.parse(JSON.stringify(decks));
    },
  };
}

describe('deck building in English', () => {
  const pool = collectionPool();

  it('explains every problem of a deck', () => {
    expect(draftProblems(draft([{ card: 'forest', count: 39 }]), pool)).toEqual(['1 card short: a deck has at least 40.']);
    expect(draftProblems(draft([{ card: 'forest', count: 30 }], '  '), pool)).toEqual(['Give the deck a name.', '10 cards short: a deck has at least 40.']);
    expect(draftProblems(draft([{ card: 'forest', count: 61 }]), pool)).toEqual(['1 card too many: a deck has at most 60.']);
    expect(draftProblems(draft([{ card: 'forest', count: 62 }]), pool)).toEqual(['2 cards too many: a deck has at most 60.']);
    expect(draftProblems(draft([{ card: 'forest', count: 35 }, { card: 'crag_dragon', count: 5 }]), pool)).toEqual([
      'You have 5 copies of Crag Dragon: you can have up to 4.',
    ]);
    expect(draftProblems(draft([{ card: 'forest', count: 40 }]), [])).toEqual(["Forest isn't among the cards you can use."]);
  });

  it('notes odd land counts and colors no land pays for', () => {
    expect(draftNotes(draft([{ card: 'island', count: 16 }, { card: 'crag_dragon', count: 4 }, ...getDeck('dawntide').cards.slice(2)]))).toContain(
      "Nothing in the deck makes red mana: your red cards can't be paid for.",
    );
    expect(draftNotes(draft([{ card: 'forest', count: 10 }, { card: 'timberland_rhino', count: 30 }]))).toEqual([
      'You have 10 lands out of 40: most decks run 15 to 17.',
    ]);
    expect(draftNotes(draft([{ card: 'forest', count: 1 }, { card: 'timberland_rhino', count: 39 }]))).toEqual([
      'You have 1 land out of 40: most decks run 15 to 17.',
    ]);
  });

  it('describes a custom deck by its kinds of cards', () => {
    expect(buildDeck(draft(getDeck('emberwild').cards), 'mine-1').description).toBe('Custom deck: 17 creatures, 7 spells, and 16 lands.');
    expect(buildDeck(draft([{ card: 'forest', count: 1 }, { card: 'ember_snap', count: 1 }, { card: 'crag_dragon', count: 1 }]), 'mine-2').description).toBe(
      'Custom deck: 1 creature, 1 spell, and 1 land.',
    );
  });
});

describe('the deck library in English', () => {
  it('names new decks in English and keeps the names you saved', () => {
    const library = new DeckLibrary(memoryStore());
    expect(defaultDeckName()).toBe('My deck');
    expect(library.nextName()).toBe('My deck');
    library.save(draft(getDeck('emberwild').cards, library.nextName()));
    expect(library.nextName()).toBe('My deck 2');
    withLocale('es', () => library.save(draft(getDeck('dawntide').cards, library.nextName())));
    expect(library.decks.map((deck) => deck.name)).toEqual(['My deck', 'Mi mazo']);
  });

  it('describes decks saved in Spanish in English', () => {
    const saved = withLocale('es', () => buildDeck(draft(getDeck('duskmire').cards, 'Pantano puro'), 'mine-1'));
    expect(spanishIn(saved.description)).not.toEqual([]);
    const library = new DeckLibrary(memoryStore([saved]));
    expect(library.decks[0]).toMatchObject({ id: 'mine-1', name: 'Pantano puro', description: buildDeck(draft(saved.cards), 'x').description });
    expect(spanishIn(library.decks[0]?.description ?? '')).toEqual([]);
    expect(library.playable()[0]?.description).toBe(library.decks[0]?.description);
    expect(library.get('mine-1')?.description).toBe(library.decks[0]?.description);
    expect(withLocale('es', () => library.get('mine-1')?.description)).toBe(saved.description);
  });
});
