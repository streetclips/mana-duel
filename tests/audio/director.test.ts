import { describe, expect, it } from 'vitest';
import { GameController, type ControllerOptions } from '../../src/app/controller';
import { ENDING_AT, MAX_BATCHES } from '../../src/audio/cues';
import { SoundDirector, type AudioSink, type Scene } from '../../src/audio/director';
import type { Mood, Theme } from '../../src/audio/music';
import type { SoundEvent } from '../../src/audio/sounds';
import type { ScenarioSpec } from '../../src/engine';
import { IMPACT_MS } from '../../src/ui/fx';

class RecordingSink implements AudioSink {
  themes: [string, boolean][] = [];
  moods: Mood[] = [];
  events: SoundEvent[] = [];

  setTheme(theme: Theme, restart = false): void {
    this.themes.push([theme.id, restart]);
  }

  setMood(mood: Mood): void {
    this.moods.push(mood);
  }

  play(events: readonly SoundEvent[]): void {
    this.events.push(...events);
  }

  sounds(): string[] {
    return this.events.map((event) => event.sound);
  }

  clear(): void {
    this.events = [];
  }
}

function setup(scene: Scene, options: ControllerOptions = {}) {
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0, ...options });
  const sink = new RecordingSink();
  const tasks: (() => void)[] = [];
  const director = new SoundDirector(controller, sink, scene, (task) => tasks.push(task));
  const flush = (): void => {
    for (const task of tasks.splice(0)) task();
  };
  return { controller, sink, director, flush };
}

const COMBAT: ScenarioSpec = {
  activePlayer: 1,
  players: [
    { hand: ['forest'], battlefield: [{ card: 'grove_tender', id: 'elf' }] },
    { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
  ],
};

describe('the sound director', () => {
  it('plays the sounds of each action once, after it happens', () => {
    const { controller, sink, flush } = setup('game');
    controller.loadScenario({
      players: [
        { hand: [{ card: 'forest', id: 'f1' }, { card: 'ember_snap', id: 'snap' }, 'ember_snap'], battlefield: ['mountain', 'mountain'] },
        {},
      ],
    });
    flush();
    sink.clear();
    controller.dispatch({ type: 'playLand', player: 0, card: 'f1' });
    expect(sink.events).toEqual([]);
    flush();
    expect(sink.events).toMatchObject([{ sound: 'land', color: 'G', seq: controller.fxSeq }]);
    flush();
    controller.dispatch({ type: 'cast', player: 0, card: 'snap', targets: [{ player: 1 }] });
    controller.settle();
    flush();
    expect(sink.sounds()).toEqual(['land', 'cast', 'drain']);
    expect(sink.moods.at(-1)).toBe('calm');
  });

  it('catches up on a burst of actions with the latest ones only', () => {
    const { controller, sink, flush } = setup('game', { autoplay: true, seed: 12 });
    flush();
    sink.clear();
    controller.settle();
    flush();
    const latest = new Set([...controller.fx.slice(-MAX_BATCHES).map((batch) => batch.seq), controller.fxSeq]);
    expect(sink.events.length).toBeGreaterThan(0);
    expect(sink.events.every((event) => latest.has(event.seq))).toBe(true);
    expect(['victory', 'stalemate']).toContain(sink.sounds().at(-1));
  });

  it('starts the theme of your deck over for every new game, and plays the colorless one for a scenario', () => {
    const { controller, sink } = setup('game', { decks: ['duskmire', 'dawntide'] });
    expect(sink.themes).toEqual([['duskmire', true]]);
    controller.newGame({ seed: 3 });
    expect(sink.themes.at(-1)).toEqual(['duskmire', true]);
    controller.newGame({ decks: ['stormglass', 'emberwild'] });
    expect(sink.themes.at(-1)).toEqual(['stormglass', true]);
    controller.loadScenario({ players: [{}, {}] });
    expect(sink.themes.at(-1)).toEqual(['neutral', true]);
  });

  it('plays the title theme on the start screen and keeps the game quiet until it shows, then deals its cards', () => {
    const { controller, director, sink, flush } = setup('title', { decks: ['gloamwood', 'emberwild'] });
    flush();
    expect(sink.themes).toEqual([['title', false]]);
    controller.newGame({ seed: 8 });
    flush();
    expect(sink.events).toEqual([]);
    expect(sink.themes).toEqual([['title', false]]);
    director.setScene('game');
    flush();
    expect(sink.themes.at(-1)).toEqual(['gloamwood', true]);
    expect(sink.sounds()).toEqual(Array.from({ length: 8 }, () => 'draw'));
    expect(sink.events.filter((event) => event.gain < 1)).toHaveLength(1);
    director.setScene('title');
    expect(sink.themes.at(-1)).toEqual(['title', false]);
    expect(sink.moods.at(-1)).toBe('calm');
  });

  it('follows the mood of the game: combat while creatures attack, danger at low life', () => {
    const { controller, sink, flush } = setup('game');
    controller.loadScenario(COMBAT);
    controller.settle();
    flush();
    expect(controller.state.pending).toEqual({ kind: 'declareBlockers', player: 0 });
    expect(sink.moods.at(-1)).toBe('combat');
    controller.dispatch({ type: 'declareBlockers', player: 0, blocks: [] });
    controller.settle();
    flush();
    expect(controller.state.players[0].life).toBe(16);
    expect(sink.moods.at(-1)).toBe('calm');
    controller.loadScenario({ players: [{ life: 4 }, {}] });
    flush();
    expect(sink.moods.at(-1)).toBe('danger');
  });

  it('sounds a victory when you win and a defeat when you concede, once, but nothing for a finished replay', () => {
    const { controller, sink, flush } = setup('game');
    controller.loadScenario({ players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, { life: 2 }] });
    flush();
    sink.clear();
    controller.dispatch({ type: 'cast', player: 0, card: 'snap', targets: [{ player: 1 }] });
    controller.settle();
    flush();
    expect(sink.sounds()).toEqual(['cast', 'drain', 'victory']);
    expect(sink.events.at(-1)).toMatchObject({ sound: 'victory', at: ENDING_AT, seq: controller.fxSeq });
    expect(sink.moods.at(-1)).toBe('over');
    controller.newGame();
    flush();
    expect(sink.sounds().filter((sound) => sound === 'victory')).toHaveLength(1);
    sink.clear();
    controller.concede();
    flush();
    expect(sink.sounds()).toEqual(['defeat']);

    const finished = new GameController({ seed: 12, aiDelayMs: 0, autoplay: true });
    finished.settle();
    sink.clear();
    controller.loadReplay(finished.getReplay());
    flush();
    expect(controller.state.pending?.kind).toBe('gameOver');
    expect(sink.events).toEqual([]);
  });

  it('stretches its timing with slow motion, like the animations', () => {
    const { controller, sink, flush } = setup('game', { fxSpeed: 0.25 });
    controller.loadScenario(COMBAT);
    controller.settle();
    controller.dispatch({ type: 'declareBlockers', player: 0, blocks: [{ blocker: 'elf', attacker: 'rhino' }] });
    controller.settle();
    flush();
    expect(sink.events.find((event) => event.sound === 'strike')?.at).toBeCloseTo((4 * IMPACT_MS) / 1000);
    expect(sink.sounds()).toContain('dies');
  });

  it('stops listening once disposed', () => {
    const { controller, director, sink, flush } = setup('game');
    controller.loadScenario({ players: [{ hand: [{ card: 'forest', id: 'f1' }] }, {}] });
    flush();
    sink.clear();
    director.dispose();
    controller.dispatch({ type: 'playLand', player: 0, card: 'f1' });
    flush();
    expect(sink.events).toEqual([]);
  });
});
