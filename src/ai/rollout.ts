import {
  applyAction,
  defOf,
  getCard,
  getLegalActions,
  getToughness,
  isPlayerTarget,
  triggeredAbility,
  tryApplyAction,
  type Action,
  type Effect,
  type GameState,
  type PlayerId,
  type Step,
  type Target,
} from '../engine';
import { creatureValue, evaluate } from './evaluate';
import { chooseCardsToDiscard } from './heuristics';

const MAX_ROLLOUT_ACTIONS = 80;
const COMBAT_STEPS: ReadonlySet<Step> = new Set([
  'beginCombat',
  'declareAttackers',
  'declareBlockers',
  'firstStrikeDamage',
  'combatDamage',
  'endCombat',
]);

export function rollout(start: GameState, depth = 0, from: Pick<GameState, 'turn' | 'step'> = start): GameState {
  let s = start;
  const { turn, step } = from;
  for (let i = 0; i < MAX_ROLLOUT_ACTIONS; i++) {
    const pending = s.pending;
    if (!pending || pending.kind === 'gameOver') return s;
    if (pending.kind === 'priority') {
      const moved = s.step !== step || s.turn !== turn;
      if (s.stack.length === 0 && moved && !COMBAT_STEPS.has(s.step)) return s;
      s = applyAction(s, { type: 'pass', player: pending.player });
      continue;
    }
    if (pending.kind === 'chooseTargets') {
      s = applyAction(
        s,
        depth >= 1 ? quickTargets(s, pending.player) : bestAction(s, pending.player, getLegalActions(s), depth + 1),
      );
      continue;
    }
    if (pending.kind === 'discard' && pending.source !== undefined) {
      s = applyAction(s, {
        type: 'discard',
        player: pending.player,
        cards: chooseCardsToDiscard(s, pending.player, pending.count),
      });
      continue;
    }
    return s;
  }
  return s;
}

function controllerOf(s: GameState, target: Target): PlayerId {
  return isPlayerTarget(target) ? target.player : getCard(s, target.card).controller;
}

function targetImpact(s: GameState, player: PlayerId, effect: Effect, targets: Target[]): number {
  const index = 'to' in effect && typeof effect.to === 'number' ? effect.to : null;
  const target = index === null ? undefined : targets[index];
  if (!target) return 0;
  const side = controllerOf(s, target) === player ? -1 : 1;
  if (isPlayerTarget(target)) return effect.kind === 'damage' ? side * effect.amount * 0.5 : 0;
  const value = creatureValue(s, target.card);
  const remaining = getToughness(s, target.card) - getCard(s, target.card).damage;
  switch (effect.kind) {
    case 'damage':
      return side * (effect.amount >= remaining ? value : effect.amount * 0.3);
    case 'destroy':
    case 'bounce':
      return side * value;
    case 'pump':
      if (effect.toughness < 0 && -effect.toughness >= remaining) return side * value;
      return -side * (effect.power + effect.toughness) * 0.5;
    case 'addCounters':
      return -side * effect.amount * 2.5;
    default:
      return 0;
  }
}

function quickTargets(s: GameState, player: PlayerId): Action {
  const pending = s.pending;
  const trigger =
    pending?.kind === 'chooseTargets' ? s.triggers.find((candidate) => candidate.id === pending.trigger) : undefined;
  const effects = trigger ? (triggeredAbility(defOf(s, trigger.source), trigger.ability)?.effects ?? []) : [];
  let best: Action | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const action of getLegalActions(s)) {
    const targets = action.type === 'chooseTargets' ? action.targets : [];
    const score = effects.reduce((sum, effect) => sum + targetImpact(s, player, effect, targets), 0);
    if (score > bestScore) {
      best = action;
      bestScore = score;
    }
  }
  if (!best) throw new Error('no legal action available');
  return best;
}

export function actionValue(s: GameState, action: Action, player: PlayerId, depth = 0): number {
  return evaluate(rollout(applyAction(s, action), depth, s), player);
}

export function bestAction(s: GameState, player: PlayerId, actions: Action[], depth = 0): Action {
  let best: Action | undefined;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const action of actions) {
    const value = actionValue(s, action, player, depth);
    if (value > bestValue) {
      best = action;
      bestValue = value;
    }
  }
  if (!best) throw new Error('bestAction needs at least one action');
  return best;
}

export function settleStack(start: GameState): GameState {
  let s = start;
  for (let i = 0; i < MAX_ROLLOUT_ACTIONS; i++) {
    const pending = s.pending;
    if (pending?.kind !== 'priority' || s.stack.length === 0) return s;
    s = applyAction(s, { type: 'pass', player: pending.player });
  }
  return s;
}

export function repeatedActionValue(s: GameState, action: Action, player: PlayerId, maxRepeats = 5): number {
  let state = s;
  let best = Number.NEGATIVE_INFINITY;
  for (let repeat = 0; repeat < maxRepeats; repeat++) {
    const result = tryApplyAction(state, action);
    if (!result.ok) break;
    state = settleStack(result.state);
    best = Math.max(best, evaluate(rollout(state, 0, s), player));
    const pending = state.pending;
    if (pending?.kind === 'priority' && pending.player !== player && state.stack.length === 0) {
      const passed = tryApplyAction(state, { type: 'pass', player: pending.player });
      if (!passed.ok) break;
      state = passed.state;
    }
  }
  return best;
}
