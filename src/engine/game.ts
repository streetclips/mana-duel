import {
  attackersError,
  blockOptions,
  blocksError,
  defendingPlayer,
  eligibleAttackers,
  hasFirstStrikeCombatant,
  performCombatDamage,
  performDeclareAttackers,
  performDeclareBlockers,
} from './combat';
import { DEFAULT_DECK_ID, expandDeck, resolveDeck, type DeckSpec } from './decks';
import { defaultPlayerNames, refusalText } from './describe';
import { resolveTopOfStack } from './effects';
import { parseCost } from './mana';
import { getCardDef, getCost, hasCardDef } from './registry';
import type { Refusal } from './refusals';
import { normalizeSeed, random, shuffleInPlace } from './rng';
import { activateError, castError, landPlayError } from './rules';
import {
  DEFAULT_TURN_LIMIT,
  MAX_HAND_SIZE,
  MAX_MULLIGANS,
  OPENING_HAND,
  PROWESS_TRIGGER,
  STARTING_LIFE,
  allCreatures,
  cloneState,
  defOf,
  drawCards,
  findPayment,
  getCard,
  getToughness,
  hasKeyword,
  isInstantOrSorceryDef,
  isRelicDef,
  moveCard,
  newId,
  opponent,
  queueTriggers,
  tapCards,
  triggerSources,
  triggeredAbility,
} from './state';
import { targetCombos, targetsError } from './targets';
import type {
  Action,
  CardId,
  GameOverReason,
  GameState,
  PendingDecision,
  PendingTrigger,
  PlayerId,
  PlayerState,
  Step,
  Target,
} from './types';

export class IllegalActionError extends Error {
  readonly refusal: Refusal;

  constructor(refusal: Refusal) {
    super(refusalText(refusal));
    this.name = 'IllegalActionError';
    this.refusal = refusal;
  }
}

function illegal(refusal: Refusal): never {
  throw new IllegalActionError(refusal);
}

export interface PlayerSetup {
  name?: string;
  deck?: DeckSpec | string[];
  life?: number;
  openingHand?: number;
  battlefield?: string[];
  relics?: string[];
  drawOnFirstTurn?: boolean;
}

export interface GameOptions {
  seed?: number;
  players?: [PlayerSetup?, PlayerSetup?];
  startingPlayer?: PlayerId;
  skipMulligans?: boolean;
  turnLimit?: number;
}

export function emptyPlayer(id: PlayerId, name: string): PlayerState {
  return {
    id,
    name,
    life: STARTING_LIFE,
    library: [],
    hand: [],
    battlefield: [],
    graveyard: [],
    command: [],
    landsPlayedThisTurn: 0,
    mulligans: 0,
    kept: false,
    bottomed: false,
    drewFromEmptyLibrary: false,
    conceded: false,
    damagedThisTurn: false,
    extraLandsThisTurn: 0,
  };
}

export function emptyState(seed: number, names: [string, string], turnLimit = DEFAULT_TURN_LIMIT): GameState {
  const normalized = normalizeSeed(seed);
  return {
    seed: normalized,
    rng: normalized,
    nextId: 0,
    turn: 0,
    activePlayer: 0,
    startingPlayer: 0,
    step: 'mulligan',
    stepStarted: false,
    priority: null,
    passes: 0,
    players: [emptyPlayer(0, names[0]), emptyPlayer(1, names[1])],
    cards: {},
    stack: [],
    effects: [],
    combat: null,
    triggers: [],
    pending: null,
    events: [],
    actionCount: 0,
    turnLimit,
  };
}

function resolveDeckList(deck: DeckSpec | string[] | undefined): string[] {
  if (Array.isArray(deck)) {
    for (const id of deck) if (!hasCardDef(id)) throw new Error(`Unknown card definition "${id}"`);
    return [...deck];
  }
  return expandDeck(resolveDeck(deck ?? DEFAULT_DECK_ID));
}

function checkSetup(setup: PlayerSetup): void {
  if (setup.life !== undefined && (!Number.isInteger(setup.life) || setup.life < 1)) {
    throw new Error(`Invalid starting life ${setup.life}: use a whole number from 1`);
  }
  if (setup.openingHand !== undefined && (!Number.isInteger(setup.openingHand) || setup.openingHand < 1)) {
    throw new Error(`Invalid opening hand ${setup.openingHand}: use a whole number from 1`);
  }
  for (const id of setup.battlefield ?? []) {
    if (!hasCardDef(id)) throw new Error(`Unknown card definition "${id}"`);
    const def = getCardDef(id);
    if (!def.types.includes('land') && !def.types.includes('creature'))
      throw new Error(`"${id}" is not a permanent, so it cannot start on the battlefield`);
  }
  for (const id of setup.relics ?? []) {
    if (!hasCardDef(id)) throw new Error(`Unknown card definition "${id}"`);
    if (!isRelicDef(getCardDef(id))) throw new Error(`"${id}" is not a relic`);
  }
}

function placeStartingPermanent(s: GameState, player: PlayerId, defId: string, id: CardId): void {
  s.cards[id] = {
    id,
    def: defId,
    owner: player,
    controller: player,
    zone: 'battlefield',
    tapped: false,
    summoningSick: false,
    damage: 0,
    deathtouchDamage: false,
    counters: 0,
  };
  s.players[player].battlefield.push(id);
}

function placeRelic(s: GameState, player: PlayerId, defId: string, id: CardId): void {
  s.cards[id] = {
    id,
    def: defId,
    owner: player,
    controller: player,
    zone: 'command',
    tapped: false,
    summoningSick: false,
    damage: 0,
    deathtouchDamage: false,
    counters: 0,
  };
  s.players[player].command.push(id);
}

export function createGame(options: GameOptions = {}): GameState {
  const defaults = defaultPlayerNames();
  const names: [string, string] = [
    options.players?.[0]?.name ?? defaults[0],
    options.players?.[1]?.name ?? defaults[1],
  ];
  const s = emptyState(options.seed ?? 1, names, options.turnLimit);
  for (const setup of options.players ?? []) if (setup) checkSetup(setup);
  let counter = 0;
  for (const player of [0, 1] as const) {
    for (const def of resolveDeckList(options.players?.[player]?.deck)) {
      counter += 1;
      const id = `c${counter}`;
      s.cards[id] = {
        id,
        def,
        owner: player,
        controller: player,
        zone: 'library',
        tapped: false,
        summoningSick: false,
        damage: 0,
        deathtouchDamage: false,
        counters: 0,
      };
      s.players[player].library.push(id);
    }
    shuffleInPlace(s, s.players[player].library);
  }
  for (const player of [0, 1] as const) {
    const setup = options.players?.[player];
    const ps = s.players[player];
    if (setup?.life !== undefined) ps.life = setup.life;
    if (setup?.openingHand !== undefined && setup.openingHand !== OPENING_HAND) ps.openingHand = setup.openingHand;
    if (setup?.drawOnFirstTurn) ps.drawOnFirstTurn = true;
    for (const def of setup?.battlefield ?? []) {
      if (getCardDef(def).token) {
        placeStartingPermanent(s, player, def, newId(s, 'tk'));
        continue;
      }
      counter += 1;
      placeStartingPermanent(s, player, def, `c${counter}`);
    }
    for (const def of setup?.relics ?? []) {
      counter += 1;
      placeRelic(s, player, def, `c${counter}`);
    }
  }
  const coin: PlayerId = random(s) < 0.5 ? 0 : 1;
  s.startingPlayer = options.startingPlayer ?? coin;
  s.activePlayer = s.startingPlayer;
  s.events.push({ t: 'start', startingPlayer: s.startingPlayer });
  drawCards(s, s.startingPlayer, openingHandSize(s, s.startingPlayer));
  drawCards(s, opponent(s.startingPlayer), openingHandSize(s, opponent(s.startingPlayer)));
  if (options.skipMulligans) {
    for (const ps of s.players) {
      ps.kept = true;
      ps.bottomed = true;
    }
  }
  advance(s);
  return s;
}

export function openingHandSize(s: GameState, player: PlayerId): number {
  return s.players[player].openingHand ?? OPENING_HAND;
}

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string; refusal: Refusal };

export function applyAction(state: GameState, action: Action): GameState {
  const s = cloneState(state);
  s.events = [];
  performAction(s, action);
  s.actionCount += 1;
  advance(s);
  return s;
}

export function tryApplyAction(state: GameState, action: Action): ActionResult {
  try {
    return { ok: true, state: applyAction(state, action) };
  } catch (error) {
    if (error instanceof IllegalActionError) return { ok: false, error: error.message, refusal: error.refusal };
    throw error;
  }
}

function expectPending<K extends PendingDecision['kind']>(
  s: GameState,
  kind: K,
  player: PlayerId,
): Extract<PendingDecision, { kind: K }> {
  const pending = s.pending as Extract<PendingDecision, { kind: K }> | null;
  if (!pending || pending.kind !== kind) illegal({ code: 'notWaitingFor', kind });
  if (!('player' in pending) || pending.player !== player) illegal({ code: 'notTheirDecision', player });
  return pending;
}

function validateCardSelection(s: GameState, player: PlayerId, cards: unknown, count: number): CardId[] {
  if (!Array.isArray(cards)) illegal({ code: 'cardsNotList' });
  if (cards.length !== count) illegal({ code: 'chooseExactly', count });
  const hand = s.players[player].hand;
  const unique = new Set<string>();
  for (const id of cards) {
    if (typeof id !== 'string' || !hand.includes(id)) illegal({ code: 'chosenNotInHand', card: String(id) });
    if (unique.has(id)) illegal({ code: 'chosenTwice', card: id });
    unique.add(id);
  }
  return cards as CardId[];
}

function performAction(s: GameState, action: Action): void {
  if (!action || typeof action !== 'object' || typeof action.type !== 'string') illegal({ code: 'malformedAction' });
  if (action.player !== 0 && action.player !== 1) illegal({ code: 'unknownPlayer' });
  const pending = s.pending;
  if (!pending) illegal({ code: 'noDecision' });
  if (pending.kind === 'gameOver') illegal({ code: 'gameOver' });
  const player = action.player;
  const ps = s.players[player];

  switch (action.type) {
    case 'concede': {
      ps.conceded = true;
      s.events.push({ t: 'concede', player });
      s.pending = null;
      return;
    }
    case 'keep': {
      expectPending(s, 'mulligan', player);
      ps.kept = true;
      if (ps.mulligans === 0) ps.bottomed = true;
      s.events.push({ t: 'keep', player, handSize: ps.hand.length - ps.mulligans });
      s.pending = null;
      nextMulliganDecision(s);
      return;
    }
    case 'mulligan': {
      expectPending(s, 'mulligan', player);
      if (ps.mulligans >= MAX_MULLIGANS) illegal({ code: 'noMoreMulligans' });
      for (const id of [...ps.hand]) moveCard(s, id, 'library');
      shuffleInPlace(s, ps.library);
      ps.mulligans += 1;
      s.events.push({ t: 'mulligan', player, count: ps.mulligans });
      drawCards(s, player, openingHandSize(s, player));
      s.pending = null;
      nextMulliganDecision(s);
      return;
    }
    case 'bottom': {
      const decision = expectPending(s, 'bottom', player);
      const cards = validateCardSelection(s, player, action.cards, decision.count);
      for (const id of cards) moveCard(s, id, 'library', { toBottom: true });
      ps.bottomed = true;
      s.events.push({ t: 'bottom', player, count: cards.length });
      s.pending = null;
      nextMulliganDecision(s);
      return;
    }
    case 'pass': {
      expectPending(s, 'priority', player);
      s.pending = null;
      s.passes += 1;
      if (s.passes >= 2) {
        s.passes = 0;
        if (s.stack.length > 0) {
          resolveTopOfStack(s);
          s.priority = s.activePlayer;
        } else {
          s.priority = null;
        }
      } else {
        s.priority = opponent(player);
      }
      return;
    }
    case 'playLand': {
      expectPending(s, 'priority', player);
      const error = landPlayError(s, player, action.card);
      if (error) illegal(error);
      moveCard(s, action.card, 'battlefield', { controller: player });
      ps.landsPlayedThisTurn += 1;
      s.events.push({ t: 'land', player, card: action.card });
      s.pending = null;
      s.passes = 0;
      s.priority = player;
      return;
    }
    case 'cast': {
      expectPending(s, 'priority', player);
      const targets = action.targets ?? [];
      const error = castError(s, player, action.card, targets);
      if (error) illegal(error);
      const payment = findPayment(s, player, getCost(getCard(s, action.card).def), {
        excludeFromDemand: action.card,
      });
      if (!payment) illegal({ code: 'notEnoughMana' });
      tapCards(s, payment);
      moveCard(s, action.card, 'stack');
      s.stack.push({ id: newId(s, 's'), kind: 'spell', controller: player, card: action.card, targets: [...targets] });
      s.events.push({ t: 'cast', player, card: action.card, targets: [...targets] });
      if (isInstantOrSorceryDef(defOf(s, action.card))) {
        for (const id of triggerSources(s, player)) {
          queueTriggers(s, id, 'spell', player);
          if (hasKeyword(s, id, 'prowess'))
            s.triggers.push({ id: newId(s, 't'), controller: player, source: id, ability: PROWESS_TRIGGER });
        }
      }
      s.pending = null;
      s.passes = 0;
      s.priority = player;
      return;
    }
    case 'activate': {
      expectPending(s, 'priority', player);
      const targets = action.targets ?? [];
      const error = activateError(s, player, action.card, action.ability, targets);
      if (error) illegal(error);
      const ability = defOf(s, action.card).activated?.[action.ability];
      if (!ability) illegal({ code: 'noSuchAbility' });
      const payment = findPayment(s, player, parseCost(ability.cost), {
        excludeSource: ability.tap ? action.card : undefined,
      });
      if (!payment) illegal({ code: 'notEnoughMana' });
      tapCards(s, payment);
      if (ability.tap) getCard(s, action.card).tapped = true;
      s.stack.push({
        id: newId(s, 's'),
        kind: 'activated',
        controller: player,
        source: action.card,
        ability: action.ability,
        targets: [...targets],
      });
      s.events.push({ t: 'activate', player, card: action.card, ability: action.ability, targets: [...targets] });
      if (ability.sacrifice) moveCard(s, action.card, 'graveyard');
      s.pending = null;
      s.passes = 0;
      s.priority = player;
      return;
    }
    case 'declareAttackers': {
      expectPending(s, 'declareAttackers', player);
      const error = attackersError(s, action.attackers);
      if (error) illegal(error);
      s.pending = null;
      performDeclareAttackers(s, action.attackers);
      if (action.attackers.length > 0) {
        s.priority = s.activePlayer;
        s.passes = 0;
      }
      return;
    }
    case 'declareBlockers': {
      expectPending(s, 'declareBlockers', player);
      const error = blocksError(s, action.blocks);
      if (error) illegal(error);
      s.pending = null;
      performDeclareBlockers(s, action.blocks);
      s.priority = s.activePlayer;
      s.passes = 0;
      return;
    }
    case 'chooseTargets': {
      const decision = expectPending(s, 'chooseTargets', player);
      const trigger = s.triggers.find((candidate) => candidate.id === decision.trigger);
      if (!trigger) illegal({ code: 'triggerGone' });
      const ability = triggeredAbility(defOf(s, trigger.source), trigger.ability);
      const error = targetsError(s, player, ability?.targets ?? [], action.targets ?? []);
      if (error) illegal(error);
      s.triggers = s.triggers.filter((candidate) => candidate.id !== trigger.id);
      pushTrigger(s, trigger, action.targets);
      s.pending = null;
      return;
    }
    case 'discard': {
      const decision = expectPending(s, 'discard', player);
      const cards = validateCardSelection(s, player, action.cards, decision.count);
      for (const id of cards) {
        moveCard(s, id, 'graveyard');
        s.events.push({ t: 'discard', player, card: id });
      }
      s.pending = null;
      if (decision.source === undefined) finishCleanup(s);
      return;
    }
    default:
      illegal({ code: 'unknownAction', type: (action as { type: string }).type });
  }
}

function nextMulliganDecision(s: GameState): void {
  for (const player of [s.startingPlayer, opponent(s.startingPlayer)]) {
    const ps = s.players[player];
    if (!ps.kept) {
      s.pending = { kind: 'mulligan', player };
      return;
    }
    if (!ps.bottomed) {
      s.pending = { kind: 'bottom', player, count: ps.mulligans };
      return;
    }
  }
}

export function advance(s: GameState): void {
  for (let guard = 0; guard < 10_000; guard++) {
    runStateBasedActions(s);
    if (s.pending) return;
    if (s.triggers.length > 0) {
      if (putNextTriggerOnStack(s)) return;
      continue;
    }
    if (s.priority !== null) {
      s.pending = { kind: 'priority', player: s.priority };
      return;
    }
    if (!s.stepStarted) {
      s.stepStarted = true;
      beginStep(s);
      continue;
    }
    goToNextStep(s);
  }
  throw new Error('advance() did not settle');
}

function losingReason(ps: PlayerState): GameOverReason | null {
  if (ps.conceded) return 'concede';
  if (ps.life <= 0) return 'life';
  if (ps.drewFromEmptyLibrary) return 'decked';
  return null;
}

function endGame(s: GameState, winner: PlayerId | null, reason: GameOverReason): void {
  s.pending = { kind: 'gameOver', winner, reason };
  s.priority = null;
  s.events.push({ t: 'gameOver', winner, reason });
}

function runStateBasedActions(s: GameState): void {
  if (s.pending?.kind === 'gameOver') return;
  for (let guard = 0; guard < 100; guard++) {
    const reasons = s.players.map(losingReason);
    const losers = ([0, 1] as const).filter((player) => reasons[player] !== null);
    const firstLoser = losers[0];
    if (firstLoser !== undefined) {
      const winner = losers.length === 2 ? null : opponent(firstLoser);
      endGame(s, winner, reasons[firstLoser] ?? 'life');
      return;
    }
    const dying = allCreatures(s).filter((id) => {
      const card = getCard(s, id);
      const toughness = getToughness(s, id);
      return toughness <= 0 || card.damage >= toughness || (card.deathtouchDamage && card.damage > 0);
    });
    if (dying.length === 0) return;
    const watchers: [CardId[], CardId[]] = [triggerSources(s, 0), triggerSources(s, 1)];
    for (const id of dying) moveCard(s, id, 'graveyard', { watchers: watchers[getCard(s, id).controller] });
  }
}

function putNextTriggerOnStack(s: GameState): boolean {
  const index = Math.max(
    0,
    s.triggers.findIndex((trigger) => trigger.controller === s.activePlayer),
  );
  const trigger = s.triggers[index] as PendingTrigger;
  const ability = triggeredAbility(defOf(s, trigger.source), trigger.ability);
  if (!ability) {
    s.triggers.splice(index, 1);
    return false;
  }
  if (ability.targets.length > 0) {
    if (targetCombos(s, trigger.controller, ability.targets).length === 0) {
      s.triggers.splice(index, 1);
      return false;
    }
    s.pending = { kind: 'chooseTargets', player: trigger.controller, trigger: trigger.id };
    return true;
  }
  s.triggers.splice(index, 1);
  pushTrigger(s, trigger, []);
  return false;
}

function pushTrigger(s: GameState, trigger: PendingTrigger, targets: Target[]): void {
  s.stack.push({
    id: newId(s, 's'),
    kind: 'trigger',
    controller: trigger.controller,
    source: trigger.source,
    ability: trigger.ability,
    targets: [...targets],
  });
  s.events.push({
    t: 'trigger',
    player: trigger.controller,
    card: trigger.source,
    ability: trigger.ability,
    targets: [...targets],
  });
  if (s.priority === null) s.priority = s.activePlayer;
  s.passes = 0;
}

function beginStep(s: GameState): void {
  const active = s.activePlayer;
  switch (s.step) {
    case 'mulligan':
      nextMulliganDecision(s);
      return;
    case 'untap':
      for (const id of s.players[active].battlefield) {
        const card = getCard(s, id);
        card.tapped = false;
        card.summoningSick = false;
      }
      s.players[active].landsPlayedThisTurn = 0;
      return;
    case 'upkeep':
      for (const id of triggerSources(s, active)) queueTriggers(s, id, 'upkeep', active);
      return;
    case 'draw':
      if (s.turn !== 1 || s.players[active].drawOnFirstTurn) drawCards(s, active, 1);
      return;
    case 'main1':
    case 'main2':
    case 'end':
      s.priority = active;
      s.passes = 0;
      return;
    case 'beginCombat':
      s.combat = { attackers: [], blocks: [], blockersDeclared: false, blocked: [], firstStrikers: null };
      return;
    case 'declareAttackers':
      if (eligibleAttackers(s).length > 0) s.pending = { kind: 'declareAttackers', player: active };
      return;
    case 'declareBlockers':
      if (Object.keys(blockOptions(s)).length > 0) {
        s.pending = { kind: 'declareBlockers', player: defendingPlayer(s) };
      } else {
        performDeclareBlockers(s, []);
        s.priority = active;
        s.passes = 0;
      }
      return;
    case 'firstStrikeDamage':
      performCombatDamage(s, 'first');
      return;
    case 'combatDamage':
      performCombatDamage(s, 'regular');
      return;
    case 'endCombat':
      s.combat = null;
      return;
    case 'cleanup': {
      const excess = s.players[active].hand.length - MAX_HAND_SIZE;
      if (excess > 0) s.pending = { kind: 'discard', player: active, count: excess };
      else finishCleanup(s);
      return;
    }
  }
}

function finishCleanup(s: GameState): void {
  for (const id of allCreatures(s)) {
    const card = getCard(s, id);
    card.damage = 0;
    card.deathtouchDamage = false;
  }
  s.effects = s.effects.filter((effect) => effect.until !== 'endOfTurn');
}

export function nextStepOf(s: GameState): Step {
  switch (s.step) {
    case 'mulligan':
      return 'untap';
    case 'untap':
      return 'upkeep';
    case 'upkeep':
      return 'draw';
    case 'draw':
      return 'main1';
    case 'main1':
      return 'beginCombat';
    case 'beginCombat':
      return 'declareAttackers';
    case 'declareAttackers':
      return (s.combat?.attackers.length ?? 0) > 0 ? 'declareBlockers' : 'endCombat';
    case 'declareBlockers':
      return hasFirstStrikeCombatant(s) ? 'firstStrikeDamage' : 'combatDamage';
    case 'firstStrikeDamage':
      return 'combatDamage';
    case 'combatDamage':
      return 'endCombat';
    case 'endCombat':
      return 'main2';
    case 'main2':
      return 'end';
    case 'end':
      return 'cleanup';
    case 'cleanup':
      return 'untap';
  }
}

function goToNextStep(s: GameState): void {
  const next = nextStepOf(s);
  if (next === 'untap') {
    if (s.step === 'mulligan') {
      s.turn = 1;
      s.activePlayer = s.startingPlayer;
    } else {
      s.turn += 1;
      s.activePlayer = opponent(s.activePlayer);
    }
    for (const ps of s.players) {
      ps.damagedThisTurn = false;
      ps.extraLandsThisTurn = 0;
    }
    s.events.push({ t: 'turn', turn: s.turn, player: s.activePlayer });
    if (s.turn > s.turnLimit) {
      endGame(s, null, 'turnLimit');
      return;
    }
  }
  s.step = next;
  s.stepStarted = false;
  s.priority = null;
  s.passes = 0;
}
