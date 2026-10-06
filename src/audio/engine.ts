import type { Color } from '../engine';
import { SoundGate } from './gate';
import { STEPS_PER_BAR, TITLE_THEME, nextMood, notesAt, stepSeconds, type Mood, type Theme } from './music';
import { JINGLES, type SoundEvent, type SoundId } from './sounds';
import {
  MASTER_LEVEL,
  MUSIC_LEVEL,
  SFX_LEVEL,
  createMix,
  noteLayers,
  playLayers,
  soundLayers,
  type Mix,
} from './synth';

export type ContextState = 'none' | 'suspended' | 'running' | 'closed' | 'interrupted';

export interface PlayedSound {
  seq: number;
  sound: SoundId;
  at: number;
  gain: number;
  pitch: number;
  color: Color | null;
}

export interface AudioLevel {
  rms: number;
  peak: number;
}

export interface AudioState {
  supported: boolean;
  context: ContextState;
  hidden: boolean;
  volume: number;
  music: {
    on: boolean;
    playing: boolean;
    theme: string;
    mood: Mood;
    heard: Mood;
    tempo: number;
    bar: number;
    notes: number;
  };
  sfx: { on: boolean; played: number; dropped: number };
}

export interface Timers {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
  setTimeout(callback: () => void, ms: number): unknown;
}

export interface AudioEngineOptions {
  music?: boolean;
  sfx?: boolean;
  volume?: number;
  createContext?: (() => AudioContext) | null;
  mayStart?: () => boolean;
  timers?: Timers;
}

export const LOOKAHEAD_SECONDS = 0.3;
export const TICK_MS = 60;
export const FADE_SECONDS = 0.35;
export const START_DELAY = 0.08;
export const SFX_LATENCY = 0.01;
const MAX_PLAYED = 200;

type AudioScope = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export function defaultContextFactory(): (() => AudioContext) | null {
  const scope = globalThis as AudioScope;
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  return Context ? () => new Context({ latencyHint: 'interactive' }) : null;
}

type ActivationNavigator = Navigator & { userActivation?: { hasBeenActive: boolean } };

function hasBeenActive(): boolean {
  const activation = typeof navigator === 'undefined' ? undefined : (navigator as ActivationNavigator).userActivation;
  return !activation || activation.hasBeenActive;
}

const GLOBAL_TIMERS: Timers = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
};

function clampVolume(volume: number): number {
  return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
}

export function measureLevel(samples: Float32Array): AudioLevel {
  let sum = 0;
  let peak = 0;
  for (const sample of samples) {
    sum += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  return { rms: samples.length > 0 ? Math.sqrt(sum / samples.length) : 0, peak };
}

export class AudioEngine {
  music: boolean;
  sfx: boolean;
  volume: number;
  hidden = false;
  private readonly factory: (() => AudioContext) | null;
  private readonly mayStart: () => boolean;
  private readonly timers: Timers;
  private ctx: AudioContext | null = null;
  private mix: Mix | null = null;
  private failed = false;
  private theme: Theme = TITLE_THEME;
  private wanted: Mood = 'calm';
  private heard: Mood = 'calm';
  private step = 0;
  private nextStepAt = 0;
  private notes = 0;
  private generation: GainNode | null = null;
  private ticker: unknown = null;
  private readonly gate = new SoundGate();
  private log: PlayedSound[] = [];
  private playedCount = 0;
  private dropped = 0;
  private listeners = new Set<() => void>();

  constructor(options: AudioEngineOptions = {}) {
    this.music = options.music ?? true;
    this.sfx = options.sfx ?? true;
    this.volume = clampVolume(options.volume ?? 1);
    this.factory = options.createContext === undefined ? defaultContextFactory() : options.createContext;
    this.mayStart = options.mayStart ?? hasBeenActive;
    this.timers = options.timers ?? GLOBAL_TIMERS;
  }

  get supported(): boolean {
    return this.factory !== null && !this.failed;
  }

  get context(): ContextState {
    return this.ctx ? this.ctx.state : 'none';
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  unlock(): Promise<void> {
    if (!this.wantsSound() || this.hidden) return Promise.resolve();
    const ctx = this.ensureContext();
    if (!ctx) return Promise.resolve();
    if (ctx.state === 'running' || ctx.state === 'closed') return Promise.resolve();
    return ctx.resume().then(
      () => this.contextChanged(),
      () => this.contextChanged(),
    );
  }

  setTheme(theme: Theme, restart = false): void {
    if (theme.id === this.theme.id && !restart) return;
    this.theme = theme;
    this.restartMusic();
    this.notify();
  }

  setMood(mood: Mood): void {
    if (mood === this.wanted) return;
    this.wanted = mood;
    this.notify();
  }

  setMusic(on: boolean): void {
    if (on === this.music) return;
    this.music = on;
    if (this.mix) {
      if (on) this.restartMusic();
      this.ramp(this.mix.music.gain, on ? MUSIC_LEVEL : 0);
    }
    this.settingsChanged();
  }

  setSfx(on: boolean): void {
    if (on === this.sfx) return;
    this.sfx = on;
    if (this.mix) this.ramp(this.mix.sfx.gain, on ? SFX_LEVEL : 0);
    if (!on) this.gate.reset();
    this.settingsChanged();
  }

  setVolume(volume: number): void {
    this.volume = clampVolume(volume);
    if (this.mix) this.ramp(this.mix.master.gain, MASTER_LEVEL * this.volume);
    this.notify();
  }

  setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    const ctx = this.ctx;
    if (ctx && ctx.state !== 'closed') {
      if (hidden) ctx.suspend().catch(() => undefined);
      else if (this.wantsSound()) ctx.resume().catch(() => undefined);
    }
    this.syncTicker();
    this.notify();
  }

  play(events: readonly SoundEvent[]): void {
    const ctx = this.ctx;
    const mix = this.mix;
    if (!this.sfx || this.hidden || !ctx || !mix || ctx.state !== 'running') return;
    const now = ctx.currentTime + SFX_LATENCY;
    for (const event of events) {
      const when = now + Math.max(0, event.at);
      if (!JINGLES.has(event.sound) && !this.gate.allow(event.sound, when)) {
        this.dropped += 1;
        continue;
      }
      playLayers(ctx, mix.sfx, when, soundLayers(event));
      this.record(event, when);
    }
  }

  played(since?: number): PlayedSound[] {
    return this.log.filter((sound) => since === undefined || sound.seq > since).map((sound) => ({ ...sound }));
  }

  level(): AudioLevel {
    const analyser = this.mix?.analyser;
    if (!analyser || this.ctx?.state !== 'running') return { rms: 0, peak: 0 };
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    return measureLevel(samples);
  }

  state(): AudioState {
    const running = this.ctx?.state === 'running';
    return {
      supported: this.supported,
      context: this.context,
      hidden: this.hidden,
      volume: this.volume,
      music: {
        on: this.music,
        playing: this.music && running && !this.hidden,
        theme: this.theme.id,
        mood: this.wanted,
        heard: this.heard,
        tempo: this.theme.tempo,
        bar: Math.floor(this.step / STEPS_PER_BAR),
        notes: this.notes,
      },
      sfx: { on: this.sfx, played: this.playedCount, dropped: this.dropped },
    };
  }

  dispose(): void {
    if (this.ticker !== null) this.timers.clearInterval(this.ticker);
    this.ticker = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.mix = null;
    this.generation = null;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => undefined);
    this.listeners.clear();
  }

  private wantsSound(): boolean {
    return this.music || this.sfx;
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (!this.factory || this.failed || !this.mayStart()) return null;
    try {
      const ctx = this.factory();
      this.ctx = ctx;
      this.mix = createMix(ctx, {
        master: MASTER_LEVEL * this.volume,
        music: 0,
        sfx: this.sfx ? SFX_LEVEL : 0,
        analyser: true,
      });
      ctx.onstatechange = () => this.contextChanged();
      this.restartMusic();
      if (this.music) this.ramp(this.mix.music.gain, MUSIC_LEVEL);
      this.notify();
      return ctx;
    } catch {
      this.failed = true;
      this.ctx = null;
      this.mix = null;
      this.notify();
      return null;
    }
  }

  private contextChanged(): void {
    this.syncTicker();
    this.notify();
  }

  private settingsChanged(): void {
    if (this.wantsSound()) this.unlock().catch(() => undefined);
    else this.suspendAfterFade();
    this.syncTicker();
    this.notify();
  }

  private suspendAfterFade(): void {
    this.timers.setTimeout(
      () => {
        const ctx = this.ctx;
        if (!this.wantsSound() && ctx?.state === 'running') ctx.suspend().catch(() => undefined);
      },
      FADE_SECONDS * 1000 + 50,
    );
  }

  private ramp(param: AudioParam, value: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + FADE_SECONDS);
  }

  private restartMusic(): void {
    this.step = 0;
    this.heard = this.wanted;
    const ctx = this.ctx;
    const mix = this.mix;
    if (!ctx || !mix) return;
    const now = ctx.currentTime;
    const old = this.generation;
    if (old) {
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
      this.timers.setTimeout(() => old.disconnect(), (FADE_SECONDS + 0.2) * 1000);
    }
    const generation = ctx.createGain();
    generation.gain.value = 1;
    generation.connect(mix.music);
    this.generation = generation;
    this.nextStepAt = now + (old ? FADE_SECONDS * 0.6 : START_DELAY);
  }

  private syncTicker(): void {
    const run = this.music && !this.hidden && this.ctx?.state === 'running';
    if (run && this.ticker === null) {
      this.ticker = this.timers.setInterval(() => this.tick(), TICK_MS);
      this.tick();
    } else if (!run && this.ticker !== null) {
      this.timers.clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private tick(): void {
    const ctx = this.ctx;
    const generation = this.generation;
    if (!ctx || !generation || ctx.state !== 'running' || !this.music || this.hidden) return;
    const now = ctx.currentTime;
    if (this.nextStepAt < now) this.nextStepAt = now + START_DELAY;
    const seconds = stepSeconds(this.theme);
    while (this.nextStepAt < now + LOOKAHEAD_SECONDS) {
      this.heard = nextMood(this.heard, this.wanted, this.step);
      for (const note of notesAt(this.theme, this.heard, this.step)) {
        playLayers(ctx, generation, this.nextStepAt, noteLayers(note, seconds));
        this.notes += 1;
      }
      this.step += 1;
      this.nextStepAt += seconds;
    }
  }

  private record(event: SoundEvent, when: number): void {
    this.playedCount += 1;
    this.log.push({
      seq: event.seq,
      sound: event.sound,
      at: Math.round(when * 1000) / 1000,
      gain: event.gain,
      pitch: event.pitch,
      color: event.color,
    });
    if (this.log.length > MAX_PLAYED) this.log.shift();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
