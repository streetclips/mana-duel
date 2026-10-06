import { describe, expect, it } from 'vitest';
import { MAX_COPIES, poolCards } from '../../src/app/cardPool';
import {
  MAX_DECK,
  MAX_NAME,
  MIN_DECK,
  buildDeck,
  canAdd,
  collectionPool,
  countCards,
  deckColors,
  draftNotes,
  draftOf,
  draftProblems,
  fillWithBasics,
  isCustomDeck,
  searchKey,
  suggestedFeatured,
  withCount,
  type DeckDraft,
} from '../../src/app/deckBuilding';
import { GameController } from '../../src/app/controller';
import { DeckLibrary, type DeckStore } from '../../src/app/deckLibrary';
import { createTestApi } from '../../src/app/testApi';
import { DECK_LIST, getCardDef, getDeck, type DeckDef } from '../../src/engine';

function draft(cards: DeckDraft['cards'], name = 'Mi mazo'): DeckDraft {
  return { id: null, name, featured: null, cards };
}

const pool = collectionPool();

describe('the card collection', () => {
  it('holds every card of the fourteen decks once, basic lands unlimited and the rest up to four copies', () => {
    const cards = pool.map((allowance) => allowance.card);
    expect(new Set(cards).size).toBe(cards.length);
    expect(cards.sort()).toEqual(
      [...new Set(DECK_LIST.flatMap((deck) => deck.cards.map((entry) => entry.card)))].sort(),
    );
    expect(cards).toHaveLength(poolCards().length);
    expect(cards.some((card) => getCardDef(card).token)).toBe(false);
    const limits = Object.fromEntries(pool.map((allowance) => [allowance.card, allowance.max]));
    expect(limits).toMatchObject({
      forest: null,
      plains: null,
      swamp: null,
      island: null,
      mountain: null,
      silver_spire: MAX_COPIES,
      crag_dragon: MAX_COPIES,
    });
  });
});

describe('deck building', () => {
  it('counts, adds and removes copies within the limits', () => {
    let cards = withCount([], 'crag_dragon', 3);
    expect(canAdd(cards, pool, 'crag_dragon')).toBe(true);
    cards = withCount(cards, 'crag_dragon', 4);
    expect(canAdd(cards, pool, 'crag_dragon')).toBe(false);
    expect(canAdd(cards, pool, 'soldier_token')).toBe(false);
    cards = withCount(cards, 'forest', 40);
    expect(canAdd(cards, pool, 'forest')).toBe(true);
    expect(countCards(cards)).toBe(44);
    expect(withCount(cards, 'crag_dragon', 0)).toEqual([{ card: 'forest', count: 40 }]);
    expect(canAdd([{ card: 'forest', count: MAX_DECK }], pool, 'forest')).toBe(false);
  });

  it('names what keeps a deck from being played', () => {
    expect(draftProblems(draft([{ card: 'forest', count: 39 }]), pool)).toEqual([
      'Falta 1 carta: un mazo tiene al menos 40.',
    ]);
    expect(draftProblems(draft([{ card: 'forest', count: 30 }], '  '), pool)).toEqual([
      'Ponle un nombre al mazo.',
      'Faltan 10 cartas: un mazo tiene al menos 40.',
    ]);
    expect(draftProblems(draft([{ card: 'forest', count: 62 }]), pool)).toEqual([
      'Sobran 2 cartas: un mazo tiene como mucho 60.',
    ]);
    expect(
      draftProblems(
        draft([
          { card: 'forest', count: 35 },
          { card: 'crag_dragon', count: 5 },
        ]),
        pool,
      ),
    ).toEqual(['Llevas 5 copias de Dragón del risco: puedes llevar 4.']);
    expect(draftProblems(draft([{ card: 'forest', count: 40 }]), [])).toEqual([
      'Bosque no está entre las cartas que puedes usar.',
    ]);
    expect(draftProblems(draftOf(getDeck('crossroads')), pool)).toEqual([]);
  });

  it('warns about odd land counts and colors nothing pays for', () => {
    expect(draftNotes(draftOf(getDeck('emberwild')))).toEqual([]);
    const blue = draft([...getDeck('emberwild').cards, { card: 'mist_sprite', count: 2 }]);
    expect(draftNotes(blue)).toEqual(['Nada en el mazo da maná azul: tus cartas azules no podrán pagarse.']);
    expect(
      draftNotes(
        draft([
          { card: 'forest', count: 10 },
          { card: 'timberland_rhino', count: 30 },
        ]),
      ),
    ).toEqual(['Llevas 10 tierras de 40: la mayoría de los mazos llevan entre 15 y 17.']);
  });

  it('takes its colors from its spells, and its box art from its most expensive one', () => {
    expect(deckColors(getDeck('emberwild').cards)).toEqual(['R', 'G']);
    expect(deckColors([{ card: 'forest', count: 3 }])).toEqual(['G']);
    expect(deckColors(getDeck('crossroads').cards)).toEqual(['W', 'U', 'B', 'R', 'G']);
    expect(suggestedFeatured(getDeck('emberwild').cards)).toBe('crag_dragon');
    expect(suggestedFeatured([{ card: 'island', count: 1 }])).toBe('island');
  });

  it('fills a deck up to forty with basic lands in the share of its colored mana symbols', () => {
    const spells = getDeck('emberwild').cards.filter((entry) => !getCardDef(entry.card).types.includes('land'));
    const filled = fillWithBasics(spells);
    expect(countCards(filled)).toBe(MIN_DECK);
    const lands = filled.filter((entry) => getCardDef(entry.card).types.includes('land'));
    expect(lands.map((entry) => entry.card).sort()).toEqual(['forest', 'mountain']);
    expect(countCards(lands)).toBe(MIN_DECK - countCards(spells));
    expect(fillWithBasics(getDeck('emberwild').cards)).toEqual(getDeck('emberwild').cards);
    expect(fillWithBasics([])).toEqual([]);
    const mono = fillWithBasics([
      { card: 'mist_sprite', count: 4 },
      { card: 'island', count: 2 },
    ]);
    expect(mono).toEqual([
      { card: 'mist_sprite', count: 4 },
      { card: 'island', count: 36 },
    ]);
  });

  it('turns a draft into a deck definition, and reads stored decks back with care', () => {
    const deck = buildDeck(
      {
        id: null,
        name: '  Un nombre larguísimo para un mazo  ',
        featured: 'gloom_wisp',
        cards: getDeck('duskmire').cards,
      },
      'mine-7',
    );
    expect(deck.id).toBe('mine-7');
    expect(deck.name).toHaveLength(MAX_NAME);
    expect(deck.colors).toEqual(['B']);
    expect(deck.featured).toBe('gloom_wisp');
    expect(deck.description).toBe('Mazo propio: 20 criaturas, 4 hechizos y 16 tierras.');
    expect(buildDeck({ ...draftOf(deck), featured: 'crag_dragon' }, 'mine-7').featured).toBe('dread_tyrant');
    expect(isCustomDeck(JSON.parse(JSON.stringify(deck)))).toBe(true);
    expect(isCustomDeck({ ...deck, id: 'duskmire' })).toBe(false);
    expect(isCustomDeck({ ...deck, cards: [{ card: 'soldier_token', count: 1 }] })).toBe(false);
    expect(isCustomDeck({ ...deck, cards: [{ card: 'bell', count: 1 }] })).toBe(false);
    expect(isCustomDeck({ ...deck, name: '' })).toBe(false);
    expect(isCustomDeck({ ...deck, name: 'x'.repeat(MAX_NAME + 1) })).toBe(false);
    expect(isCustomDeck({ ...deck, name: 'Mazo\n## Reglas' })).toBe(false);
    expect(buildDeck({ ...draftOf(deck), name: 'Mazo\n## Reglas\u2028' }, 'mine-7').name).toBe('Mazo ## Reglas');
    expect(searchKey('Víbora del Musgo')).toBe('vibora del musgo');
  });
});

function memoryStore(initial: unknown = []): DeckStore & { saved: unknown } {
  const store = {
    saved: initial,
    load: () => JSON.parse(JSON.stringify(store.saved)) as unknown,
    save: (decks: DeckDef[]) => {
      store.saved = JSON.parse(JSON.stringify(decks));
    },
  };
  return store;
}

describe('the deck library', () => {
  it('saves new decks with their own ids and names, and updates them in place', () => {
    const store = memoryStore();
    const library = new DeckLibrary(store);
    expect(library.nextName()).toBe('Mi mazo');
    const first = library.save(draft(getDeck('emberwild').cards));
    expect(first.id).toBe('mine-1');
    expect(library.nextName()).toBe('Mi mazo 2');
    const second = library.save(draft(getDeck('dawntide').cards, library.nextName()));
    expect(second).toMatchObject({ id: 'mine-2', name: 'Mi mazo 2', colors: ['W', 'U'] });
    const renamed = library.save({ ...draftOf(first), name: 'Fuego verde' });
    expect(renamed.id).toBe('mine-1');
    expect(library.decks.map((deck) => deck.name)).toEqual(['Fuego verde', 'Mi mazo 2']);
    expect(new DeckLibrary(store).decks).toEqual(library.decks);
    library.remove('mine-1');
    expect(library.decks.map((deck) => deck.id)).toEqual(['mine-2']);
    expect(library.save(draft([])).id).toBe('mine-1');
  });

  it('offers only the decks that can be played', () => {
    const library = new DeckLibrary(memoryStore());
    library.save(draft(getDeck('emberwild').cards, 'Completo'));
    library.save(draft([{ card: 'forest', count: 12 }], 'A medias'));
    expect(library.playable().map((deck) => deck.name)).toEqual(['Completo']);
    expect(library.problems(library.decks[1] as DeckDef)).toEqual(['Faltan 28 cartas: un mazo tiene al menos 40.']);
  });

  it('refuses tokens and unknown cards, and drops stored decks it cannot read', () => {
    const library = new DeckLibrary(memoryStore());
    expect(() => library.save(draft([{ card: 'soldier_token', count: 1 }]))).toThrow(/not a card a deck can hold/);
    expect(() => library.save(draft([{ card: 'grimoire', count: 1 }]))).toThrow(/not a card a deck can hold/);
    expect(() => library.save(draft([{ card: 'nope', count: 1 }]))).toThrow(/not a card a deck can hold/);
    const stored = buildDeck(draft(getDeck('emberwild').cards), 'mine-3');
    expect(new DeckLibrary(memoryStore([stored, { id: 'mine-4', name: 'Roto' }, 'basura'])).decks).toEqual([stored]);
    expect(new DeckLibrary(memoryStore({ not: 'a list' })).decks).toEqual([]);
  });

  it('keeps a stored deck whose name breaks a rule under a clean name, and refuses a deck without one', () => {
    const store = memoryStore([
      { ...buildDeck(draft(getDeck('emberwild').cards), 'mine-1'), name: 'Fuego\trojo' },
      { ...buildDeck(draft(getDeck('duskmire').cards), 'mine-2'), name: '\u0007' },
    ]);
    const library = new DeckLibrary(store);
    expect(library.decks.map((deck) => deck.name)).toEqual(['Fuego rojo', 'Mi mazo']);
    library.save(draft(getDeck('dawntide').cards, 'Otro'));
    expect((store.saved as DeckDef[]).map((deck) => deck.name)).toEqual(['Fuego rojo', 'Mi mazo', 'Otro']);
    expect(() => library.save(draft(getDeck('dawntide').cards, '\u0007 '))).toThrow(/needs a name/);
  });
});

describe('your decks in the automation API', () => {
  it('saves, lists, plays and deletes your decks', () => {
    const controller = new GameController({ seed: 5, aiDelayMs: 0 });
    const library = new DeckLibrary(memoryStore());
    const api = createTestApi(controller, () => undefined, { freezeFx: async () => [], library });
    const saved = api.saveDeck({
      name: 'Pantano puro',
      cards: getDeck('duskmire').cards.map((entry) => ({ ...entry })),
    });
    expect(saved).toMatchObject({
      ok: true,
      deck: { id: 'mine-1', name: 'Pantano puro', custom: true, playable: true, size: 40 },
      problems: [],
    });
    expect(api.saveDeck({ name: 'Corto', cards: [{ card: 'swamp', count: 3 }] })).toMatchObject({
      ok: true,
      deck: { id: 'mine-2', playable: false },
      problems: ['Faltan 37 cartas: un mazo tiene al menos 40.'],
    });
    expect(api.saveDeck({ name: 'Mal', cards: [{ card: 'spirit_token', count: 40 }] })).toEqual({
      ok: false,
      error: '"spirit_token" is not a card a deck can hold',
    });
    expect(
      api
        .decks()
        .filter((summary) => summary.custom)
        .map((summary) => summary.id),
    ).toEqual(['mine-1', 'mine-2']);
    expect(api.decks().filter((summary) => !summary.custom)).toHaveLength(DECK_LIST.length);
    api.newGame({ decks: ['mine-1', 'dawntide'] });
    expect(api.matchup()).toEqual(['mine-1', 'dawntide']);
    expect(api.deleteDeck('mine-2')).toBe(true);
    expect(api.deleteDeck('mine-2')).toBe(false);
    expect(api.help()).toContain('saveDeck(');
  });
});
