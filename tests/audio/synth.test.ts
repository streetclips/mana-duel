import { describe, expect, it } from 'vitest';
import { FORM_BARS, MOODS, STEPS_PER_BAR, allThemes, notesAt, stepSeconds } from '../../src/audio/music';
import { SOUNDS, soundEvent, type SoundEvent } from '../../src/audio/sounds';
import {
  MASTER_LEVEL,
  MUSIC_LEVEL,
  SFX_LEVEL,
  SILENT,
  createMix,
  layerSeconds,
  layersSeconds,
  midiHz,
  noteLayers,
  playLayers,
  soundLayers,
  type Layer,
} from '../../src/audio/synth';
import type { Color } from '../../src/engine';
import { FakeAudioContext, FakeGain, FakeNode, FakeParam, FakeSource, asContext, asNode } from './fakeAudio';

const COLORS: (Color | null)[] = [null, 'W', 'U', 'B', 'R', 'G'];

function everySound(): SoundEvent[] {
  return SOUNDS.flatMap((sound) =>
    sound === 'cast' || sound === 'land' ? COLORS.map((color) => soundEvent(sound, { color })) : [soundEvent(sound), soundEvent(sound, { pitch: -5 })],
  );
}

function everyNoteLayers(): Layer[][] {
  return allThemes().flatMap((theme) =>
    MOODS.flatMap((mood) =>
      Array.from({ length: FORM_BARS * STEPS_PER_BAR }, (_, step) => notesAt(theme, mood, step)).flatMap((notes) =>
        notes.map((note) => noteLayers(note, stepSeconds(theme))),
      ),
    ),
  );
}

function numbersOf(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(numbersOf);
  return [];
}

function expectValid(layers: Layer[]): void {
  expect(layers.length).toBeGreaterThan(0);
  for (const layer of layers) {
    expect(numbersOf(layer).every(Number.isFinite)).toBe(true);
    expect(layer.gain).toBeGreaterThan(0);
    expect(layer.gain).toBeLessThanOrEqual(1);
    expect(layer.attack).toBeGreaterThan(0);
    expect(layer.release).toBeGreaterThan(0);
    expect(layer.delay ?? 0).toBeGreaterThanOrEqual(0);
    expect(layer.hold ?? 0).toBeGreaterThanOrEqual(0);
    const frequencies = [layer.filter?.hz, layer.filter?.to, ...(layer.kind === 'tone' ? [layer.hz, layer.to] : [])].filter((hz) => hz !== undefined);
    for (const hz of frequencies) {
      expect(hz).toBeGreaterThanOrEqual(20);
      expect(hz).toBeLessThanOrEqual(16000);
    }
  }
}

describe('sound recipes', () => {
  it('build every sound from audible, finite layers that fade out within five seconds', () => {
    for (const event of everySound()) {
      const layers = soundLayers(event);
      expectValid(layers);
      expect(layersSeconds(layers)).toBeLessThan(event.sound === 'victory' || event.sound === 'defeat' || event.sound === 'stalemate' ? 5 : 2);
    }
  });

  it('build every note of every theme and mood the same way', () => {
    for (const layers of everyNoteLayers()) expectValid(layers);
  });

  it('scale a sound by its gain, and color spells and lands', () => {
    const full = soundLayers(soundEvent('strike'));
    const half = soundLayers(soundEvent('strike', { gain: 0.5 }));
    expect(half.map((layer) => layer.gain)).toEqual(full.map((layer) => layer.gain * 0.5));
    const tones = (color: Color | null): number[] =>
      soundLayers(soundEvent('cast', { color })).flatMap((layer) => (layer.kind === 'tone' ? [layer.hz] : []));
    expect(new Set(COLORS.map((color) => tones(color)[0])).size).toBe(COLORS.length);
    expect(midiHz(69)).toBe(440);
    expect(midiHz(81)).toBeCloseTo(880);
  });

  it('measure a layer from its delay to the end of its release', () => {
    expect(layerSeconds({ kind: 'tone', wave: 'sine', hz: 440, gain: 0.1, attack: 0.1, hold: 0.2, release: 0.3, delay: 0.4 })).toBeCloseTo(1);
    expect(layersSeconds([])).toBe(0);
  });
});

describe('the Web Audio graph', () => {
  it('mixes music and effects into a compressed master, measured before the speakers', () => {
    const ctx = new FakeAudioContext();
    const mix = createMix(asContext(ctx), { master: MASTER_LEVEL, music: MUSIC_LEVEL, sfx: SFX_LEVEL, analyser: true });
    const nodes = (kind: string): FakeNode[] => ctx.nodes.filter((node) => node.kind === kind);
    const [analyser] = nodes('analyser');
    const [compressor] = nodes('compressor');
    const [reverb] = nodes('convolver');
    if (!analyser || !compressor || !reverb) throw new Error('missing node');
    const music = mix.music as unknown as FakeGain;
    const sfx = mix.sfx as unknown as FakeGain;
    expect(analyser.connections).toEqual([ctx.destination]);
    expect(ctx.reaches(music, compressor)).toBe(true);
    expect(ctx.reaches(sfx, compressor)).toBe(true);
    expect(ctx.reaches(music, reverb)).toBe(true);
    expect(ctx.reaches(reverb, analyser)).toBe(true);
    expect(ctx.nodes.filter((node) => node.connections.includes(ctx.destination))).toEqual([analyser]);
    expect([music.gain.value, sfx.gain.value]).toEqual([MUSIC_LEVEL, SFX_LEVEL]);
    expect((reverb as unknown as { buffer: unknown }).buffer).not.toBeNull();
  });

  it('plays every sound through envelopes that start and end silent, and stops every source it starts', () => {
    const ctx = new FakeAudioContext();
    const output = ctx.createGain();
    for (const event of everySound()) {
      const before = ctx.nodes.length;
      const when = 1.5;
      const end = playLayers(asContext(ctx), asNode(output), when, soundLayers(event));
      const created = ctx.nodes.slice(before);
      const sources = created.filter((node): node is FakeSource => node instanceof FakeSource);
      expect(sources.length).toBeGreaterThanOrEqual(soundLayers(event).length);
      for (const source of sources) {
        expect(source.startAt).toBeGreaterThanOrEqual(when);
        expect(source.stopAt).toBeGreaterThan(source.startAt ?? Infinity);
        expect(source.stopAt).toBeLessThanOrEqual(end);
      }
      const audible = sources.filter((source) => ctx.reaches(source, output));
      expect(audible).toHaveLength(soundLayers(event).length);
      for (const modulator of sources.filter((source) => !audible.includes(source))) {
        expect(modulator.connections.every((amount) => amount instanceof FakeGain && amount.connections.every((target) => target instanceof FakeParam))).toBe(true);
      }
      const envelopes = created.filter((node): node is FakeGain => node instanceof FakeGain && node.connections.includes(output));
      expect(envelopes).toHaveLength(soundLayers(event).length);
      for (const envelope of envelopes) {
        expect(envelope.gain.events[0]).toMatchObject({ type: 'set', value: SILENT });
        expect(envelope.gain.events.at(-1)).toMatchObject({ type: 'exponential', value: SILENT });
      }
    }
  });

  it('lets go of every node once its sound has ended', () => {
    const ctx = new FakeAudioContext();
    const output = ctx.createGain();
    playLayers(asContext(ctx), asNode(output), 0, soundLayers(soundEvent('fizzle')));
    playLayers(asContext(ctx), asNode(output), 0, soundLayers(soundEvent('cast', { color: 'U' })));
    const sources = ctx.sources();
    const voices = sources.filter((source) => source.onended !== null);
    for (const voice of voices) voice.end();
    expect(ctx.nodes.filter((node) => node !== output && node !== ctx.destination && !node.disconnected)).toEqual([]);
  });
});
