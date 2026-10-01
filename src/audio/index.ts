import type { GameController } from '../app/controller';
import type { Color } from '../engine';
import { SoundDirector, type Defer, type Scene } from './director';
import { AudioEngine, type AudioEngineOptions, type AudioLevel, type AudioState, type PlayedSound } from './engine';
import { allThemes, keyName, type Timbre } from './music';
import { renderAudio, type RenderResult, type RenderTarget } from './render';
import { SOUNDS, type SoundId } from './sounds';

export type { Scene } from './director';
export type { AudioLevel, AudioState, ContextState, PlayedSound } from './engine';
export type { Mood } from './music';
export type { RenderResult, RenderTarget } from './render';
export type { SoundId } from './sounds';

export const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'] as const;

export interface ThemeSummary {
  id: string;
  name: string;
  colors: Color[];
  key: string;
  tempo: number;
  lead: Timbre;
}

export interface GameAudioOptions extends AudioEngineOptions {
  scene?: Scene;
  defer?: Defer;
}

export class GameAudio {
  readonly engine: AudioEngine;
  private director: SoundDirector | null = null;
  private scene: Scene;
  private readonly defer: Defer | undefined;

  constructor(options: GameAudioOptions = {}) {
    this.engine = new AudioEngine(options);
    this.scene = options.scene ?? 'title';
    this.defer = options.defer;
  }

  get music(): boolean {
    return this.engine.music;
  }

  get sfx(): boolean {
    return this.engine.sfx;
  }

  attach(controller: GameController): void {
    this.director?.dispose();
    this.director = new SoundDirector(controller, this.engine, this.scene, this.defer);
  }

  setScene(scene: Scene): void {
    this.scene = scene;
    this.director?.setScene(scene);
  }

  listen(target: Window): () => void {
    const unlock = (): void => {
      this.engine.unlock().catch(() => undefined);
    };
    const doc = target.document;
    const visibility = (): void => this.engine.setHidden(doc.visibilityState === 'hidden');
    for (const type of UNLOCK_EVENTS) target.addEventListener(type, unlock, { capture: true, passive: true });
    doc.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      for (const type of UNLOCK_EVENTS) target.removeEventListener(type, unlock, { capture: true });
      doc.removeEventListener('visibilitychange', visibility);
    };
  }

  subscribe(listener: () => void): () => void {
    return this.engine.subscribe(listener);
  }

  state(): AudioState {
    return this.engine.state();
  }

  played(since?: number): PlayedSound[] {
    return this.engine.played(since);
  }

  sounds(): SoundId[] {
    return [...SOUNDS];
  }

  themes(): ThemeSummary[] {
    return allThemes().map((theme) => ({
      id: theme.id,
      name: theme.name,
      colors: [...theme.colors],
      key: keyName(theme),
      tempo: theme.tempo,
      lead: theme.lead,
    }));
  }

  level(): AudioLevel {
    return this.engine.level();
  }

  render(target: RenderTarget): Promise<RenderResult> {
    return renderAudio(target);
  }

  setMusic(on: boolean): void {
    this.engine.setMusic(on);
  }

  setSfx(on: boolean): void {
    this.engine.setSfx(on);
  }

  setVolume(volume: number): void {
    this.engine.setVolume(volume);
  }

  async unlock(): Promise<AudioState> {
    await this.engine.unlock();
    return this.engine.state();
  }

  dispose(): void {
    this.director?.dispose();
    this.director = null;
    this.engine.dispose();
  }
}

export function bindAudioDataset(audio: GameAudio, element: HTMLElement): () => void {
  const sync = (): void => {
    const state = audio.state();
    element.dataset.audio = state.supported ? state.context : 'unsupported';
    element.dataset.music = state.music.on ? state.music.theme : 'off';
    element.dataset.mood = state.music.mood;
  };
  sync();
  return audio.subscribe(sync);
}
