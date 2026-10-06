import { CORE_CARDS } from './cards';
import { parseCost } from './mana';
import { RELIC_DEFS } from './relics';
import { CARD_TEXTS, localizer } from './text/content';
import type { CardDef, ManaCost, TriggerEvent } from './types';

const RELIC_EVENTS: ReadonlySet<TriggerEvent> = new Set([
  'upkeep',
  'spell',
  'allyEnters',
  'allyDies',
  'lifeGain',
  'landfall',
]);

const registry = new Map<string, CardDef>();
const translations = localizer<CardDef>(CARD_TEXTS);
const costCache = new Map<string, ManaCost>();

export function registerCard(def: CardDef): void {
  validateCardDef(def);
  registry.set(def.id, def);
  costCache.delete(def.id);
  translations.forget(def.id);
}

export function getCardDef(id: string): CardDef {
  const def = registry.get(id);
  if (!def) throw new Error(`Unknown card definition "${id}"`);
  return translations.localize(def);
}

export function hasCardDef(id: string): boolean {
  return registry.has(id);
}

export function allCardDefs(): CardDef[] {
  return [...registry.values()].map((def) => translations.localize(def));
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
  if (isCreature && (def.power === undefined || def.toughness === undefined))
    fail('creatures need power and toughness');
  if (isLand && def.cost) fail('lands have no mana cost');
  if (isSpell && !def.spell) fail('instants and sorceries need a spell ability');
  if (!isSpell && def.spell) fail('only instants and sorceries have a spell ability');
  if (def.token && (!isCreature || def.cost)) fail('tokens are creatures without a mana cost');
  if (def.entersTapped && !isLand) fail('only lands enter tapped');
  if (def.types.includes('relic')) {
    if (def.types.length > 1) fail('a relic has no other type');
    if (
      def.cost ||
      def.power !== undefined ||
      def.toughness !== undefined ||
      def.keywords?.length ||
      def.mana?.length ||
      def.activated?.length ||
      def.token
    ) {
      fail('a relic has nothing but triggered abilities');
    }
    if (!def.triggers?.length) fail('a relic needs a triggered ability');
    for (const trigger of def.triggers ?? []) {
      if (!RELIC_EVENTS.has(trigger.on)) fail(`a relic cannot trigger on "${trigger.on}"`);
      if (trigger.targets.length > 0) fail('relic abilities have no targets');
    }
  }
  const abilities = [def.spell, ...(def.triggers ?? []), ...(def.activated ?? [])];
  for (const ability of abilities) {
    if (!ability) continue;
    const discards = ability.effects.filter((effect) => effect.kind === 'discard').length;
    if (discards > 1 || (discards === 1 && ability.effects.at(-1)?.kind !== 'discard'))
      fail('a discard must be the last effect');
    if (ability.effects.some((effect) => effect.kind === 'returnToBattlefield'))
      fail('returning to the battlefield is undying only');
    const regains = ability.effects.some((effect) => effect.kind === 'gainLife' || effect.kind === 'damage');
    if ('on' in ability && ability.on === 'lifeGain' && regains)
      fail('a "whenever you gain life" ability cannot gain life or deal damage');
    const sacrificed = 'sacrifice' in ability && ability.sacrifice === true;
    for (const effect of ability.effects) {
      if (effect.kind === 'extraLands' && effect.amount < 1) fail('extra land plays need a positive amount');
      if (effect.kind === 'searchLand') {
        const hand = effect.hand ?? 0;
        if (effect.battlefield < 0 || hand < 0 || effect.battlefield + hand === 0)
          fail('a land search needs cards to find');
        if (effect.battlefield > 0 && hand > 0 && (effect.battlefield !== 1 || hand !== 1)) {
          fail('a land search that splits its cards puts one onto the battlefield and the other into the hand');
        }
      }
      if (sacrificed && 'to' in effect && effect.to === 'self')
        fail('an ability that sacrifices its creature cannot affect it');
      const refs =
        effect.kind === 'fight' || effect.kind === 'bite' ? [effect.a, effect.b] : 'to' in effect ? [effect.to] : [];
      for (const ref of refs) {
        if (ref === 'self' && !isCreature) fail('"self" effects need a permanent source');
        if (typeof ref === 'number' && (ref < 0 || ref >= ability.targets.length))
          fail(`effect refers to missing target ${ref}`);
        const spec = typeof ref === 'number' ? ability.targets[ref] : undefined;
        if (effect.kind === 'counter' && spec?.kind !== 'spell') fail('counter effects need a spell target');
        if (effect.kind !== 'counter' && spec?.kind === 'spell')
          fail('only counter effects can refer to a spell target');
      }
    }
  }
}

for (const def of [...CORE_CARDS, ...RELIC_DEFS]) registerCard(def);
