import { describe, expect, it } from 'vitest';
import {
  applyAction,
  checkInvariants,
  createGame,
  getLegalActions,
  tryApplyAction,
  type Action,
  type GameState,
} from '../../src/engine';

function lcg(seed: number): () => number {
  let r = seed >>> 0 || 1;
  return () => {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    return r / 4294967296;
  };
}

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)] as T;
}

function randomPlayout(seed: number, onState?: (s: GameState) => void): { final: GameState; actions: Action[] } {
  let s = createGame({ seed });
  const rand = lcg(seed);
  const actions: Action[] = [];
  while (s.pending && s.pending.kind !== 'gameOver') {
    if (actions.length > 20_000) throw new Error(`seed ${seed}: game did not end`);
    onState?.(s);
    const legal = getLegalActions(s, { limit: 128 });
    if (legal.length === 0) throw new Error(`seed ${seed}: no legal actions for ${s.pending.kind}`);
    const active = legal.filter((action) => action.type !== 'pass');
    const action = active.length > 0 && rand() < 0.7 ? pick(active, rand) : pick(legal, rand);
    s = applyAction(s, action);
    actions.push(action);
    const problems = checkInvariants(s);
    if (problems.length > 0) throw new Error(`seed ${seed}, action ${actions.length}: ${problems.join('; ')}`);
  }
  return { final: s, actions };
}

describe('engine properties', () => {
  it('accepts every action it lists as legal', () => {
    for (const seed of [101, 202, 303]) {
      randomPlayout(seed, (s) => {
        for (const action of getLegalActions(s, { limit: 32 })) {
          const result = tryApplyAction(s, action);
          if (!result.ok) throw new Error(`seed ${seed}: legal action rejected (${result.error}): ${JSON.stringify(action)}`);
        }
      });
    }
  });

  it('always reaches the end of the game with a consistent state', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { final } = randomPlayout(seed);
      expect(final.pending?.kind).toBe('gameOver');
      for (const player of [0, 1] as const) {
        const owned = Object.values(final.cards).filter((card) => card.owner === player);
        expect(owned).toHaveLength(40);
      }
    }
  });

  it('reproduces a game exactly from its seed and action list', () => {
    const { final, actions } = randomPlayout(777);
    let replay = createGame({ seed: 777 });
    for (const action of actions) replay = applyAction(replay, action);
    expect(replay).toEqual(final);
  });

  it('never mutates the state it is given', () => {
    const s = createGame({ seed: 9 });
    const snapshot = structuredClone(s);
    applyAction(s, { type: 'mulligan', player: s.startingPlayer });
    tryApplyAction(s, { type: 'pass', player: 0 });
    expect(s).toEqual(snapshot);
  });

  it('rejects malformed input with an explanation instead of crashing', () => {
    const s = createGame({ seed: 9, skipMulligans: true, startingPlayer: 0 });
    const bad: unknown[] = [
      {},
      { type: 'nope', player: 0 },
      { type: 'pass', player: 3 },
      { type: 'pass', player: 1 },
      { type: 'cast', player: 0, card: 'missing', targets: [] },
      { type: 'playLand', player: 0, card: s.players[1].hand[0] },
      { type: 'declareAttackers', player: 0, attackers: [] },
      { type: 'discard', player: 0, cards: 'all' },
    ];
    for (const action of bad) {
      const result = tryApplyAction(s, action as Action);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
    }
  });
});
