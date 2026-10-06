import { describe, expect, it } from 'vitest';
import type { FxBatch, FxCue } from '../../src/app/fx';
import { createScenario } from '../../src/engine';
import { DRAW_STAGGER_MS, FxTracker, IMPACT_MS, fxView, withGhosts, type GhostFx } from '../../src/ui/fx';

const batch = (seq: number, ...cues: FxCue[]): FxBatch => ({ seq, cues });

const combat = batch(
  3,
  { kind: 'strike', card: 'rhino', target: { card: 'elf' } },
  { kind: 'damage', card: 'elf', amount: 4 },
  { kind: 'strike', card: 'elf', target: { card: 'rhino' } },
  { kind: 'damage', card: 'rhino', amount: 1 },
  { kind: 'dies', player: 1, card: 'elf', next: null },
);

describe('FxTracker', () => {
  it('turns each new batch into entries once, timing the hits after the strikes land', () => {
    const tracker = new FxTracker();
    const entries = tracker.update(1, [combat], 1000, 1);
    expect(entries.map((entry) => [entry.cue.kind, entry.delay, entry.born])).toEqual([
      ['strike', 0, 1000],
      ['damage', IMPACT_MS, 1000],
      ['strike', 0, 1000],
      ['damage', IMPACT_MS, 1000],
      ['dies', IMPACT_MS, 1000],
    ]);
    expect(tracker.update(1, [combat], 1100, 1)).toHaveLength(5);
    expect(tracker.lastSeq).toBe(3);
  });

  it('staggers the cards each player draws in one batch', () => {
    const tracker = new FxTracker();
    const deal = batch(
      1,
      { kind: 'draw', player: 0, card: 'a' },
      { kind: 'draw', player: 0, card: 'b' },
      { kind: 'draw', player: 1, card: 'c' },
      { kind: 'draw', player: 0, card: 'd' },
    );
    const entries = tracker.update(1, [deal], 0, 1);
    expect(entries.map((entry) => entry.order)).toEqual([0, 1, 0, 2]);
    expect((entries[3]?.life ?? 0) - (entries[0]?.life ?? 0)).toBe(2 * DRAW_STAGGER_MS);
  });

  it('keeps the latest batch until a newer one arrives, and older ones until their animation ends', () => {
    const tracker = new FxTracker();
    tracker.update(1, [combat], 0, 1);
    expect(tracker.update(1, [combat], 60_000, 1)).toHaveLength(5);
    const later = [combat, batch(9, { kind: 'turn', player: 0, turn: 4 })];
    expect(tracker.update(1, later, 60_000, 1).map((entry) => entry.cue.kind)).toEqual(['turn']);
  });

  it('lets an older batch finish playing while a newer one starts', () => {
    const tracker = new FxTracker();
    tracker.update(1, [combat], 0, 1);
    const later = [combat, batch(9, { kind: 'turn', player: 0, turn: 4 })];
    expect(tracker.update(1, later, 100, 1)).toHaveLength(6);
    expect(tracker.nextExpiry(1)).toBeGreaterThan(100);
  });

  it('stretches lifetimes in slow motion', () => {
    const enter = batch(1, { kind: 'enter', player: 0, card: 'a' });
    const turn = batch(2, { kind: 'turn', player: 0, turn: 2 });
    const kindsAt = (speed: number, now: number): string[] => {
      const tracker = new FxTracker();
      tracker.update(1, [enter], 0, speed);
      return tracker.update(1, [enter, turn], now, speed).map((entry) => entry.cue.kind);
    };
    expect(kindsAt(1, 1500)).toEqual(['turn']);
    expect(kindsAt(0.25, 1500)).toEqual(['enter', 'turn']);
  });

  it('shows nothing while animations are off, and does not replay them when they come back', () => {
    const tracker = new FxTracker();
    expect(tracker.update(1, [combat], 0, 0)).toEqual([]);
    expect(tracker.update(1, [combat], 10, 1)).toEqual([]);
    expect(tracker.lastSeq).toBe(3);
  });

  it('starts over when a new game or scenario begins', () => {
    const tracker = new FxTracker();
    tracker.update(1, [combat], 0, 1);
    expect(tracker.update(2, [], 10, 1)).toEqual([]);
    expect(tracker.update(2, [batch(4, { kind: 'turn', player: 0, turn: 1 })], 20, 1)).toHaveLength(1);
  });

  it('only catches up with the last batches after many actions at once', () => {
    const tracker = new FxTracker();
    const many = Array.from({ length: 40 }, (_, index) =>
      batch(index + 1, { kind: 'turn', player: 0, turn: index + 1 }),
    );
    const entries = tracker.update(1, many, 0, 1);
    expect(entries.length).toBeLessThanOrEqual(12);
    expect(entries.at(-1)?.seq).toBe(40);
  });
});

describe('fxView', () => {
  const s = createScenario({
    players: [
      { hand: [{ card: 'forest', id: 'drawn' }], battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
      {
        hand: [{ card: 'forest', id: 'theirs' }],
        graveyard: [
          { card: 'grove_tender', id: 'elf' },
          { card: 'ember_snap', id: 'snap' },
        ],
      },
    ],
  });
  const viewOf = (cues: FxCue[], spectating = false) => {
    const tracker = new FxTracker();
    return fxView(tracker.update(1, [batch(5, ...cues)], 0, 1), s, 0, spectating, tracker.lastSeq);
  };

  it('gives each card and player the kinds of animation it plays', () => {
    const view = viewOf(combat.cues);
    expect(view.seq).toBe(5);
    expect(view.cards.get('rhino')).toMatchObject({
      kinds: ['strike', 'damage'],
      float: { text: '−1', tone: 'minus', delay: IMPACT_MS },
    });
    expect(view.cards.get('elf')?.kinds).toEqual(['damage', 'strike', 'dies']);
    expect(view.ghosts.get(1)).toEqual([
      { key: '5.4', card: 'elf', def: 'grove_tender', kind: 'dies', next: null, delay: IMPACT_MS },
    ]);
  });

  it('reveals the opponent’s plays with their targets, but not yours', () => {
    const theirs = viewOf([{ kind: 'play', player: 1, card: 'snap', via: 'cast', targets: [{ card: 'rhino' }] }]);
    expect(theirs.reveal).toMatchObject({
      kind: 'play',
      card: 'snap',
      def: 'ember_snap',
      player: 1,
      via: 'cast',
      targets: [{ card: 'rhino' }],
    });
    expect(theirs.stack.get('snap')).toBe('play');
    const mine = viewOf([{ kind: 'play', player: 0, card: 'snap', via: 'cast', targets: [] }]);
    expect(mine.reveal).toBeNull();
    expect(viewOf([{ kind: 'play', player: 0, card: 'snap', via: 'cast', targets: [] }], true).reveal).not.toBeNull();
  });

  it('slides your drawn cards into your hand and counts the opponent’s', () => {
    const view = viewOf([
      { kind: 'draw', player: 0, card: 'drawn' },
      { kind: 'draw', player: 1, card: 'theirs' },
      { kind: 'draw', player: 1, card: 'c99' },
    ]);
    expect(view.cards.get('drawn')).toMatchObject({ kinds: ['draw'], order: 0 });
    expect(view.cards.has('theirs')).toBe(false);
    expect(view.players.get(1)?.drawn?.count).toBe(2);
  });

  it('marks your life loss with a red edge and the opponent’s only on its life total', () => {
    const hurt = viewOf([{ kind: 'life', player: 0, delta: -3 }]);
    expect(hurt.players.get(0)?.life).toMatchObject({ text: '−3', tone: 'minus' });
    expect(hurt.hurt).not.toBeNull();
    const healed = viewOf([{ kind: 'life', player: 0, delta: 2 }]);
    expect(healed.players.get(0)?.life).toMatchObject({ text: '+2', tone: 'plus' });
    expect(healed.hurt).toBeNull();
    expect(viewOf([{ kind: 'life', player: 1, delta: -2 }]).hurt).toBeNull();
  });

  it('announces the new turn and a countered spell', () => {
    expect(viewOf([{ kind: 'turn', player: 1, turn: 6 }]).turn).toMatchObject({ player: 1, turn: 6 });
    expect(viewOf([{ kind: 'counter', player: 1, card: 'snap' }]).reveal).toMatchObject({
      kind: 'counter',
      card: 'snap',
    });
  });

  it('shows no ghost for a creature that is back on the battlefield', () => {
    expect(viewOf([{ kind: 'bounce', player: 0, card: 'rhino', next: null }]).ghosts.size).toBe(0);
  });
});

describe('withGhosts', () => {
  const ghost = (card: string, next: string | null): GhostFx => ({
    key: card,
    card,
    def: 'grove_tender',
    kind: 'dies',
    next,
    delay: 0,
  });
  const order = (ids: string[], ghosts: GhostFx[]): string[] =>
    withGhosts(ids, ghosts).map((item) => ('id' in item ? item.id : `†${item.ghost.card}`));

  it('puts each ghost back where the creature was', () => {
    expect(order(['a', 'b'], [ghost('x', 'b')])).toEqual(['a', '†x', 'b']);
    expect(order(['a', 'b'], [ghost('x', 'b'), ghost('y', 'b')])).toEqual(['a', '†x', '†y', 'b']);
    expect(order(['a'], [ghost('x', null), ghost('y', 'gone')])).toEqual(['a', '†x', '†y']);
  });

  it('never shows a ghost next to the living card', () => {
    expect(order(['a', 'x'], [ghost('x', null)])).toEqual(['a', 'x']);
  });
});
