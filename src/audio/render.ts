import type { Color } from '../engine';
import { MOODS, STEPS_PER_BAR, findTheme, notesAt, stepSeconds, type Mood } from './music';
import { isSoundId, soundEvent, type SoundId } from './sounds';
import { MASTER_LEVEL, MUSIC_LEVEL, REVERB_SECONDS, SFX_LEVEL, createMix, layersSeconds, noteLayers, playLayers, soundLayers, type Layer } from './synth';

export type RenderTarget = SoundId | { sound: SoundId; color?: Color | null; pitch?: number } | { theme: string; mood?: Mood; bars?: number };

export interface RenderResult {
  seconds: number;
  peak: number;
  rms: number;
  tail: number;
  finite: boolean;
}

export const RENDER_SAMPLE_RATE = 44100;
export const MAX_RENDER_BARS = 8;
const LEAD_IN = 0.01;
const TAIL_SECONDS = 0.05;

type OfflineScope = typeof globalThis & { webkitOfflineAudioContext?: typeof OfflineAudioContext };

function offlineContext(seconds: number): OfflineAudioContext {
  const scope = globalThis as OfflineScope;
  const Offline = scope.OfflineAudioContext ?? scope.webkitOfflineAudioContext;
  if (!Offline) throw new Error('Web Audio is not available here');
  return new Offline(2, Math.ceil(RENDER_SAMPLE_RATE * seconds), RENDER_SAMPLE_RATE);
}

interface Scheduled {
  at: number;
  layers: Layer[];
}

function scheduleOf(target: RenderTarget): { bus: 'music' | 'sfx'; parts: Scheduled[]; active: number } {
  if (typeof target === 'string' || 'sound' in target) {
    const spec = typeof target === 'string' ? { sound: target } : target;
    if (!isSoundId(spec.sound)) throw new Error(`Unknown sound: ${String(spec.sound)}`);
    const layers = soundLayers(soundEvent(spec.sound, { color: 'color' in spec ? (spec.color ?? null) : null, pitch: 'pitch' in spec ? (spec.pitch ?? 0) : 0 }));
    return { bus: 'sfx', parts: [{ at: LEAD_IN, layers }], active: LEAD_IN + layersSeconds(layers) };
  }
  const theme = findTheme(target.theme);
  if (!theme) throw new Error(`Unknown theme: ${target.theme}`);
  const mood = target.mood ?? 'calm';
  if (!MOODS.includes(mood)) throw new Error(`Unknown mood: ${String(mood)}`);
  const bars = Math.max(1, Math.min(MAX_RENDER_BARS, Math.floor(target.bars ?? 1)));
  const step = stepSeconds(theme);
  const parts: Scheduled[] = [];
  let active = LEAD_IN + bars * STEPS_PER_BAR * step;
  for (let index = 0; index < bars * STEPS_PER_BAR; index++) {
    for (const note of notesAt(theme, mood, index)) {
      const layers = noteLayers(note, step);
      const at = LEAD_IN + index * step;
      parts.push({ at, layers });
      active = Math.max(active, at + layersSeconds(layers));
    }
  }
  return { bus: 'music', parts, active };
}

function round(value: number): number {
  return Math.round(value * 100000) / 100000;
}

function measure(buffer: AudioBuffer, active: number): RenderResult {
  const activeEnd = Math.min(buffer.length, Math.ceil(active * buffer.sampleRate));
  const tailStart = Math.max(0, buffer.length - Math.ceil(TAIL_SECONDS * buffer.sampleRate));
  let peak = 0;
  let sum = 0;
  let tailSum = 0;
  let finite = true;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      const sample = data[i] ?? 0;
      if (!Number.isFinite(sample)) {
        finite = false;
        continue;
      }
      peak = Math.max(peak, Math.abs(sample));
      if (i < activeEnd) sum += sample * sample;
      if (i >= tailStart) tailSum += sample * sample;
    }
  }
  const channels = Math.max(1, buffer.numberOfChannels);
  return {
    seconds: round(buffer.duration),
    peak: round(peak),
    rms: round(Math.sqrt(sum / Math.max(1, activeEnd * channels))),
    tail: round(Math.sqrt(tailSum / Math.max(1, (buffer.length - tailStart) * channels))),
    finite,
  };
}

export async function renderAudio(target: RenderTarget): Promise<RenderResult> {
  const { bus, parts, active } = scheduleOf(target);
  const ctx = offlineContext(active + REVERB_SECONDS + TAIL_SECONDS);
  const mix = createMix(ctx, { master: MASTER_LEVEL, music: MUSIC_LEVEL, sfx: SFX_LEVEL });
  for (const part of parts) playLayers(ctx, mix[bus], part.at, part.layers);
  return measure(await ctx.startRendering(), active);
}
