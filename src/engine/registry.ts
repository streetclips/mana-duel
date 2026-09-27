import { CORE_CARDS } from './cards';
import { parseCost } from './mana';
import type { CardDef, ManaCost } from './types';

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
        const spec = typeof ref === 'number' ? ability.targets[ref] : undefined;
        if (effect.kind === 'counter' && spec?.kind !== 'spell') fail('counter effects need a spell target');
        if (effect.kind !== 'counter' && spec?.kind === 'spell') fail('only counter effects can refer to a spell target');
      }
    }
  }
}

for (const def of CORE_CARDS) registerCard(def);
