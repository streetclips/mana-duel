import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { autoPassReason } from '../../src/app/autopass';
import { GameController } from '../../src/app/controller';
import { applyAction } from '../../src/engine';
import { setLocale } from '../../src/i18n';
import { scenario } from '../helpers';

const AUTO = { endTurnRequested: false, autoPass: true };

beforeEach(() => {
  setLocale('en');
});

afterEach(() => {
  setLocale('es');
});

describe('the game controller in English', () => {
  it('seats You against the AI', () => {
    const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0 });
    expect(controller.state.players.map((player) => player.name)).toEqual(['You', 'AI']);
    expect(controller.log[0]?.text).toBe('You go first.');
  });

  it('refuses actions out of turn in English', () => {
    const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0 });
    expect(controller.dispatch({ type: 'keep', player: 1 })).toMatchObject({
      ok: false,
      error: 'you can only act for your own seat',
    });
  });

  it('gives its auto-pass reasons in English', () => {
    expect(autoPassReason(scenario({ players: [{}, {}] }), 0, AUTO)).toBe('nothing to do');
    expect(
      autoPassReason(scenario({ players: [{ hand: ['forest'] }, {}] }), 0, { ...AUTO, endTurnRequested: true }),
    ).toBe('ending the turn');
    let s = scenario({ activePlayer: 1, players: [{ hand: ['ember_snap'], battlefield: ['mountain'] }, {}] });
    s = applyAction(s, { type: 'pass', player: 1 });
    expect(autoPassReason(s, 0, AUTO)).toBe("the opponent's main phase");
  });
});
