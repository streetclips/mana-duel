import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine, FADE_SECONDS, LOOKAHEAD_SECONDS, SFX_LATENCY, START_DELAY, TICK_MS, type AudioEngineOptions } from '../../src/audio/engine';
import { deckTheme } from '../../src/audio/music';
import { soundEvent } from '../../src/audio/sounds';
import { MUSIC_LEVEL } from '../../src/audio/synth';
import { getDeck } from '../../src/engine';
import { FakeGain, FakeOscillator, fakeContext } from './fakeAudio';

afterEach(() => {
  vi.useRealTimers();
});

function setup(options: AudioEngineOptions = {}) {
  vi.useFakeTimers();
  const { ctx, create } = fakeContext();
  const engine = new AudioEngine({ createContext: create, mayStart: () => true, ...options });
  const play = (seconds: number): void => {
    for (let i = 0; i < Math.round((seconds * 1000) / TICK_MS); i++) {
      ctx.advance(TICK_MS / 1000);
      vi.advanceTimersByTime(TICK_MS);
    }
  };
  const starts = (from = 0): number[] =>
    ctx
      .sources()
      .slice(from)
      .map((source) => source.startAt ?? Number.NaN);
  return { ctx, engine, play, starts };
}

async function unlocked(options: AudioEngineOptions = {}) {
  const ready = setup(options);
  await ready.engine.unlock();
  return ready;
}

const EMBERWILD = deckTheme(getDeck('emberwild'));

describe('the audio engine', () => {
  it('creates no audio context until the player taps, then starts it once', async () => {
    const { ctx, engine } = setup();
    const listener = vi.fn();
    engine.subscribe(listener);
    expect(engine.state()).toMatchObject({ supported: true, context: 'none', music: { on: true, playing: false, theme: 'title' } });
    expect(ctx.nodes).toEqual([ctx.destination]);
    await engine.unlock();
    expect(engine.state()).toMatchObject({ context: 'running', music: { playing: true } });
    expect(listener).toHaveBeenCalled();
    await engine.unlock();
    expect(ctx.resumes).toBe(1);
  });

  it('waits until the page has been tapped, and never starts while it is hidden', async () => {
    let tapped = false;
    const { engine } = setup({ mayStart: () => tapped });
    await engine.unlock();
    expect(engine.state().context).toBe('none');
    tapped = true;
    engine.setHidden(true);
    await engine.unlock();
    expect(engine.state().context).toBe('none');
    engine.setHidden(false);
    await engine.unlock();
    expect(engine.state().context).toBe('running');
  });

  it('stays silent and safe where Web Audio is missing or fails to start', async () => {
    const missing = new AudioEngine({ createContext: null });
    await missing.unlock();
    missing.play([soundEvent('strike')]);
    expect(missing.state()).toMatchObject({ supported: false, context: 'none' });
    expect(missing.level()).toEqual({ rms: 0, peak: 0 });
    expect(missing.played()).toEqual([]);
    const broken = new AudioEngine({
      createContext: () => {
        throw new Error('no audio device');
      },
      mayStart: () => true,
    });
    await broken.unlock();
    expect(broken.state()).toMatchObject({ supported: false, context: 'none' });
  });

  it('schedules the music a little ahead of the audio clock, one step at a time', async () => {
    const { ctx, engine, play, starts } = await unlocked();
    expect(Math.min(...starts())).toBeCloseTo(START_DELAY);
    expect(Math.max(...starts())).toBeLessThan(LOOKAHEAD_SECONDS);
    play(3.5);
    expect(Math.max(...starts())).toBeLessThan(ctx.currentTime + LOOKAHEAD_SECONDS);
    expect(engine.state().music).toMatchObject({ theme: 'title', bar: 1 });
    expect(engine.state().music.notes).toBeGreaterThan(10);
  });

  it('starts over for a new theme, fading out what was playing', async () => {
    const { ctx, engine, play, starts } = await unlocked();
    play(1);
    const now = ctx.currentTime;
    engine.setTheme(EMBERWILD);
    expect(engine.state().music).toMatchObject({ theme: 'emberwild', tempo: 108, bar: 0 });
    const fading = ctx.nodes.filter(
      (node): node is FakeGain =>
        node instanceof FakeGain && node.gain.events.some((event) => event.type === 'linear' && event.value === 0 && Math.abs(event.time - (now + FADE_SECONDS)) < 1e-9),
    );
    expect(fading).toHaveLength(1);
    const before = ctx.sources().length;
    play(0.6);
    expect(Math.min(...starts(before))).toBeCloseTo(now + FADE_SECONDS * 0.6);
    expect(fading[0]?.disconnected).toBe(true);
    play(2);
    engine.setTheme(EMBERWILD);
    expect(engine.state().music.bar).toBeGreaterThan(0);
    engine.setTheme(EMBERWILD, true);
    expect(engine.state().music.bar).toBe(0);
  });

  it('changes its mood on the beat, and brings in the drums for combat', async () => {
    const { ctx, engine, play } = await unlocked();
    const kicks = (): number => ctx.sources().filter((source) => source instanceof FakeOscillator && source.frequency.events[0]?.value === 150).length;
    engine.setTheme(EMBERWILD);
    play(2);
    expect(kicks()).toBe(0);
    engine.setMood('combat');
    expect(engine.state().music).toMatchObject({ mood: 'combat', heard: 'calm' });
    play(1);
    expect(engine.state().music.heard).toBe('combat');
    expect(kicks()).toBeGreaterThan(0);
  });

  it('turns the music off and on again', async () => {
    const { ctx, engine, play } = await unlocked();
    play(1);
    const bus = ctx.nodes.find(
      (node): node is FakeGain => node instanceof FakeGain && node.gain.events.some((event) => event.type === 'linear' && event.value === MUSIC_LEVEL),
    );
    engine.setMusic(false);
    expect(engine.state().music).toMatchObject({ on: false, playing: false });
    expect(bus?.gain.events.at(-1)).toMatchObject({ type: 'linear', value: 0 });
    const count = ctx.sources().length;
    play(2);
    expect(ctx.sources()).toHaveLength(count);
    engine.setMusic(true);
    play(1);
    expect(ctx.sources().length).toBeGreaterThan(count);
    expect(bus?.gain.events.at(-1)).toMatchObject({ type: 'linear', value: MUSIC_LEVEL });
  });

  it('plays sound events at their offsets on the audio clock, and lists the sounds it played', async () => {
    const { ctx, engine, starts } = await unlocked({ music: false });
    ctx.currentTime = 2;
    engine.play([soundEvent('strike', { seq: 3, at: 0.18 }), soundEvent('drain', { seq: 3, at: 0.18 }), soundEvent('turn', { seq: 4, pitch: -5 })]);
    expect(Math.min(...starts())).toBeCloseTo(2 + SFX_LATENCY);
    expect(engine.played()).toEqual([
      { seq: 3, sound: 'strike', at: 2.19, gain: 1, pitch: 0, color: null },
      { seq: 3, sound: 'drain', at: 2.19, gain: 1, pitch: 0, color: null },
      { seq: 4, sound: 'turn', at: 2.01, gain: 1, pitch: -5, color: null },
    ]);
    expect(engine.played(3).map((sound) => sound.sound)).toEqual(['turn']);
    expect(engine.state().sfx).toEqual({ on: true, played: 3, dropped: 0 });
  });

  it('drops a sound repeated at the same moment, but never a jingle', async () => {
    const { engine } = await unlocked({ music: false });
    engine.play([soundEvent('strike'), soundEvent('strike'), soundEvent('victory'), soundEvent('victory')]);
    expect(engine.played().map((sound) => sound.sound)).toEqual(['strike', 'victory', 'victory']);
    expect(engine.state().sfx.dropped).toBe(1);
  });

  it('plays no effect before a tap, while effects are off or while the page is hidden', async () => {
    const { engine } = setup();
    engine.play([soundEvent('strike')]);
    await engine.unlock();
    engine.setSfx(false);
    engine.play([soundEvent('dies')]);
    engine.setSfx(true);
    engine.setHidden(true);
    engine.play([soundEvent('heal')]);
    expect(engine.played()).toEqual([]);
  });

  it('suspends while the page is hidden and picks up the music where it was', async () => {
    const { ctx, engine, play } = await unlocked();
    play(1);
    engine.setHidden(true);
    expect(engine.state()).toMatchObject({ hidden: true, context: 'suspended', music: { playing: false } });
    const count = ctx.sources().length;
    const bar = engine.state().music.bar;
    play(5);
    expect(ctx.sources()).toHaveLength(count);
    engine.setHidden(false);
    await Promise.resolve();
    expect(ctx.state).toBe('running');
    play(1);
    expect(ctx.sources().length).toBeGreaterThan(count);
    expect(engine.state().music.bar).toBe(bar);
  });

  it('suspends once music and effects are both off, and wakes up with either', async () => {
    const { ctx, engine } = await unlocked();
    engine.setMusic(false);
    engine.setSfx(false);
    vi.advanceTimersByTime(FADE_SECONDS * 1000 + 100);
    expect(ctx.state).toBe('suspended');
    engine.setSfx(true);
    await Promise.resolve();
    expect(ctx.state).toBe('running');
  });

  it('skips ahead after a stall instead of playing every missed note at once', async () => {
    const { ctx, play, starts } = await unlocked();
    play(0.5);
    const count = ctx.sources().length;
    ctx.currentTime += 5;
    vi.advanceTimersByTime(TICK_MS);
    const fresh = starts(count);
    expect(fresh.length).toBeGreaterThan(0);
    expect(Math.min(...fresh)).toBeGreaterThanOrEqual(ctx.currentTime);
    expect(Math.max(...fresh)).toBeLessThan(ctx.currentTime + LOOKAHEAD_SECONDS);
  });

  it('measures the level of what it plays, and keeps the volume within bounds', async () => {
    const { ctx, engine } = setup();
    expect(engine.level()).toEqual({ rms: 0, peak: 0 });
    await engine.unlock();
    ctx.output = 0.25;
    expect(engine.level()).toEqual({ rms: 0.25, peak: 0.25 });
    engine.setVolume(2);
    expect(engine.state().volume).toBe(1);
    engine.setVolume(-1);
    expect(engine.state().volume).toBe(0);
    engine.setVolume(Number.NaN);
    expect(engine.state().volume).toBe(1);
  });

  it('closes its context when disposed', async () => {
    const { ctx, engine } = await unlocked();
    engine.dispose();
    expect(ctx.state).toBe('closed');
    expect(engine.state().context).toBe('none');
  });
});
