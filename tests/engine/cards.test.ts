import { describe, expect, it } from 'vitest';
import {
  DECK_LIST,
  EMBERWILD,
  cardSummary,
  costColors,
  deckSize,
  expandDeck,
  getCardDef,
  getCost,
  getDeck,
  hasDeck,
  registerCard,
  rulesText,
  typeLine,
  type CardDef,
} from '../../src/engine';
import { CORE_CARDS } from '../../src/engine/cards';

const isLandId = (id: string): boolean => getCardDef(id).types.includes('land');

describe('decks', () => {
  it('are Emberwild, Dawntide and Duskmire', () => {
    expect(DECK_LIST.map((deck) => deck.id)).toEqual(['emberwild', 'dawntide', 'duskmire']);
    expect(getDeck('emberwild')).toBe(EMBERWILD);
  });

  for (const deck of DECK_LIST) {
    describe(deck.name, () => {
      it('has 40 cards, 16 of them lands', () => {
        expect(deckSize(deck)).toBe(40);
        const cards = expandDeck(deck);
        expect(cards).toHaveLength(40);
        expect(cards.filter(isLandId)).toHaveLength(16);
      });

      it('only uses its own colors', () => {
        for (const id of new Set(expandDeck(deck))) {
          const def = getCardDef(id);
          for (const color of [...costColors(getCost(id)), ...(def.mana ?? [])]) expect(deck.colors, id).toContain(color);
        }
      });

      it('lists each card once and features one of its own cards', () => {
        const ids = deck.cards.map((entry) => entry.card);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain(deck.featured);
        expect(isLandId(deck.featured)).toBe(false);
      });
    });
  }

  it('share no card except basic lands', () => {
    const owners = new Map<string, string[]>();
    for (const deck of DECK_LIST) {
      for (const entry of deck.cards) owners.set(entry.card, [...(owners.get(entry.card) ?? []), deck.id]);
    }
    for (const [id, decks] of owners) {
      if (decks.length > 1) expect(getCardDef(id).supertypes, `${id} is in ${decks.join(', ')}`).toContain('Basic');
    }
  });

  it('use every card in the game', () => {
    const used = new Set(DECK_LIST.flatMap((deck) => deck.cards.map((entry) => entry.card)));
    expect(CORE_CARDS.map((def) => def.id).filter((id) => !used.has(id))).toEqual([]);
  });

  it('are looked up by id', () => {
    expect(hasDeck('dawntide')).toBe(true);
    expect(hasDeck('toString')).toBe(false);
    expect(() => getDeck('nope')).toThrow(/Unknown deck/);
  });
});

describe('rules text', () => {
  const expected: Record<string, { type: string; text: string[] }> = {
    forest: { type: 'Basic Land — Forest', text: ['{T}: Add {G}.'] },
    mountain: { type: 'Basic Land — Mountain', text: ['{T}: Add {R}.'] },
    grove_tender: { type: 'Creature — Elf Druid', text: ['{T}: Add {G}.'] },
    moss_viper: { type: 'Creature — Snake', text: ['Deathtouch'] },
    ember_hound: { type: 'Creature — Elemental Dog', text: ['Haste'] },
    canopy_spider: { type: 'Creature — Spider', text: ['Reach'] },
    ashen_duelist: { type: 'Creature — Human Warrior', text: ['First strike'] },
    cinder_adept: {
      type: 'Creature — Human Shaman',
      text: ['When this creature enters, it deals 1 damage to any target.'],
    },
    ridge_marauder: { type: 'Creature — Human Berserker', text: ['Menace'] },
    bramble_warden: { type: 'Creature — Plant Warrior', text: ['Vigilance'] },
    timberland_rhino: { type: 'Creature — Rhino', text: ['Trample'] },
    cinderwing_drake: { type: 'Creature — Drake', text: ['Flying'] },
    crag_dragon: { type: 'Creature — Dragon', text: ['Flying', '{R}: This creature gets +1/+0 until end of turn.'] },
    ember_snap: { type: 'Instant', text: ['Ember Snap deals 2 damage to any target.'] },
    magma_lance: { type: 'Sorcery', text: ['Magma Lance deals 4 damage to target creature.'] },
    verdant_surge: { type: 'Instant', text: ['Target creature gets +3/+3 until end of turn.'] },
    feral_clash: { type: 'Sorcery', text: ["Target creature you control fights target creature you don't control."] },
    read_the_roots: { type: 'Sorcery', text: ['Draw two cards.'] },
    plains: { type: 'Basic Land — Plains', text: ['{T}: Add {W}.'] },
    island: { type: 'Basic Land — Island', text: ['{T}: Add {U}.'] },
    swamp: { type: 'Basic Land — Swamp', text: ['{T}: Add {B}.'] },
    mist_sprite: { type: 'Creature — Faerie', text: ['Flying'] },
    dawn_acolyte: { type: 'Creature — Human Cleric', text: ['Lifelink'] },
    reefshell_crab: { type: 'Creature — Crab', text: ['Defender'] },
    beacon_squire: { type: 'Creature — Human Soldier', text: ['Vigilance'] },
    reef_scholar: { type: 'Creature — Merfolk Wizard', text: ['When this creature enters, draw a card.'] },
    galewing_falcon: { type: 'Creature — Bird', text: ['Flying'] },
    sunblade_paladin: { type: 'Creature — Human Knight', text: ['Double strike'] },
    cloudrider_knight: { type: 'Creature — Human Knight', text: ['Flying, vigilance'] },
    aurora_seraph: { type: 'Creature — Angel', text: ['Flying, lifelink'] },
    radiant_blessing: { type: 'Instant', text: ['Target creature gets +2/+2 until end of turn. You gain 2 life.'] },
    undertow: { type: 'Instant', text: ["Return target creature to its owner's hand."] },
    turn_the_tide: { type: 'Instant', text: ['Counter target spell.'] },
    tidal_insight: { type: 'Instant', text: ['Draw two cards.'] },
    dawns_verdict: { type: 'Instant', text: ['Destroy target tapped creature.'] },
    gloom_wisp: { type: 'Creature — Spirit', text: ['When this creature dies, draw a card.'] },
    duskwing_bat: { type: 'Creature — Bat', text: ['Flying, lifelink'] },
    mire_prowler: { type: 'Creature — Zombie', text: ['Menace'] },
    grave_hexer: {
      type: 'Creature — Human Warlock',
      text: ["When this creature enters, target creature you don't control gets -1/-1 until end of turn."],
    },
    bog_lurker: { type: 'Creature — Horror', text: ['Deathtouch'] },
    crypt_ghoul: { type: 'Creature — Zombie', text: ['When this creature dies, it deals 1 damage to target opponent.'] },
    duskmire_shade: { type: 'Creature — Shade', text: ['{B}: This creature gets +1/+1 until end of turn.'] },
    blood_reaver: { type: 'Creature — Vampire', text: ['Lifelink'] },
    nightveil_wraith: {
      type: 'Creature — Spirit',
      text: ['Flying', 'When this creature dies, it deals 2 damage to target opponent.'],
    },
    dread_tyrant: { type: 'Creature — Demon', text: ['Flying', 'When this creature enters, you lose 2 life.'] },
    withering_touch: { type: 'Instant', text: ['Target creature gets -2/-2 until end of turn.'] },
    nights_bargain: { type: 'Sorcery', text: ['Draw two cards. You lose 2 life.'] },
    soul_siphon: { type: 'Sorcery', text: ['Soul Siphon deals 2 damage to any target. You gain 2 life.'] },
    grave_sentence: { type: 'Instant', text: ['Destroy target creature.'] },
  };

  for (const [id, { type, text }] of Object.entries(expected)) {
    it(`describes ${id}`, () => {
      const def = getCardDef(id);
      expect(typeLine(def)).toBe(type);
      expect(rulesText(def)).toEqual(text);
    });
  }

  it('covers every card in every deck', () => {
    for (const id of new Set(DECK_LIST.flatMap(expandDeck))) expect(Object.keys(expected)).toContain(id);
  });

  it('builds one-line summaries', () => {
    expect(cardSummary('timberland_rhino')).toBe('Timberland Rhino · {2}{G}{G} · Creature — Rhino · 4/4 · Trample');
    expect(cardSummary('turn_the_tide')).toBe('Turn the Tide · {1}{U}{U} · Instant · Counter target spell.');
  });
});

describe('card validation', () => {
  it('rejects broken definitions', () => {
    expect(() => registerCard({ id: 'bad1', name: 'Bad', types: ['creature'], cost: '{G}' })).toThrow(/power/);
    expect(() => registerCard({ id: 'bad2', name: 'Bad', types: ['instant'], cost: '{R}' })).toThrow(/spell ability/);
    expect(() =>
      registerCard({
        id: 'bad3',
        name: 'Bad',
        types: ['sorcery'],
        cost: '{R}',
        spell: { targets: [], effects: [{ kind: 'damage', amount: 1, to: 0 }] },
      }),
    ).toThrow(/missing target/);
    expect(() => registerCard({ id: 'bad4', name: 'Bad', types: ['land'], cost: '{1}' })).toThrow(/no mana cost/);
    expect(() =>
      registerCard({
        id: 'bad5',
        name: 'Bad',
        types: ['instant'],
        cost: '{U}',
        spell: { targets: [{ kind: 'creature' }], effects: [{ kind: 'counter', to: 0 }] },
      }),
    ).toThrow(/counter effects need a spell target/);
    expect(() =>
      registerCard({
        id: 'bad6',
        name: 'Bad',
        types: ['instant'],
        cost: '{R}',
        spell: { targets: [{ kind: 'spell' }], effects: [{ kind: 'damage', amount: 1, to: 0 }] },
      }),
    ).toThrow(/only counter effects/);
  });
});

describe('card files', () => {
  const files = Object.entries(
    import.meta.glob<Record<string, CardDef>>('../../src/engine/cards/*.ts', { eager: true }),
  ).filter(([path]) => !path.endsWith('/index.ts'));

  it('each export one card named after the file', () => {
    for (const [path, exports] of files) {
      const defs = Object.values(exports);
      expect(defs, path).toHaveLength(1);
      expect(path).toBe(`../../src/engine/cards/${defs[0]?.id}.ts`);
    }
  });

  it('are all listed in the index', () => {
    const ids = (defs: readonly CardDef[]) => defs.map((def) => def.id).sort();
    expect(ids(CORE_CARDS)).toEqual(ids(files.flatMap(([, exports]) => Object.values(exports))));
  });
});
