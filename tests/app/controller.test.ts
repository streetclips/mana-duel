import { afterEach, describe, expect, it, vi } from 'vitest';
import { autoPassReason } from '../../src/app/autopass';
import { GameController } from '../../src/app/controller';
import { createTestApi } from '../../src/app/testApi';
import { applyAction, createScenario, expandDeck, getDeck } from '../../src/engine';

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

describe('decks', () => {
  const deckOf = (c: GameController, player: 0 | 1): string[] =>
    Object.values(c.state.cards)
      .filter((card) => card.owner === player)
      .map((card) => card.def)
      .sort();
  const listOf = (id: string): string[] => expandDeck(getDeck(id)).sort();

  it('plays Emberwild in both seats by default', () => {
    const c = controller();
    expect(c.decks).toEqual(['emberwild', 'emberwild']);
    expect(deckOf(c, 0)).toEqual(listOf('emberwild'));
    expect(deckOf(c, 1)).toEqual(listOf('emberwild'));
  });

  it('gives each seat the deck it was set up with, and keeps them for the next game', () => {
    const c = controller({ decks: ['dawntide', 'duskmire'] });
    expect(deckOf(c, 0)).toEqual(listOf('dawntide'));
    expect(deckOf(c, 1)).toEqual(listOf('duskmire'));
    c.newGame({ seed: 9 });
    expect(c.decks).toEqual(['dawntide', 'duskmire']);
    expect(deckOf(c, 1)).toEqual(listOf('duskmire'));
    c.newGame({ decks: ['duskmire', 'emberwild'] });
    expect(deckOf(c, 0)).toEqual(listOf('duskmire'));
    expect(deckOf(c, 1)).toEqual(listOf('emberwild'));
  });

  it('records the decks in the replay and restores them', () => {
    const c = controller({ autoplay: true, seed: 3, decks: ['duskmire', 'dawntide'] });
    c.settle();
    const replay = c.getReplay();
    expect(replay.decks).toEqual(['duskmire', 'dawntide']);
    const other = controller();
    expect(other.loadReplay(replay)).toMatchObject({ ok: true });
    expect(other.decks).toEqual(['duskmire', 'dawntide']);
    expect(other.state).toEqual(c.state);
  });

  it('has no decks while a scenario is loaded', () => {
    const c = controller({ decks: ['dawntide', 'duskmire'] });
    c.loadScenario({ players: [{}, {}] });
    expect(c.decks).toBeNull();
    c.newGame();
    expect(c.decks).toEqual(['emberwild', 'emberwild']);
  });

  it('refuses an unknown deck', () => {
    expect(() => controller({ decks: ['emberwild', 'nope'] })).toThrow(/Unknown deck/);
  });
});

const AUTO = { endTurnRequested: false, autoPass: true };
const MANUAL = { endTurnRequested: false, autoPass: false };

describe('auto-pass', () => {
  it('passes when there is nothing to do', () => {
    const s = createScenario({ players: [{}, {}] });
    expect(autoPassReason(s, 0, AUTO)).toBe('nothing to do');
    expect(autoPassReason(s, 0, MANUAL)).toBe('nothing to do');
  });

  it('stops for the human’s own main phase when something can be played', () => {
    const s = createScenario({ players: [{ hand: ['forest'] }, {}] });
    expect(autoPassReason(s, 0, AUTO)).toBeNull();
    expect(autoPassReason(s, 0, { ...AUTO, endTurnRequested: true })).toBe('ending the turn');
    expect(autoPassReason(s, 0, { ...MANUAL, endTurnRequested: true })).toBe('ending the turn');
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
    expect(autoPassReason(s, 0, AUTO)).toBeNull();
  });

  it('skips the opponent’s main phase and end step', () => {
    let s = createScenario({ activePlayer: 1, players: [{ hand: ['ember_snap'], battlefield: ['mountain'] }, {}] });
    s = applyAction(s, { type: 'pass', player: 1 });
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    expect(autoPassReason(s, 0, AUTO)).toBe("opponent's main phase");
    expect(autoPassReason(s, 0, MANUAL)).toBeNull();
  });

  it('lets the human’s own spell resolve, unless turned off', () => {
    let s = createScenario({
      players: [{ hand: [{ card: 'ember_snap', id: 'snap' }, 'verdant_surge'], battlefield: ['mountain', 'forest', 'canopy_spider'] }, {}],
    });
    s = applyAction(s, { type: 'cast', player: 0, card: 'snap', targets: [{ player: 1 }] });
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    expect(autoPassReason(s, 0, AUTO)).toBe('let your own spell resolve');
    expect(autoPassReason(s, 0, MANUAL)).toBeNull();
  });

  it('turned off, stops the human wherever they could act, and End turn still ends the turn', () => {
    const c = controller({ autoPass: false });
    c.loadScenario({ activePlayer: 1, players: [{ hand: ['ember_snap'], battlefield: ['mountain'] }, {}] });
    c.settle();
    expect(c.state).toMatchObject({ turn: 3, activePlayer: 1, step: 'main1', pending: { kind: 'priority', player: 0 } });
    c.setAutoPass(true);
    c.settle();
    expect(c.state).toMatchObject({ turn: 4, activePlayer: 0, step: 'main1', pending: { kind: 'priority', player: 0 } });
    c.setAutoPass(false);
    c.endTurn();
    c.settle();
    expect(c.state).toMatchObject({ turn: 5, activePlayer: 1, step: 'main1', pending: { kind: 'priority', player: 0 } });
    c.newGame({ autoPass: true });
    expect(c.autoPass).toBe(true);
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
    expect(api.decks().map((deck) => [deck.id, deck.size])).toEqual([
      ['emberwild', 40],
      ['dawntide', 40],
      ['duskmire', 40],
      ['stormglass', 40],
      ['sunmeadow', 40],
      ['brightforge', 40],
      ['mistgrave', 40],
      ['gloamwood', 40],
    ]);
    expect(api.decks()[2]?.cards).toContainEqual({ id: 'swamp', name: 'Swamp', count: 16 });
    expect(api.matchup()).toEqual(['emberwild', 'emberwild']);
    api.newGame({ decks: ['dawntide', 'duskmire'] });
    expect(api.matchup()).toEqual(['dawntide', 'duskmire']);
    expect(api.replay().decks).toEqual(['dawntide', 'duskmire']);
    api.loadScenario({ players: [{ hand: ['forest'] }, {}] });
    expect(api.matchup()).toBeNull();
    expect(shown).toBe(2);
    expect(api.state().players[0].hand).toHaveLength(1);
    expect(api.playToEnd()?.kind).toBe('gameOver');
    expect(JSON.parse(JSON.stringify(api.state()))).toEqual(api.state());
  });
});

describe('animation cues', () => {
  const lethalSnap = {
    activePlayer: 1 as const,
    players: [{ life: 2 }, { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }] as [
      { life: number },
      { hand: { card: string; id: string }[]; battlefield: string[] },
    ],
  };

  it('records the cues of every action that has any, numbered in order', () => {
    const c = controller({ skipMulligans: true });
    expect(c.fx).toHaveLength(1);
    expect(c.fx[0]?.cues.filter((cue) => cue.kind === 'draw')).toHaveLength(14);
    c.loadScenario({ players: [{ hand: [{ card: 'forest', id: 'f1' }] }, {}] });
    const seq = c.fxSeq;
    c.dispatch({ type: 'playLand', player: 0, card: 'f1' });
    expect(c.fx.at(-1)).toEqual({
      seq: seq + 1,
      cues: [
        { kind: 'enter', player: 0, card: 'f1' },
        { kind: 'play', player: 0, card: 'f1', via: 'land', targets: [] },
      ],
    });
  });

  it('starts a new session for a new game, a scenario or a replay, and keeps only recent batches', () => {
    const c = controller({ autoplay: true, seed: 12 });
    const first = c.session;
    c.settle();
    expect(c.fx.length).toBeLessThanOrEqual(60);
    const replay = c.getReplay();
    c.newGame({ seed: 3 });
    expect(c.session).toBe(first + 1);
    expect(c.fx).toHaveLength(1);
    c.loadReplay(replay);
    expect(c.session).toBe(first + 2);
    expect(c.fx).toEqual([]);
  });

  it('waits for the opponent’s spell to be seen before going on', () => {
    vi.useFakeTimers();
    const c = controller({ aiDelayMs: 650 });
    c.loadScenario(lethalSnap);
    vi.advanceTimersByTime(700);
    expect(c.state.stack).toHaveLength(1);
    vi.advanceTimersByTime(800);
    expect(c.state.pending).toEqual({ kind: 'priority', player: 1 });
    vi.advanceTimersByTime(200);
    expect(c.state.pending).toEqual({ kind: 'priority', player: 0 });
    c.dispose();
  });

  it('goes on at the AI’s own pace with animations off or no AI delay', () => {
    vi.useFakeTimers();
    const off = controller({ aiDelayMs: 650, fxSpeed: 0 });
    off.loadScenario(lethalSnap);
    vi.advanceTimersByTime(1100);
    expect(off.state.pending).toEqual({ kind: 'priority', player: 0 });
    off.dispose();
    const instant = controller({ aiDelayMs: 0 });
    instant.loadScenario(lethalSnap);
    vi.advanceTimersByTime(10);
    expect(instant.state.pending?.kind).toBe('gameOver');
    instant.dispose();
  });

  it('waits longer in slow motion', () => {
    vi.useFakeTimers();
    const c = controller({ aiDelayMs: 650, fxSpeed: 0.5 });
    c.loadScenario(lethalSnap);
    vi.advanceTimersByTime(650 + 1700);
    expect(c.state.pending).toEqual({ kind: 'priority', player: 1 });
    vi.advanceTimersByTime(200);
    expect(c.state.pending).toEqual({ kind: 'priority', player: 0 });
    c.dispose();
  });

  it('sets the animation speed within bounds and tells the view', () => {
    const c = controller();
    const listener = vi.fn();
    c.subscribe(listener);
    c.setFxSpeed(0.25);
    expect(c.fxSpeed).toBe(0.25);
    expect(listener).toHaveBeenCalled();
    c.setFxSpeed(-1);
    expect(c.fxSpeed).toBe(0);
    c.setFxSpeed(Number.NaN);
    expect(c.fxSpeed).toBe(0);
    c.setFxSpeed(100);
    expect(c.fxSpeed).toBe(8);
  });

  it('are exposed to agents through the test API', async () => {
    const c = controller();
    const api = createTestApi(c, () => undefined, { freezeFx: async (progress) => (progress === null ? [] : ['fx-lunge']) });
    expect(api.help()).toContain('freezeFx');
    api.loadScenario({ players: [{ hand: [{ card: 'forest', id: 'f1' }, { card: 'ember_snap', id: 'snap' }] }, {}] });
    const seen = api.fxSeq();
    expect(api.fx(seen)).toEqual([]);
    api.dispatch({ type: 'playLand', player: 0, card: 'f1' });
    expect(api.fx(seen)).toEqual([
      { seq: seen + 1, kind: 'enter', player: 0, card: 'f1' },
      { seq: seen + 1, kind: 'play', player: 0, card: 'f1', via: 'land', targets: [] },
    ]);
    expect(api.fxSeq()).toBe(seen + 1);
    expect(JSON.parse(JSON.stringify(api.fx()))).toEqual(api.fx());
    api.setFxSpeed(0);
    expect(c.fxSpeed).toBe(0);
    expect(await api.freezeFx()).toEqual(['fx-lunge']);
    expect(await api.freezeFx(null)).toEqual([]);
  });
});
