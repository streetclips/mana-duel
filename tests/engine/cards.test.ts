import { describe, expect, it } from 'vitest';
import {
  EMBERWILD,
  cardSummary,
  deckSize,
  expandDeck,
  getCardDef,
  registerCard,
  rulesText,
  typeLine,
  type CardDef,
} from '../../src/engine';
import { CORE_CARDS } from '../../src/engine/cards';

describe('Emberwild deck', () => {
  it('has 40 cards, 16 of them lands', () => {
    expect(deckSize(EMBERWILD)).toBe(40);
    const cards = expandDeck(EMBERWILD);
    expect(cards).toHaveLength(40);
    expect(cards.filter((id) => getCardDef(id).types.includes('land'))).toHaveLength(16);
  });

  it('only uses red and green mana', () => {
    for (const id of new Set(expandDeck(EMBERWILD))) {
      const def = getCardDef(id);
      expect(def.cost ?? '').not.toMatch(/[WUB]/);
      for (const color of def.mana ?? []) expect(['R', 'G']).toContain(color);
    }
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
  };

  for (const [id, { type, text }] of Object.entries(expected)) {
    it(`describes ${id}`, () => {
      const def = getCardDef(id);
      expect(typeLine(def)).toBe(type);
      expect(rulesText(def)).toEqual(text);
    });
  }

  it('covers every card in the deck', () => {
    for (const id of new Set(expandDeck(EMBERWILD))) expect(Object.keys(expected)).toContain(id);
  });

  it('builds one-line summaries', () => {
    expect(cardSummary('timberland_rhino')).toBe('Timberland Rhino · {2}{G}{G} · Creature — Rhino · 4/4 · Trample');
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
