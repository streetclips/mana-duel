import type { Color } from '../engine';
import type { Note, Timbre } from './music';
import type { SoundEvent, SoundId } from './sounds';

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface FilterSpec {
  type: BiquadFilterType;
  hz: number;
  to?: number;
  q?: number;
}

interface Envelope {
  delay?: number;
  attack: number;
  hold?: number;
  release: number;
  gain: number;
}

export interface ToneLayer extends Envelope {
  kind: 'tone';
  wave: Wave;
  hz: number;
  to?: number;
  glide?: number;
  detune?: number;
  vibrato?: { hz: number; cents: number };
  filter?: FilterSpec;
}

export interface NoiseLayer extends Envelope {
  kind: 'noise';
  filter: FilterSpec;
  tremolo?: { hz: number; depth: number };
}

export type Layer = ToneLayer | NoiseLayer;

export const SILENT = 0.0001;
export const MASTER_LEVEL = 0.8;
export const MUSIC_LEVEL = 0.4;
export const SFX_LEVEL = 1;
export const REVERB_SECONDS = 1.8;
const STOP_PAD = 0.02;
const NOISE_SECONDS = 1;

const COLOR_NOTES: Record<Color, number> = { W: 76, U: 74, B: 57, R: 67, G: 72 };
const COLORLESS_NOTE = 69;

function ratio(semitones: number): number {
  return 2 ** (semitones / 12);
}

export function midiHz(midi: number): number {
  return 440 * ratio(midi - 69);
}

function colorHz(color: Color | null): number {
  return midiHz(color ? COLOR_NOTES[color] : COLORLESS_NOTE);
}

function tone(
  wave: Wave,
  hz: number,
  gain: number,
  attack: number,
  release: number,
  extra: Partial<Omit<ToneLayer, 'kind'>> = {},
): ToneLayer {
  return { kind: 'tone', wave, hz, gain, attack, release, ...extra };
}

function noise(
  filter: FilterSpec,
  gain: number,
  attack: number,
  release: number,
  extra: Partial<Omit<NoiseLayer, 'kind'>> = {},
): NoiseLayer {
  return { kind: 'noise', filter, gain, attack, release, ...extra };
}

function bell(hz: number, gain: number, release: number, delay = 0): Layer[] {
  return [
    tone('sine', hz, gain, 0.004, release, { delay }),
    tone('sine', hz * 2, gain * 0.4, 0.004, release * 0.6, { delay }),
    tone('sine', hz * 2.76, gain * 0.3, 0.004, release * 0.45, { delay }),
    tone('sine', hz * 5.4, gain * 0.12, 0.004, release * 0.25, { delay }),
  ];
}

function arpeggio(hz: number, semitones: readonly number[], gain: number, gap: number, release: number): Layer[] {
  return semitones.flatMap((semitone, index) => [
    tone('triangle', hz * ratio(semitone), gain, 0.006, release, { delay: index * gap }),
    tone('sine', hz * ratio(semitone) * 2, gain * 0.35, 0.006, release * 0.6, { delay: index * gap }),
  ]);
}

function flourish(color: Color | null, hz: number): Layer[] {
  switch (color) {
    case 'W':
      return [
        tone('sine', hz * 2, 0.035, 0.01, 0.7, { delay: 0.12 }),
        tone('sine', hz * 3, 0.02, 0.01, 0.5, { delay: 0.16 }),
      ];
    case 'U':
      return [
        tone('sine', hz, 0.07, 0.04, 0.45, { delay: 0.05, to: hz * 2, glide: 0.3, vibrato: { hz: 5.5, cents: 25 } }),
      ];
    case 'B':
      return [
        tone('sawtooth', hz / 2, 0.06, 0.15, 0.5, { filter: { type: 'lowpass', hz: 300, to: 900, q: 1.2 } }),
        tone('sine', (hz / 2) * ratio(1), 0.04, 0.1, 0.5),
      ];
    case 'R':
      return [
        noise({ type: 'highpass', hz: 2500, to: 6000, q: 0.8 }, 0.12, 0.003, 0.18),
        tone('sawtooth', hz / 2, 0.05, 0.005, 0.22, { to: hz, filter: { type: 'lowpass', hz: 1500, q: 1 } }),
      ];
    case 'G':
      return [
        tone('triangle', hz / 2, 0.14, 0.003, 0.26),
        noise({ type: 'bandpass', hz: 420, q: 2 }, 0.07, 0.002, 0.05),
      ];
    default:
      return [tone('sine', hz * 2, 0.04, 0.01, 0.5, { delay: 0.1 })];
  }
}

function fanfare(
  notes: readonly number[],
  gap: number,
  wave: Wave,
  last: { hold: number; release: number },
  filter?: FilterSpec,
): Layer[] {
  return notes.flatMap((hz, index) => {
    const final = index === notes.length - 1;
    const release = final ? last.release : 0.38;
    return [
      tone(wave, hz, 0.12, 0.008, release, {
        delay: index * gap,
        hold: final ? last.hold : 0,
        ...(filter ? { filter } : {}),
      }),
      tone('sine', hz * 2, 0.03, 0.008, release * 0.6, { delay: index * gap }),
    ];
  });
}

function chord(
  notes: readonly number[],
  delay: number,
  filter: FilterSpec,
  gain: number,
  attack: number,
  hold: number,
  release: number,
): Layer[] {
  return notes.map((hz) => tone('sawtooth', hz, gain, attack, release, { delay, hold, filter }));
}

type Recipe = (event: SoundEvent) => Layer[];

const ATTACK_FILTER: FilterSpec = { type: 'lowpass', hz: 400, to: 1600, q: 2 };

const RECIPES: Record<SoundId, Recipe> = {
  draw: ({ pitch }) => [
    noise({ type: 'bandpass', hz: 1700 * ratio(pitch), to: 3600 * ratio(pitch), q: 1.1 }, 0.45, 0.004, 0.09),
  ],
  discard: () => [
    noise({ type: 'bandpass', hz: 1400, to: 500, q: 0.9 }, 0.3, 0.005, 0.16),
    tone('triangle', 260, 0.18, 0.003, 0.09, { to: 150 }),
  ],
  land: ({ color }) => [
    tone('sine', 120, 0.55, 0.004, 0.22, { to: 52 }),
    tone('triangle', 240, 0.12, 0.004, 0.14, { to: 104 }),
    noise({ type: 'lowpass', hz: 900, to: 300 }, 0.22, 0.002, 0.07),
    tone('sine', colorHz(color), 0.07, 0.01, 0.5, { delay: 0.03 }),
  ],
  cast: ({ color }) => {
    const hz = colorHz(color);
    return [...arpeggio(hz, [0, 7, 12], 0.11, 0.045, 0.35), ...flourish(color, hz)];
  },
  ability: () => [tone('sine', 1318.5, 0.11, 0.003, 0.12), tone('sine', 1760, 0.1, 0.003, 0.16, { delay: 0.05 })],
  enter: ({ pitch }) => [
    tone('sine', 95 * ratio(pitch), 0.4, 0.006, 0.24, { to: 58 }),
    tone('triangle', 190 * ratio(pitch), 0.12, 0.004, 0.16, { to: 120 }),
    noise({ type: 'lowpass', hz: 500 }, 0.12, 0.004, 0.08),
  ],
  attack: () => [
    tone('sawtooth', 146.83, 0.12, 0.035, 0.3, { hold: 0.08, detune: -8, filter: ATTACK_FILTER }),
    tone('sawtooth', 220, 0.09, 0.035, 0.3, { hold: 0.08, detune: 8, filter: ATTACK_FILTER }),
    noise({ type: 'bandpass', hz: 900, to: 2400, q: 1 }, 0.05, 0.02, 0.2),
  ],
  block: () => [
    tone('sine', 560, 0.16, 0.002, 0.35),
    tone('sine', 1327, 0.08, 0.002, 0.22),
    tone('sine', 2168, 0.05, 0.002, 0.15),
    noise({ type: 'highpass', hz: 3000 }, 0.14, 0.001, 0.03),
  ],
  strike: ({ pitch }) => [
    noise({ type: 'lowpass', hz: 3000 * ratio(pitch), to: 250, q: 0.7 }, 0.45, 0.002, 0.14),
    tone('sine', 160 * ratio(pitch), 0.6, 0.003, 0.18, { to: 45 }),
    tone('square', 90 * ratio(pitch), 0.08, 0.002, 0.1, { to: 50, filter: { type: 'lowpass', hz: 600 } }),
  ],
  damage: () => [
    tone('sawtooth', 900, 0.2, 0.004, 0.18, { to: 110, filter: { type: 'bandpass', hz: 1200, q: 1.5 } }),
    tone('triangle', 300, 0.15, 0.003, 0.12, { to: 120 }),
    noise({ type: 'highpass', hz: 4000 }, 0.18, 0.002, 0.08),
  ],
  hurt: () => [
    tone('sine', 82, 0.75, 0.004, 0.36, { to: 38 }),
    tone('triangle', 164, 0.14, 0.004, 0.3, { to: 76 }),
    noise({ type: 'lowpass', hz: 700, to: 150 }, 0.3, 0.003, 0.22),
    noise({ type: 'bandpass', hz: 900, to: 300, q: 0.8 }, 0.16, 0.003, 0.25),
    tone('triangle', 116.54, 0.06, 0.02, 0.5),
    tone('triangle', 123.47, 0.06, 0.02, 0.5),
  ],
  drain: () => [
    tone('sine', 210, 0.38, 0.003, 0.17, { to: 92 }),
    noise({ type: 'lowpass', hz: 1800, to: 400 }, 0.15, 0.002, 0.08),
  ],
  heal: () => [
    ...[1046.5, 1318.5, 1568].map((hz, index) => tone('sine', hz, 0.07, 0.008, 0.55, { delay: index * 0.06 })),
    noise({ type: 'highpass', hz: 6000 }, 0.02, 0.05, 0.3),
  ],
  pump: () => [
    tone('sawtooth', 220, 0.08, 0.02, 0.2, {
      hold: 0.1,
      to: 440,
      glide: 0.3,
      filter: { type: 'lowpass', hz: 400, to: 3200, q: 4 },
    }),
    tone('sine', 440, 0.06, 0.02, 0.3, { to: 880 }),
  ],
  shrink: () => [
    tone('sawtooth', 440, 0.08, 0.01, 0.24, {
      hold: 0.08,
      to: 165,
      glide: 0.32,
      filter: { type: 'lowpass', hz: 2600, to: 300, q: 3 },
    }),
    tone('sine', 660, 0.05, 0.01, 0.3, { to: 220 }),
  ],
  dies: ({ pitch }) => [
    tone('triangle', 330 * ratio(pitch), 0.16, 0.01, 0.62, { to: 98, filter: { type: 'lowpass', hz: 1800, to: 200 } }),
    noise({ type: 'bandpass', hz: 1200, to: 300, q: 1 }, 0.1, 0.02, 0.5),
  ],
  bounce: () => [
    noise({ type: 'bandpass', hz: 400, to: 4200, q: 1.2 }, 0.3, 0.04, 0.22),
    tone('sine', 300, 0.09, 0.03, 0.2, { to: 900 }),
  ],
  counter: () => [
    tone('square', 659.25, 0.06, 0.003, 0.11, { filter: { type: 'lowpass', hz: 2000 } }),
    tone('square', 440, 0.06, 0.003, 0.16, { delay: 0.09, filter: { type: 'lowpass', hz: 2000 } }),
    noise({ type: 'highpass', hz: 3500, to: 1500 }, 0.12, 0.002, 0.22, { delay: 0.05 }),
    tone('sine', 1975.5, 0.03, 0.002, 0.3, { delay: 0.05 }),
    tone('sine', 2793.8, 0.025, 0.002, 0.25, { delay: 0.07 }),
  ],
  fizzle: () => [
    noise({ type: 'bandpass', hz: 1600, to: 500, q: 2 }, 0.32, 0.01, 0.45, { tremolo: { hz: 22, depth: 0.5 } }),
    tone('sine', 400, 0.06, 0.01, 0.4, { to: 120 }),
  ],
  turn: ({ pitch }) => bell(523.25 * ratio(pitch), 0.12, 1.3),
  victory: () => [
    ...fanfare([523.25, 659.25, 783.99, 1046.5], 0.12, 'triangle', { hold: 0.35, release: 1.1 }),
    ...chord([261.63, 329.63, 392], 0.36, { type: 'lowpass', hz: 1400, q: 0.7 }, 0.03, 0.3, 0.6, 1),
  ],
  defeat: () => [
    ...fanfare(
      [392, 311.13, 293.66, 261.63],
      0.22,
      'triangle',
      { hold: 0.4, release: 1.2 },
      { type: 'lowpass', hz: 1200 },
    ),
    ...chord([130.81, 155.56, 196], 0.66, { type: 'lowpass', hz: 700, q: 0.7 }, 0.035, 0.4, 0.8, 1.2),
  ],
  stalemate: () => [
    ...[261.63, 349.23, 392].map((hz) => tone('sine', hz, 0.05, 0.2, 1, { hold: 0.6 })),
    ...bell(523.25, 0.08, 1.2),
  ],
};

function scaled(layers: Layer[], gain: number): Layer[] {
  return gain === 1 ? layers : layers.map((layer) => ({ ...layer, gain: layer.gain * gain }));
}

export function soundLayers(event: SoundEvent): Layer[] {
  return scaled(RECIPES[event.sound](event), event.gain);
}

function leadLayers(timbre: Timbre, hz: number, velocity: number, bright: number, length: number): Layer[] {
  switch (timbre) {
    case 'bell':
      return [
        tone('sine', hz, 0.12 * velocity, 0.004, 0.9),
        tone('sine', hz * 2.01, 0.035 * velocity, 0.004, 0.5),
        tone('sine', hz * 3, 0.015 * velocity, 0.004, 0.25),
      ];
    case 'glass':
      return [
        tone('sine', hz, 0.11 * velocity, 0.01, 0.7, { vibrato: { hz: 5.2, cents: 9 } }),
        tone('triangle', hz * 2, 0.02 * velocity, 0.01, 0.4),
      ];
    case 'reed':
      return [
        tone('square', hz, 0.05 * velocity, 0.03, 0.25, {
          hold: length * 0.5,
          filter: { type: 'lowpass', hz: 900 + 900 * bright, q: 1 },
        }),
      ];
    case 'pulse':
      return [
        tone('sawtooth', hz, 0.06 * velocity, 0.004, 0.22, {
          filter: { type: 'lowpass', hz: 1200 + 1800 * bright, to: 500, q: 3 },
        }),
      ];
    case 'pluck':
      return [
        tone('triangle', hz, 0.14 * velocity, 0.002, 0.32, { filter: { type: 'lowpass', hz: 3000, to: 700 } }),
        noise({ type: 'bandpass', hz: Math.min(hz * 2, 8000), q: 3 }, 0.02 * velocity, 0.001, 0.02),
      ];
  }
}

export function noteLayers(note: Note, stepSeconds: number): Layer[] {
  const hz = midiHz(note.midi);
  const length = note.steps * stepSeconds;
  const velocity = note.velocity;
  switch (note.voice) {
    case 'pad': {
      const filter: FilterSpec = { type: 'lowpass', hz: 500 + 1800 * note.bright, q: 0.6 };
      const attack = Math.min(0.6, length / 2);
      return [-7, 7].map((detune) =>
        tone('sawtooth', hz, 0.045 * velocity, attack, 0.9, { hold: length - attack, detune, filter }),
      );
    }
    case 'bass':
      return [
        tone('triangle', hz, 0.3 * velocity, 0.008, 0.18, {
          hold: length * 0.6,
          filter: { type: 'lowpass', hz: 300 + 900 * note.bright, q: 0.7 },
        }),
      ];
    case 'lead':
      return leadLayers(note.timbre ?? 'bell', hz, velocity, note.bright, length);
    case 'kick':
      return [
        tone('sine', 150, 0.55 * velocity, 0.002, 0.28, { to: 44, glide: 0.12 }),
        tone('triangle', 300, 0.1 * velocity, 0.001, 0.05, { to: 100 }),
        noise({ type: 'lowpass', hz: 2000 }, 0.06 * velocity, 0.001, 0.015),
      ];
    case 'snare':
      return [
        noise({ type: 'highpass', hz: 1400 }, 0.18 * velocity, 0.001, 0.13),
        tone('triangle', 190, 0.1 * velocity, 0.001, 0.08, { to: 160 }),
      ];
    case 'hat':
      return [noise({ type: 'highpass', hz: 7500 }, 0.07 * velocity, 0.001, 0.035)];
  }
}

export function layerSeconds(layer: Layer): number {
  return (layer.delay ?? 0) + layer.attack + (layer.hold ?? 0) + layer.release;
}

export function layersSeconds(layers: readonly Layer[]): number {
  return layers.reduce((longest, layer) => Math.max(longest, layerSeconds(layer)), 0);
}

function random(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
const impulseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseBuffers.get(ctx);
  if (cached) return cached;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const next = random(7);
  for (let i = 0; i < data.length; i++) data[i] = next() * 2 - 1;
  noiseBuffers.set(ctx, buffer);
  return buffer;
}

function impulseResponse(ctx: BaseAudioContext): AudioBuffer {
  const cached = impulseBuffers.get(ctx);
  if (cached) return cached;
  const length = Math.floor(ctx.sampleRate * REVERB_SECONDS);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    const next = random(11 + channel);
    for (let i = 0; i < length; i++) data[i] = (next() * 2 - 1) * (1 - i / length) ** 3;
  }
  impulseBuffers.set(ctx, buffer);
  return buffer;
}

export interface Mix {
  ctx: BaseAudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  analyser: AnalyserNode | null;
}

export interface MixLevels {
  master: number;
  music: number;
  sfx: number;
  analyser?: boolean;
}

function gainNode(ctx: BaseAudioContext, value: number): GainNode {
  const node = ctx.createGain();
  node.gain.value = value;
  return node;
}

export function createMix(ctx: BaseAudioContext, levels: MixLevels): Mix {
  const master = gainNode(ctx, levels.master);
  const music = gainNode(ctx, levels.music);
  const sfx = gainNode(ctx, levels.sfx);
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.25;
  const reverb = ctx.createConvolver();
  reverb.buffer = impulseResponse(ctx);
  const wet = gainNode(ctx, 0.3);
  const musicSend = gainNode(ctx, 0.55);
  const sfxSend = gainNode(ctx, 0.2);
  music.connect(master);
  music.connect(musicSend);
  musicSend.connect(reverb);
  sfx.connect(master);
  sfx.connect(sfxSend);
  sfxSend.connect(reverb);
  reverb.connect(wet);
  wet.connect(master);
  master.connect(compressor);
  let analyser: AnalyserNode | null = null;
  if (levels.analyser) {
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    compressor.connect(analyser);
    analyser.connect(ctx.destination);
  } else {
    compressor.connect(ctx.destination);
  }
  return { ctx, master, music, sfx, analyser };
}

function biquad(ctx: BaseAudioContext, spec: FilterSpec, start: number, end: number): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = spec.type;
  filter.frequency.setValueAtTime(spec.hz, start);
  if (spec.to !== undefined) filter.frequency.exponentialRampToValueAtTime(spec.to, end);
  filter.Q.setValueAtTime(spec.q ?? 0.7, start);
  return filter;
}

function oscillator(ctx: BaseAudioContext, layer: ToneLayer, start: number, end: number): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = layer.wave;
  osc.frequency.setValueAtTime(layer.hz, start);
  if (layer.to !== undefined)
    osc.frequency.exponentialRampToValueAtTime(
      layer.to,
      start + Math.max(0.001, Math.min(layer.glide ?? end - start, end - start)),
    );
  if (layer.detune) osc.detune.setValueAtTime(layer.detune, start);
  return osc;
}

function lfo(
  ctx: BaseAudioContext,
  hz: number,
  depth: number,
  start: number,
  target: AudioParam,
): { source: OscillatorNode; amount: GainNode } {
  const source = ctx.createOscillator();
  source.frequency.setValueAtTime(hz, start);
  const amount = ctx.createGain();
  amount.gain.setValueAtTime(depth, start);
  source.connect(amount);
  amount.connect(target);
  return { source, amount };
}

function playLayer(ctx: BaseAudioContext, output: AudioNode, when: number, layer: Layer): number {
  const start = when + (layer.delay ?? 0);
  const peakAt = start + layer.attack;
  const holdUntil = peakAt + (layer.hold ?? 0);
  const end = holdUntil + layer.release;
  const stop = end + STOP_PAD;
  const peak = Math.max(layer.gain, SILENT * 2);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(SILENT, start);
  amp.gain.exponentialRampToValueAtTime(peak, peakAt);
  if (holdUntil > peakAt) amp.gain.setValueAtTime(peak, holdUntil);
  amp.gain.exponentialRampToValueAtTime(SILENT, end);
  amp.connect(output);
  const chain: AudioNode[] = [amp];
  const modulators: OscillatorNode[] = [];
  let input: AudioNode = amp;
  if (layer.filter) {
    const filter = biquad(ctx, layer.filter, start, end);
    filter.connect(input);
    input = filter;
    chain.push(filter);
  }
  if (layer.kind === 'noise' && layer.tremolo) {
    const tremolo = ctx.createGain();
    tremolo.gain.setValueAtTime(1 - layer.tremolo.depth, start);
    const wobble = lfo(ctx, layer.tremolo.hz, layer.tremolo.depth, start, tremolo.gain);
    tremolo.connect(input);
    input = tremolo;
    chain.push(tremolo, wobble.amount);
    modulators.push(wobble.source);
  }
  let source: AudioScheduledSourceNode;
  if (layer.kind === 'tone') {
    const osc = oscillator(ctx, layer, start, end);
    if (layer.vibrato) {
      const vibrato = lfo(ctx, layer.vibrato.hz, layer.vibrato.cents, start, osc.detune);
      chain.push(vibrato.amount);
      modulators.push(vibrato.source);
    }
    osc.start(start);
    source = osc;
  } else {
    const buffer = ctx.createBufferSource();
    buffer.buffer = noiseBuffer(ctx);
    buffer.loop = true;
    buffer.start(start, (start * 3.7) % (NOISE_SECONDS * 0.9));
    source = buffer;
  }
  source.connect(input);
  source.stop(stop);
  for (const modulator of modulators) {
    modulator.start(start);
    modulator.stop(stop);
  }
  source.onended = () => {
    for (const node of [source, ...modulators, ...chain]) node.disconnect();
  };
  return stop;
}

export function playLayers(ctx: BaseAudioContext, output: AudioNode, when: number, layers: readonly Layer[]): number {
  let end = when;
  for (const layer of layers) end = Math.max(end, playLayer(ctx, output, when, layer));
  return end;
}
