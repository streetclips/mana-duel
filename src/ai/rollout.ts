import {
  applyAction,
  getLegalActions,
  tryApplyAction,
  type Action,
  type GameState,
  type PlayerId,
  type Step,
} from '../engine';
import { evaluate } from './evaluate';

const MAX_ROLLOUT_ACTIONS = 80;
const COMBAT_STEPS: ReadonlySet<Step> = new Set([
  'beginCombat',
  'declareAttackers',
  'declareBlockers',
  'firstStrikeDamage',
  'combatDamage',
  'endCombat',
]);

export function rollout(start: GameState, depth = 0): GameState {
  let s = start;
  const turn = s.turn;
  const step = s.step;
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
      s = applyAction(s, depth >= 1 ? firstAction(s) : bestAction(s, pending.player, getLegalActions(s), depth + 1));
      continue;
    }
    return s;
  }
  return s;
}

function firstAction(s: GameState): Action {
  const action = getLegalActions(s)[0];
  if (!action) throw new Error('no legal action available');
  return action;
}

export function actionValue(s: GameState, action: Action, player: PlayerId, depth = 0): number {
  return evaluate(rollout(applyAction(s, action), depth), player);
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
    best = Math.max(best, evaluate(rollout(state), player));
    const pending = state.pending;
    if (pending?.kind === 'priority' && pending.player !== player && state.stack.length === 0) {
      const passed = tryApplyAction(state, { type: 'pass', player: pending.player });
      if (!passed.ok) break;
      state = passed.state;
    }
  }
  return best;
}
