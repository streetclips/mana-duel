import { describe, expect, it } from 'vitest';
import type { FxBatch, FxCue, FxKind } from '../../src/app/fx';
import {
  DIES_AFTER,
  ENTER_AFTER,
  MAX_BATCHES,
  MAX_SOUNDS,
  REPEAT_GAP,
  TURN_LEAD,
  endingSound,
  soundsFor,
  soundsOf,
  type SoundContext,
} from '../../src/audio/cues';
import { SoundGate } from '../../src/audio/gate';
import type { SoundEvent } from '../../src/audio/sounds';
import { DRAW_STAGGER_MS, IMPACT_MS } from '../../src/ui/fx';
import { scenario } from '../helpers';

const s = scenario({
  players: [
    {
      hand: [{ card: 'ember_snap', id: 'snap' }, { card: 'forest', id: 'forest' }, { card: 'turn_the_tide', id: 'tide' }],
      battlefield: [{ card: 'grove_tender', id: 'elf' }, 'island'],
    },
    { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }, { card: 'soldier_token', id: 'soldier' }] },
  ],
});

const context: SoundContext = { state: s, viewer: 0, time: 1 };
const IMPACT = IMPACT_MS / 1000;
const DRAW_GAP = DRAW_STAGGER_MS / 1000;

const batch = (seq: number, ...cues: FxCue[]): FxBatch => ({ seq, cues });
const sounds = (events: SoundEvent[]): [string, number][] => events.map((event) => [event.sound, Math.round(event.at * 1000) / 1000]);
const round = (seconds: number): number => Math.round(seconds * 1000) / 1000;

const ONE_OF_EACH: Record<FxKind, FxCue> = {
  draw: { kind: 'draw', player: 0, card: 'snap' },
  discard: { kind: 'discard', player: 0, card: 'snap' },
  play: { kind: 'play', player: 1, card: 'snap', via: 'cast', targets: [] },
  ability: { kind: 'ability', player: 0, card: 'elf' },
  enter: { kind: 'enter', player: 0, card: 'elf' },
  attack: { kind: 'attack', player: 1, card: 'rhino' },
  block: { kind: 'block', player: 0, card: 'elf', attacker: 'rhino' },
  strike: { kind: 'strike', card: 'rhino', target: { card: 'elf' } },
  damage: { kind: 'damage', card: 'elf', amount: 2 },
  life: { kind: 'life', player: 1, delta: -2 },
  pump: { kind: 'pump', card: 'elf', power: 1, toughness: 1 },
  dies: { kind: 'dies', player: 0, card: 'elf', next: null },
  bounce: { kind: 'bounce', player: 1, card: 'rhino', next: null },
  counter: { kind: 'counter', player: 1, card: 'snap' },
  fizzle: { kind: 'fizzle', player: 0, card: 'snap' },
  turn: { kind: 'turn', player: 0, turn: 3 },
};

describe('sounds of the animation cues', () => {
  it('give every kind of cue a sound', () => {
    const heard = Object.entries(ONE_OF_EACH).map(([kind, cue]) => [kind, soundsOf(batch(1, cue), context).map((event) => event.sound)]);
    expect(Object.fromEntries(heard)).toEqual({
      draw: ['draw'],
      discard: ['discard'],
      play: ['cast'],
      ability: ['ability'],
      enter: ['enter'],
      attack: ['attack'],
      block: ['block'],
      strike: ['strike'],
      damage: ['damage'],
      life: ['drain'],
      pump: ['pump'],
      dies: ['dies'],
      bounce: ['bounce'],
      counter: ['counter'],
      fizzle: ['fizzle'],
      turn: ['turn'],
    });
    expect(soundsOf(batch(7, ONE_OF_EACH.turn), context)[0]).toEqual({ sound: 'turn', seq: 7, at: 0, gain: 1, pitch: 0, color: null });
  });

  it('land the hits of a combat with its strikes, and the dead fall just after', () => {
    const combat = batch(
      4,
      { kind: 'strike', card: 'rhino', target: { card: 'elf' } },
      { kind: 'damage', card: 'elf', amount: 4 },
      { kind: 'strike', card: 'elf', target: { card: 'rhino' } },
      { kind: 'damage', card: 'rhino', amount: 1 },
      { kind: 'dies', player: 0, card: 'elf', next: null },
      { kind: 'life', player: 0, delta: -3 },
    );
    expect(sounds(soundsOf(combat, context))).toEqual([
      ['strike', round(IMPACT)],
      ['strike', round(IMPACT + REPEAT_GAP)],
      ['dies', round(IMPACT + DIES_AFTER)],
      ['hurt', round(IMPACT)],
    ]);
    expect(soundsOf(combat, context).map((event) => event.pitch)).toEqual([0, -2, 0, 0]);
  });

  it('tell the life you lose from the life the opponent loses, and heal either', () => {
    const life = (player: 0 | 1, delta: number): string[] => soundsOf(batch(1, { kind: 'life', player, delta }), context).map((event) => event.sound);
    expect(life(0, -2)).toEqual(['hurt']);
    expect(life(1, -2)).toEqual(['drain']);
    expect(life(0, 3)).toEqual(['heal']);
    expect(life(1, 1)).toEqual(['heal']);
    expect(soundsOf(batch(1, { kind: 'life', player: 1, delta: -2 }), { ...context, viewer: 1 })[0]?.sound).toBe('hurt');
  });

  it('deal the cards you draw one after another, and the opponent’s with one quiet sound', () => {
    const deal = batch(
      1,
      ...Array.from({ length: 7 }, (_, i): FxCue => ({ kind: 'draw', player: 0, card: `a${i}` })),
      ...Array.from({ length: 7 }, (_, i): FxCue => ({ kind: 'draw', player: 1, card: `b${i}` })),
    );
    const events = soundsOf(deal, context);
    expect(events.map((event) => round(event.at))).toEqual([...Array.from({ length: 7 }, (_, i) => round(i * DRAW_GAP)), 0]);
    expect(events.map((event) => event.gain)).toEqual([1, 1, 1, 1, 1, 1, 1, 0.5]);
    expect(new Set(events.map((event) => event.sound))).toEqual(new Set(['draw']));
  });

  it('ring a new turn, then deal its card; the opponent’s turn rings lower', () => {
    const yours = soundsOf(batch(2, { kind: 'turn', player: 0, turn: 3 }, { kind: 'draw', player: 0, card: 'snap' }), context);
    expect(sounds(yours)).toEqual([
      ['turn', 0],
      ['draw', TURN_LEAD],
    ]);
    expect(soundsOf(batch(2, { kind: 'turn', player: 1, turn: 4 }), context)[0]?.pitch).toBe(-5);
  });

  it('play lands and spells in the color of their card', () => {
    const play = (card: string, via: 'land' | 'cast'): SoundEvent | undefined =>
      soundsOf(batch(1, { kind: 'play', player: 0, card, via, targets: [] }), context)[0];
    expect(play('forest', 'land')).toMatchObject({ sound: 'land', color: 'G' });
    expect(play('snap', 'cast')).toMatchObject({ sound: 'cast', color: 'R' });
    expect(play('tide', 'cast')).toMatchObject({ sound: 'cast', color: 'U' });
    expect(play('soldier', 'cast')).toMatchObject({ sound: 'cast', color: 'W' });
  });

  it('stay quiet where another sound covers the cue: a land entering, the damage of a strike', () => {
    const land = batch(1, { kind: 'enter', player: 0, card: 'forest' }, { kind: 'play', player: 0, card: 'forest', via: 'land', targets: [] });
    expect(sounds(soundsOf(land, context))).toEqual([['land', 0]]);
    expect(sounds(soundsOf(batch(1, ONE_OF_EACH.enter), context))).toEqual([['enter', ENTER_AFTER]]);
    expect(soundsOf(batch(1, ONE_OF_EACH.strike, ONE_OF_EACH.damage), context).map((event) => event.sound)).toEqual(['strike']);
  });

  it('repeat a sound at most a few times in one action, and attack louder with more attackers', () => {
    const strikes = batch(1, ...Array.from({ length: 6 }, (): FxCue => ONE_OF_EACH.strike));
    expect(soundsOf(strikes, context)).toHaveLength(3);
    const attack = (count: number): number =>
      soundsOf(batch(1, ...Array.from({ length: count }, (): FxCue => ONE_OF_EACH.attack)), context)[0]?.gain ?? 0;
    expect(attack(1)).toBeCloseTo(0.8);
    expect(attack(3)).toBe(1);
  });

  it('catch up on the latest actions only', () => {
    const batches = Array.from({ length: 10 }, (_, i) => batch(i + 1, ONE_OF_EACH.turn, ONE_OF_EACH.discard));
    const events = soundsFor(batches, context);
    expect(new Set(events.map((event) => event.seq))).toEqual(new Set([7, 8, 9, 10]));
    expect(MAX_BATCHES).toBe(4);
    const crowded = Array.from({ length: 4 }, (_, i) => batch(i + 1, ...Array.from({ length: 9 }, (__, j): FxCue => ({ kind: 'draw', player: 0, card: `c${j}` }))));
    expect(soundsFor(crowded, context)).toHaveLength(MAX_SOUNDS);
  });

  it('stretch with slow motion and keep their spacing with animations off', () => {
    const strike = batch(1, ONE_OF_EACH.strike);
    expect(soundsOf(strike, { ...context, time: 4 })[0]?.at).toBeCloseTo(4 * IMPACT);
    expect(soundsOf(strike, { ...context, time: 1 })[0]?.at).toBeCloseTo(IMPACT);
  });
});

describe('the end of a game', () => {
  it('sounds a victory, a defeat or a stalemate for the player who watches it', () => {
    expect(endingSound({ kind: 'gameOver', winner: 0, reason: 'life' }, 0, false)).toBe('victory');
    expect(endingSound({ kind: 'gameOver', winner: 1, reason: 'concede' }, 0, false)).toBe('defeat');
    expect(endingSound({ kind: 'gameOver', winner: null, reason: 'turnLimit' }, 0, false)).toBe('stalemate');
    expect(endingSound({ kind: 'gameOver', winner: 1, reason: 'life' }, 0, true)).toBe('victory');
    expect(endingSound({ kind: 'priority', player: 0 }, 0, false)).toBeNull();
    expect(endingSound(null, 0, false)).toBeNull();
  });
});

describe('the sound gate', () => {
  it('lets the same sound through once per gap', () => {
    const gate = new SoundGate(0.05, 0.25, 10);
    expect(gate.allow('strike', 1)).toBe(true);
    expect(gate.allow('strike', 1.02)).toBe(false);
    expect(gate.allow('dies', 1.02)).toBe(true);
    expect(gate.allow('strike', 1.06)).toBe(true);
    gate.reset();
    expect(gate.allow('strike', 1.07)).toBe(true);
  });

  it('lets only so many sounds start together', () => {
    const gate = new SoundGate(0.05, 0.25, 3);
    expect((['draw', 'land', 'cast', 'turn'] as const).map((sound, i) => gate.allow(sound, 2 + i * 0.01))).toEqual([true, true, true, false]);
    expect(gate.allow('turn', 2.5)).toBe(true);
  });
});
