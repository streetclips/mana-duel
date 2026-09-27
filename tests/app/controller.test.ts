import { afterEach, describe, expect, it, vi } from 'vitest';
import { autoPassReason } from '../../src/app/autopass';
import { GameController } from '../../src/app/controller';
import { createTestApi } from '../../src/app/testApi';
import { applyAction, createScenario } from '../../src/engine';

function controller(options: ConstructorParameters<typeof GameController>[0] = {}): GameController {
  return new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0, ...options });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('GameController', () => {
  it('lets the human keep and plays the AI decisions automatically', () => {
    const c = controller();
    expect(c.state.pending).toEqual({ kind: 'mulligan', player: 0 });
    expect(c.isHumanTurnToDecide()).toBe(true);
    expect(c.dispatch({ type: 'keep', player: 0 })).toMatchObject({ ok: true });
    c.settle();
    expect(c.state.turn).toBe(1);
    expect(c.state.pending).toEqual({ kind: 'priority', player: 0 });
    expect(c.log.map((entry) => entry.text)).toEqual(['You go first.', 'You keep 7 cards.', 'AI keeps 7 cards.', 'Turn 1 — your turn.']);
  });

  it('refuses actions for the AI seat or out of turn', () => {
    const c = controller();
    expect(c.dispatch({ type: 'keep', player: 1 })).toEqual({ ok: false, error: 'you can only act for your own seat' });
    c.dispatch({ type: 'keep', player: 0 });
    expect(c.state.pending).toEqual({ kind: 'mulligan', player: 1 });
    expect(c.dispatch({ type: 'pass', player: 0 })).toEqual({ ok: false, error: 'it is not your decision' });
    expect(c.legalActions()).toEqual([]);
  });

  it('runs the AI on timers, with a delay the player can follow', () => {
    vi.useFakeTimers();
    const c = controller({ aiDelayMs: 500 });
    c.start();
    c.dispatch({ type: 'keep', player: 0 });
    expect(c.busy).toBe(true);
    expect(c.state.pending).toEqual({ kind: 'mulligan', player: 1 });
    vi.advanceTimersByTime(100);
    expect(c.state.pending).toEqual({ kind: 'mulligan', player: 1 });
    vi.advanceTimersByTime(1000);
    expect(c.state.pending?.kind).not.toBe('mulligan');
    c.dispose();
  });

  it('notifies subscribers on every change', () => {
    const c = controller();
    const listener = vi.fn();
    const unsubscribe = c.subscribe(listener);
    c.dispatch({ type: 'keep', player: 0 });
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    c.settle();
    expect(listener).not.toHaveBeenCalled();
  });

  it('ends the turn on request, skipping the attack', () => {
    const c = controller();
    c.loadScenario({ players: [{ battlefield: ['ember_hound', 'mountain'], hand: ['forest'] }, {}] });
    expect(c.state.pending).toEqual({ kind: 'priority', player: 0 });
    expect(c.endTurn()).toMatchObject({ ok: true });
    c.settle();
    expect(c.state.activePlayer).toBe(0);
    expect(c.state.turn).toBe(5);
    expect(c.log.some((entry) => entry.text.startsWith('You attack'))).toBe(false);
  });

  it('keeps playing until the human has a real choice', () => {
    const c = controller();
    c.loadScenario({ activePlayer: 1, players: [{ hand: ['forest'] }, {}] });
    c.settle();
    expect(c.state.activePlayer).toBe(0);
    expect(c.state.step).toBe('main1');
    expect(c.state.pending).toEqual({ kind: 'priority', player: 0 });
  });

  it('exports a replay that reproduces the game', () => {
    const c = controller({ autoplay: true, seed: 12 });
    c.settle();
    expect(c.state.pending?.kind).toBe('gameOver');
    const replay = c.getReplay();
    const other = controller();
    expect(other.loadReplay(replay)).toMatchObject({ ok: true });
    expect(other.state).toEqual(c.state);
  });

  it('can concede at any moment', () => {
    const c = controller();
    c.concede();
    expect(c.state.pending).toEqual({ kind: 'gameOver', winner: 1, reason: 'concede' });
  });
});

describe('auto-pass', () => {
  it('passes when there is nothing to do', () => {
    const s = createScenario({ players: [{}, {}] });
    expect(autoPassReason(s, 0, { endTurnRequested: false })).toBe('nothing to do');
  });

  it('stops for the human’s own main phase when something can be played', () => {
    const s = createScenario({ players: [{ hand: ['forest'] }, {}] });
    expect(autoPassReason(s, 0, { endTurnRequested: false })).toBeNull();
    expect(autoPassReason(s, 0, { endTurnRequested: true })).toBe('ending the turn');
  });

  it('stops to let the human respond to an opponent’s spell', () => {
    let s = createScenario({
      activePlayer: 1,
      players: [
        { hand: ['verdant_surge'], battlefield: ['forest', { card: 'canopy_spider', id: 'spider' }] },
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
      ],
    });
    s = applyAction(s, { type: 'cast', player: 1, card: 'snap', targets: [{ card: 'spider' }] });
    s = applyAction(s, { type: 'pass', player: 1 });
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    expect(autoPassReason(s, 0, { endTurnRequested: false })).toBeNull();
  });

  it('skips the opponent’s main phase and end step', () => {
    let s = createScenario({ activePlayer: 1, players: [{ hand: ['ember_snap'], battlefield: ['mountain'] }, {}] });
    s = applyAction(s, { type: 'pass', player: 1 });
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    expect(autoPassReason(s, 0, { endTurnRequested: false })).toBe("opponent's main phase");
  });
});

describe('test API', () => {
  it('exposes JSON-friendly helpers for agents', () => {
    const c = controller();
    let shown = 0;
    const api = createTestApi(c, () => {
      shown += 1;
    });
    expect(api.help()).toContain('window.manaDuel');
    expect(api.pending()).toEqual({ kind: 'mulligan', player: 0 });
    expect(api.legalActions().map((action) => action.type)).toEqual(['keep', 'mulligan']);
    expect(api.dispatch({ type: 'keep', player: 0 })).toEqual({ ok: true, pending: { kind: 'mulligan', player: 1 } });
    expect(api.settle()).toEqual({ kind: 'priority', player: 0 });
    expect(api.describe()).toContain('Turn 1');
    expect(api.cards().map((card) => card.id)).toContain('crag_dragon');
    api.loadScenario({ players: [{ hand: ['forest'] }, {}] });
    expect(shown).toBe(1);
    expect(api.state().players[0].hand).toHaveLength(1);
    expect(api.playToEnd()?.kind).toBe('gameOver');
    expect(JSON.parse(JSON.stringify(api.state()))).toEqual(api.state());
  });
});
