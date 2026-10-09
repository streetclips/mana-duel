import { canPay, choosePayment, manaValue, parseCost, type ManaSource } from './mana';
import { getCardDef, getCost } from './registry';
import type {
  CardDef,
  CardId,
  CardInstance,
  GameState,
  Keyword,
  ManaCost,
  PlayerId,
  PlayerState,
  TriggerCondition,
  TriggerEvent,
  TriggeredAbility,
  Zone,
} from './types';

export const UNDYING_TRIGGER = -1;
export const EVOLVE_TRIGGER = -2;
export const PROWESS_TRIGGER = -3;

const UNDYING_ABILITY: TriggeredAbility = {
  on: 'dies',
  targets: [],
  effects: [{ kind: 'returnToBattlefield', counters: 1 }],
};

const EVOLVE_ABILITY: TriggeredAbility = {
  on: 'allyEnters',
  targets: [],
  effects: [{ kind: 'addCounters', amount: 1, to: 'self' }],
};

const PROWESS_ABILITY: TriggeredAbility = {
  on: 'spell',
  targets: [],
  effects: [{ kind: 'pump', power: 1, toughness: 1, to: 'self' }],
};

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
    command: [...p.command],
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

export function isInstantOrSorceryDef(def: CardDef): boolean {
  return def.types.includes('instant') || def.types.includes('sorcery');
}

export function hasFlashDef(def: CardDef): boolean {
  return (def.keywords ?? []).includes('flash');
}

export function isTokenDef(def: CardDef): boolean {
  return def.token === true;
}

export function triggeredAbility(def: CardDef, index: number): TriggeredAbility | undefined {
  if (index === UNDYING_TRIGGER) return UNDYING_ABILITY;
  if (index === EVOLVE_TRIGGER) return EVOLVE_ABILITY;
  if (index === PROWESS_TRIGGER) return PROWESS_ABILITY;
  return def.triggers?.[index];
}

export function isRelicDef(def: CardDef): boolean {
  return def.types.includes('relic');
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

export function triggerSources(s: GameState, player: PlayerId): CardId[] {
  return [...s.players[player].battlefield, ...s.players[player].command];
}

export function allCreatures(s: GameState): CardId[] {
  return [...creaturesOf(s, 0), ...creaturesOf(s, 1)];
}

export function getPower(s: GameState, id: CardId): number {
  let power = (defOf(s, id).power ?? 0) + getCard(s, id).counters;
  for (const effect of s.effects) if (effect.card === id) power += effect.power;
  return power;
}

export function getToughness(s: GameState, id: CardId): number {
  let toughness = (defOf(s, id).toughness ?? 0) + getCard(s, id).counters;
  for (const effect of s.effects) if (effect.card === id) toughness += effect.toughness;
  return toughness;
}

export function getKeywords(s: GameState, id: CardId): Keyword[] {
  const printed = defOf(s, id).keywords ?? [];
  let keywords = printed;
  for (const effect of s.effects) {
    if (effect.card !== id || !effect.keywords) continue;
    for (const keyword of effect.keywords) {
      if (keywords.includes(keyword)) continue;
      if (keywords === printed) keywords = [...printed];
      keywords.push(keyword);
    }
  }
  return keywords;
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
    case 'command':
      return s.players[card.owner].command;
    case 'battlefield':
      return s.players[card.controller].battlefield;
    case 'stack':
    case 'gone':
      return null;
  }
}

export interface MoveOptions {
  toBottom?: boolean;
  controller?: PlayerId;
  watchers?: CardId[];
}

function removeFromList(list: CardId[] | null, id: CardId): void {
  if (!list) return;
  const index = list.indexOf(id);
  if (index >= 0) list.splice(index, 1);
}

function evolves(s: GameState, evolver: CardId, newcomer: CardId): boolean {
  if (!hasKeyword(s, evolver, 'evolve')) return false;
  return getPower(s, newcomer) > getPower(s, evolver) || getToughness(s, newcomer) > getToughness(s, evolver);
}

function enterBattlefield(s: GameState, id: CardId): void {
  const card = getCard(s, id);
  const def = getCardDef(card.def);
  const creature = isCreatureDef(def);
  card.summoningSick = creature;
  if (def.entersTapped) card.tapped = true;
  s.events.push({ t: 'enter', player: card.controller, card: id });
  queueTriggers(s, id, 'enters', card.controller);
  if (isLandDef(def)) {
    for (const other of triggerSources(s, card.controller)) queueTriggers(s, other, 'landfall', card.controller);
  }
  if (!creature) return;
  for (const other of triggerSources(s, card.controller)) {
    if (other === id) continue;
    queueTriggers(s, other, 'allyEnters', card.controller);
    if (evolves(s, other, id))
      s.triggers.push({ id: newId(s, 't'), controller: card.controller, source: other, ability: EVOLVE_TRIGGER });
  }
}

export function createToken(s: GameState, defId: string, controller: PlayerId): CardId {
  const id = newId(s, 'tk');
  s.cards[id] = {
    id,
    def: defId,
    owner: controller,
    controller,
    zone: 'battlefield',
    tapped: false,
    summoningSick: false,
    damage: 0,
    deathtouchDamage: false,
    counters: 0,
  };
  s.players[controller].battlefield.push(id);
  s.events.push({ t: 'create', player: controller, card: id });
  enterBattlefield(s, id);
  return id;
}

export function moveCard(s: GameState, id: CardId, to: Zone, options: MoveOptions = {}): void {
  const card = getCard(s, id);
  const from = card.zone;
  const def = getCardDef(card.def);
  removeFromList(zoneList(s, card, from), id);
  const previousController = card.controller;
  const undying = from === 'battlefield' && card.counters === 0 && getKeywords(s, id).includes('undying');

  if (from === 'battlefield') {
    card.tapped = false;
    card.summoningSick = false;
    card.damage = 0;
    card.deathtouchDamage = false;
    card.counters = 0;
    s.effects = s.effects.filter((effect) => effect.card !== id);
    removeFromCombat(s, id);
    loseTargetsOn(s, id);
  }

  card.zone = to;
  card.controller = to === 'battlefield' ? (options.controller ?? card.controller) : card.owner;
  const toList = zoneList(s, card, to);
  if (toList) {
    if (options.toBottom || to !== 'library') toList.push(id);
    else toList.unshift(id);
  }

  if (from === 'battlefield' && to === 'graveyard' && isCreatureDef(def)) {
    s.events.push({ t: 'dies', card: id, player: previousController });
    queueTriggers(s, id, 'dies', previousController);
    for (const watcher of options.watchers ?? triggerSources(s, previousController)) {
      if (watcher !== id) queueTriggers(s, watcher, 'allyDies', previousController);
    }
    if (undying)
      s.triggers.push({ id: newId(s, 't'), controller: previousController, source: id, ability: UNDYING_TRIGGER });
  }
  if (to === 'battlefield') enterBattlefield(s, id);
  if (isTokenDef(def) && to !== 'battlefield') {
    removeFromList(zoneList(s, card, to), id);
    card.zone = 'gone';
  }
}

function loseTargetsOn(s: GameState, id: CardId): void {
  for (const item of s.stack) {
    item.targets.forEach((target, index) => {
      if ('card' in target && target.card === id && !item.lost?.includes(index))
        item.lost = [...(item.lost ?? []), index];
    });
  }
}

export function removeFromCombat(s: GameState, id: CardId): void {
  const combat = s.combat;
  if (!combat) return;
  combat.attackers = combat.attackers.filter((attacker) => attacker !== id);
  combat.blocks = combat.blocks.filter((block) => block.blocker !== id && block.attacker !== id);
}

function conditionHolds(s: GameState, condition: TriggerCondition | undefined, controller: PlayerId): boolean {
  switch (condition) {
    case undefined:
      return true;
    case 'opponentDamaged':
      return s.players[opponent(controller)].damagedThisTurn;
    case 'emptyHand':
      return s.players[controller].hand.length === 0;
  }
}

export function queueTriggers(s: GameState, source: CardId, event: TriggerEvent, controller: PlayerId): void {
  const triggers = defOf(s, source).triggers ?? [];
  triggers.forEach((trigger, ability) => {
    if (trigger.on === event && conditionHolds(s, trigger.condition, controller))
      s.triggers.push({ id: newId(s, 't'), controller, source, ability });
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
  if (delta > 0) for (const id of triggerSources(s, player)) queueTriggers(s, id, 'lifeGain', player);
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

function manaWants(s: GameState, player: PlayerId, exclude?: CardId): ManaCost[] {
  const wants: ManaCost[] = [];
  for (const id of s.players[player].hand) {
    if (id === exclude || isLandDef(defOf(s, id))) continue;
    wants.push(getCost(getCard(s, id).def));
  }
  for (const id of s.players[player].battlefield) {
    for (const ability of defOf(s, id).activated ?? []) {
      const cost = parseCost(ability.cost);
      if (manaValue(cost) > 0) wants.push(cost);
    }
  }
  return wants;
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
    manaWants(s, player, options.excludeFromDemand),
  );
}

export function canAfford(s: GameState, player: PlayerId, cost: ManaCost, excludeSource?: CardId): boolean {
  return canPay(manaSources(s, player, excludeSource), cost);
}

export function tapCards(s: GameState, ids: CardId[]): void {
  for (const id of ids) getCard(s, id).tapped = true;
}
