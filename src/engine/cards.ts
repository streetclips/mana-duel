import { parseCost } from './mana';
import type { CardDef, ManaCost } from './types';

const CORE_CARDS: CardDef[] = [
  {
    id: 'forest',
    name: 'Forest',
    types: ['land'],
    supertypes: ['Basic'],
    subtypes: ['Forest'],
    mana: ['G'],
  },
  {
    id: 'mountain',
    name: 'Mountain',
    types: ['land'],
    supertypes: ['Basic'],
    subtypes: ['Mountain'],
    mana: ['R'],
  },
  {
    id: 'grove_tender',
    name: 'Grove Tender',
    types: ['creature'],
    subtypes: ['Elf', 'Druid'],
    cost: '{G}',
    power: 1,
    toughness: 1,
    mana: ['G'],
    flavor: 'She hums, and the soil answers.',
  },
  {
    id: 'moss_viper',
    name: 'Moss Viper',
    types: ['creature'],
    subtypes: ['Snake'],
    cost: '{G}',
    power: 1,
    toughness: 1,
    keywords: ['deathtouch'],
    flavor: 'Small bite. Long sleep.',
  },
  {
    id: 'ember_hound',
    name: 'Ember Hound',
    types: ['creature'],
    subtypes: ['Elemental', 'Dog'],
    cost: '{1}{R}',
    power: 2,
    toughness: 1,
    keywords: ['haste'],
    flavor: 'It fetches whatever is burning.',
  },
  {
    id: 'canopy_spider',
    name: 'Canopy Spider',
    types: ['creature'],
    subtypes: ['Spider'],
    cost: '{1}{G}',
    power: 1,
    toughness: 3,
    keywords: ['reach'],
    flavor: 'The sky is just another floor of its web.',
  },
  {
    id: 'ashen_duelist',
    name: 'Ashen Duelist',
    types: ['creature'],
    subtypes: ['Human', 'Warrior'],
    cost: '{1}{R}',
    power: 2,
    toughness: 1,
    keywords: ['firstStrike'],
    flavor: 'The first cut is the only one that matters.',
  },
  {
    id: 'cinder_adept',
    name: 'Cinder Adept',
    types: ['creature'],
    subtypes: ['Human', 'Shaman'],
    cost: '{2}{R}',
    power: 2,
    toughness: 2,
    triggers: [
      {
        on: 'enters',
        targets: [{ kind: 'any' }],
        effects: [{ kind: 'damage', amount: 1, to: 0 }],
      },
    ],
  },
  {
    id: 'ridge_marauder',
    name: 'Ridge Marauder',
    types: ['creature'],
    subtypes: ['Human', 'Berserker'],
    cost: '{2}{R}',
    power: 3,
    toughness: 2,
    keywords: ['menace'],
    flavor: 'One of you will not be enough.',
  },
  {
    id: 'bramble_warden',
    name: 'Bramble Warden',
    types: ['creature'],
    subtypes: ['Plant', 'Warrior'],
    cost: '{2}{G}',
    power: 2,
    toughness: 4,
    keywords: ['vigilance'],
    flavor: 'It marches out at dawn and never leaves the gate.',
  },
  {
    id: 'timberland_rhino',
    name: 'Timberland Rhino',
    types: ['creature'],
    subtypes: ['Rhino'],
    cost: '{2}{G}{G}',
    power: 4,
    toughness: 4,
    keywords: ['trample'],
    flavor: 'Paths are for things that stop.',
  },
  {
    id: 'cinderwing_drake',
    name: 'Cinderwing Drake',
    types: ['creature'],
    subtypes: ['Drake'],
    cost: '{3}{R}',
    power: 3,
    toughness: 2,
    keywords: ['flying'],
    flavor: 'It leaves a trail of falling sparks.',
  },
  {
    id: 'crag_dragon',
    name: 'Crag Dragon',
    types: ['creature'],
    subtypes: ['Dragon'],
    cost: '{3}{R}{R}',
    power: 4,
    toughness: 4,
    keywords: ['flying'],
    activated: [
      {
        cost: '{R}',
        targets: [],
        effects: [{ kind: 'pump', power: 1, toughness: 0, to: 'self' }],
      },
    ],
  },
  {
    id: 'ember_snap',
    name: 'Ember Snap',
    types: ['instant'],
    cost: '{R}',
    spell: {
      targets: [{ kind: 'any' }],
      effects: [{ kind: 'damage', amount: 2, to: 0 }],
    },
    flavor: 'Quick as a spark, twice as rude.',
  },
  {
    id: 'magma_lance',
    name: 'Magma Lance',
    types: ['sorcery'],
    cost: '{2}{R}',
    spell: {
      targets: [{ kind: 'creature' }],
      effects: [{ kind: 'damage', amount: 4, to: 0 }],
    },
  },
  {
    id: 'verdant_surge',
    name: 'Verdant Surge',
    types: ['instant'],
    cost: '{G}',
    spell: {
      targets: [{ kind: 'creature' }],
      effects: [{ kind: 'pump', power: 3, toughness: 3, to: 0 }],
    },
    flavor: 'Growth is just violence with patience. Usually.',
  },
  {
    id: 'feral_clash',
    name: 'Feral Clash',
    types: ['sorcery'],
    cost: '{1}{G}',
    spell: {
      targets: [
        { kind: 'creature', controller: 'you' },
        { kind: 'creature', controller: 'opponent' },
      ],
      effects: [{ kind: 'fight', a: 0, b: 1 }],
    },
  },
  {
    id: 'read_the_roots',
    name: 'Read the Roots',
    types: ['sorcery'],
    cost: '{2}{G}',
    spell: {
      targets: [],
      effects: [{ kind: 'draw', amount: 2 }],
    },
    flavor: 'Every tree remembers the forest.',
  },
];

const registry = new Map<string, CardDef>();
const costCache = new Map<string, ManaCost>();

export function registerCard(def: CardDef): void {
  validateCardDef(def);
  registry.set(def.id, def);
  costCache.delete(def.id);
}

export function getCardDef(id: string): CardDef {
  const def = registry.get(id);
  if (!def) throw new Error(`Unknown card definition "${id}"`);
  return def;
}

export function hasCardDef(id: string): boolean {
  return registry.has(id);
}

export function allCardDefs(): CardDef[] {
  return [...registry.values()];
}

export function getCost(defId: string): ManaCost {
  let cost = costCache.get(defId);
  if (!cost) {
    cost = parseCost(getCardDef(defId).cost);
    costCache.set(defId, cost);
  }
  return cost;
}

export function validateCardDef(def: CardDef): void {
  const fail = (reason: string): never => {
    throw new Error(`Invalid card "${def.id}": ${reason}`);
  };
  if (!def.id || !def.name) fail('id and name are required');
  if (def.types.length === 0) fail('at least one type is required');
  parseCost(def.cost);
  const isCreature = def.types.includes('creature');
  const isLand = def.types.includes('land');
  const isSpell = def.types.includes('instant') || def.types.includes('sorcery');
  if (isCreature && (def.power === undefined || def.toughness === undefined)) fail('creatures need power and toughness');
  if (isLand && def.cost) fail('lands have no mana cost');
  if (isSpell && !def.spell) fail('instants and sorceries need a spell ability');
  if (!isSpell && def.spell) fail('only instants and sorceries have a spell ability');
  const abilities = [def.spell, ...(def.triggers ?? []), ...(def.activated ?? [])];
  for (const ability of abilities) {
    if (!ability) continue;
    for (const effect of ability.effects) {
      const refs = effect.kind === 'fight' ? [effect.a, effect.b] : 'to' in effect ? [effect.to] : [];
      for (const ref of refs) {
        if (ref === 'self' && !isCreature) fail('"self" effects need a permanent source');
        if (typeof ref === 'number' && (ref < 0 || ref >= ability.targets.length)) fail(`effect refers to missing target ${ref}`);
      }
    }
  }
}

for (const def of CORE_CARDS) registerCard(def);
