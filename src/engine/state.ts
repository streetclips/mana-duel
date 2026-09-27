import { getCardDef, getCost } from './cards';
import { choosePayment, type ManaSource } from './mana';
import type {
  CardDef,
  CardId,
  CardInstance,
  Color,
  GameState,
  Keyword,
  ManaCost,
  PlayerId,
  PlayerState,
  TriggerEvent,
  Zone,
} from './types';

export const STARTING_LIFE = 20;
export const OPENING_HAND = 7;
export const MAX_HAND_SIZE = 7;
export const MAX_MULLIGANS = 6;
export const DEFAULT_TURN_LIMIT = 200;

export function opponent(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0;
}

export function cloneState(s: GameState): GameState {
  const cards: Record<CardId, CardInstance> = {};
  for (const id in s.cards) cards[id] = { ...(s.cards[id] as CardInstance) };
  return {
    ...s,
    players: [clonePlayer(s.players[0]), clonePlayer(s.players[1])],
    cards,
    stack: s.stack.map((item) => ({ ...item, targets: [...item.targets] })),
    effects: s.effects.map((effect) => ({ ...effect })),
    combat: s.combat && {
      attackers: [...s.combat.attackers],
      blocks: s.combat.blocks.map((block) => ({ ...block })),
      blockersDeclared: s.combat.blockersDeclared,
      blocked: [...s.combat.blocked],
      firstStrikers: s.combat.firstStrikers && [...s.combat.firstStrikers],
    },
    triggers: s.triggers.map((trigger) => ({ ...trigger })),
    pending: s.pending && { ...s.pending },
    events: [...s.events],
  };
}

function clonePlayer(p: PlayerState): PlayerState {
  return {
    ...p,
    library: [...p.library],
    hand: [...p.hand],
    battlefield: [...p.battlefield],
    graveyard: [...p.graveyard],
  };
}

export function newId(s: GameState, prefix: string): string {
  s.nextId += 1;
  return `${prefix}${s.nextId}`;
}

export function getCard(s: GameState, id: CardId): CardInstance {
  const card = s.cards[id];
  if (!card) throw new Error(`Unknown card "${id}"`);
  return card;
}

export function defOf(s: GameState, id: CardId): CardDef {
  return getCardDef(getCard(s, id).def);
}

export function isCreatureDef(def: CardDef): boolean {
  return def.types.includes('creature');
}

export function isLandDef(def: CardDef): boolean {
  return def.types.includes('land');
}

export function isInstantDef(def: CardDef): boolean {
  return def.types.includes('instant');
}

export function isPermanentDef(def: CardDef): boolean {
  return def.types.includes('creature') || def.types.includes('land');
}

export function isCreature(s: GameState, id: CardId): boolean {
  return isCreatureDef(defOf(s, id));
}

export function isLand(s: GameState, id: CardId): boolean {
  return isLandDef(defOf(s, id));
}

export function onBattlefield(s: GameState, id: CardId): boolean {
  return s.cards[id]?.zone === 'battlefield';
}

export function creaturesOf(s: GameState, player: PlayerId): CardId[] {
  return s.players[player].battlefield.filter((id) => isCreature(s, id));
}

export function landsOf(s: GameState, player: PlayerId): CardId[] {
  return s.players[player].battlefield.filter((id) => isLand(s, id));
}

export function allCreatures(s: GameState): CardId[] {
  return [...creaturesOf(s, 0), ...creaturesOf(s, 1)];
}

export function getPower(s: GameState, id: CardId): number {
  let power = defOf(s, id).power ?? 0;
  for (const effect of s.effects) if (effect.card === id) power += effect.power;
  return power;
}

export function getToughness(s: GameState, id: CardId): number {
  let toughness = defOf(s, id).toughness ?? 0;
  for (const effect of s.effects) if (effect.card === id) toughness += effect.toughness;
  return toughness;
}

export function getKeywords(s: GameState, id: CardId): Keyword[] {
  return defOf(s, id).keywords ?? [];
}

export function hasKeyword(s: GameState, id: CardId, keyword: Keyword): boolean {
  return getKeywords(s, id).includes(keyword);
}

export function isReadyToTap(s: GameState, id: CardId): boolean {
  const card = getCard(s, id);
  if (!isCreature(s, id)) return true;
  return !card.summoningSick || hasKeyword(s, id, 'haste');
}

function zoneList(s: GameState, card: CardInstance, zone: Zone): CardId[] | null {
  switch (zone) {
    case 'library':
      return s.players[card.owner].library;
    case 'hand':
      return s.players[card.owner].hand;
    case 'graveyard':
      return s.players[card.owner].graveyard;
    case 'battlefield':
      return s.players[card.controller].battlefield;
    case 'stack':
      return null;
  }
}

export interface MoveOptions {
  toBottom?: boolean;
  controller?: PlayerId;
}

export function moveCard(s: GameState, id: CardId, to: Zone, options: MoveOptions = {}): void {
  const card = getCard(s, id);
  const from = card.zone;
  const fromList = zoneList(s, card, from);
  if (fromList) {
    const index = fromList.indexOf(id);
    if (index >= 0) fromList.splice(index, 1);
  }
  const previousController = card.controller;

  if (from === 'battlefield') {
    card.tapped = false;
    card.summoningSick = false;
    card.damage = 0;
    card.deathtouchDamage = false;
    s.effects = s.effects.filter((effect) => effect.card !== id);
    removeFromCombat(s, id);
  }

  card.zone = to;
  card.controller = to === 'battlefield' ? (options.controller ?? card.controller) : card.owner;
  const toList = zoneList(s, card, to);
  if (toList) {
    if (options.toBottom || to !== 'library') toList.push(id);
    else toList.unshift(id);
  }

  const def = getCardDef(card.def);
  if (from === 'battlefield' && to === 'graveyard' && isCreatureDef(def)) {
    s.events.push({ t: 'dies', card: id, player: previousController });
    queueTriggers(s, id, 'dies', previousController);
  }
  if (to === 'battlefield') {
    card.summoningSick = isCreatureDef(def);
    s.events.push({ t: 'enter', player: card.controller, card: id });
    queueTriggers(s, id, 'enters', card.controller);
  }
}

export function removeFromCombat(s: GameState, id: CardId): void {
  const combat = s.combat;
  if (!combat) return;
  combat.attackers = combat.attackers.filter((attacker) => attacker !== id);
  combat.blocks = combat.blocks.filter((block) => block.blocker !== id && block.attacker !== id);
}

export function queueTriggers(s: GameState, source: CardId, event: TriggerEvent, controller: PlayerId): void {
  const triggers = defOf(s, source).triggers ?? [];
  triggers.forEach((trigger, ability) => {
    if (trigger.on === event) s.triggers.push({ id: newId(s, 't'), controller, source, ability });
  });
}

export function drawCards(s: GameState, player: PlayerId, count: number): void {
  const ps = s.players[player];
  for (let i = 0; i < count; i++) {
    const top = ps.library[0];
    if (top === undefined) {
      ps.drewFromEmptyLibrary = true;
      s.events.push({ t: 'drawEmpty', player });
      continue;
    }
    moveCard(s, top, 'hand');
    s.events.push({ t: 'draw', player, card: top });
  }
}

export function changeLife(s: GameState, player: PlayerId, delta: number): void {
  if (delta === 0) return;
  const ps = s.players[player];
  ps.life += delta;
  s.events.push({ t: 'life', player, delta, life: ps.life });
}

export function manaSources(s: GameState, player: PlayerId, exclude?: CardId): ManaSource[] {
  const sources: ManaSource[] = [];
  for (const id of s.players[player].battlefield) {
    if (id === exclude) continue;
    const card = getCard(s, id);
    const def = getCardDef(card.def);
    if (!def.mana || card.tapped || !isReadyToTap(s, id)) continue;
    sources.push({ id, colors: def.mana, isCreature: isCreatureDef(def) });
  }
  return sources;
}

export function colorDemand(s: GameState, player: PlayerId, exclude?: CardId): Partial<Record<Color, number>> {
  const demand: Partial<Record<Color, number>> = {};
  for (const id of s.players[player].hand) {
    if (id === exclude) continue;
    const cost = getCost(getCard(s, id).def);
    for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
      if (cost[color] > 0) demand[color] = (demand[color] ?? 0) + cost[color];
    }
  }
  return demand;
}

export function findPayment(
  s: GameState,
  player: PlayerId,
  cost: ManaCost,
  options: { excludeSource?: CardId; excludeFromDemand?: CardId } = {},
): CardId[] | null {
  return choosePayment(
    manaSources(s, player, options.excludeSource),
    cost,
    colorDemand(s, player, options.excludeFromDemand),
  );
}

export function tapCards(s: GameState, ids: CardId[]): void {
  for (const id of ids) getCard(s, id).tapped = true;
}
