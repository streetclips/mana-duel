import { describe, expect, it } from 'vitest';
import { getLegalActions, tryApplyAction } from '../../src/engine';
import { act, attack, cast, pass, passUntil, resolveStack, scenario } from '../helpers';

describe('winning and losing', () => {
  it('ends the game when a player reaches 0 life', () => {
    let s = scenario({
      players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, { life: 2 }],
    });
    s = resolveStack(cast(s, 'snap', [{ player: 1 }]));
    expect(s.pending).toEqual({ kind: 'gameOver', winner: 0, reason: 'life' });
    expect(s.events.at(-1)).toEqual({ t: 'gameOver', winner: 0, reason: 'life' });
    expect(getLegalActions(s)).toEqual([]);
    expect(tryApplyAction(s, { type: 'pass', player: 0 })).toEqual({
      ok: false,
      error: 'la partida ha terminado',
      refusal: { code: 'gameOver' },
    });
  });

  it('ends the game through combat damage', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] }, { life: 4 }] });
    s = passUntil(attack(s, ['rhino']), (state) => state.pending?.kind === 'gameOver');
    expect(s.pending).toMatchObject({ kind: 'gameOver', winner: 0 });
  });

  it('makes a player who draws from an empty library lose', () => {
    let s = scenario({ activePlayer: 1, players: [{ library: [] }, {}] });
    s = passUntil(s, (state) => state.pending?.kind === 'gameOver');
    expect(s.pending).toEqual({ kind: 'gameOver', winner: 1, reason: 'decked' });
    expect(s.turn).toBe(4);
  });

  it('lets a player concede at any time', () => {
    const s = scenario({ players: [{}, {}] });
    const conceded = act(s, { type: 'concede', player: 1 });
    expect(conceded.pending).toEqual({ kind: 'gameOver', winner: 0, reason: 'concede' });
  });

  it('declares a draw when the turn limit is exceeded', () => {
    let s = scenario({ turn: 3, turnLimit: 4, players: [{}, {}] });
    s = passUntil(s, (state) => state.pending?.kind === 'gameOver');
    expect(s.pending).toEqual({ kind: 'gameOver', winner: null, reason: 'turnLimit' });
  });

  it('stops accepting decisions after the game ends', () => {
    let s = scenario({ players: [{}, {}] });
    s = act(s, { type: 'concede', player: 0 });
    expect(tryApplyAction(s, { type: 'concede', player: 1 })).toMatchObject({ ok: false });
    expect(() => pass(s)).toThrow();
  });
});
