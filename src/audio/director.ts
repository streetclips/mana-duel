import type { GameController } from '../app/controller';
import { fxTime } from '../ui/fx';
import { ENDING_AT, endingSound, soundsFor } from './cues';
import { TITLE_THEME, musicMood, themeFor, type Mood, type Theme } from './music';
import { soundEvent, type SoundEvent } from './sounds';

export type Scene = 'title' | 'game';

export interface AudioSink {
  setTheme(theme: Theme, restart?: boolean): void;
  setMood(mood: Mood): void;
  play(events: readonly SoundEvent[]): void;
}

export type Defer = (task: () => void) => void;

const microtask: Defer = (task) => queueMicrotask(task);

function isOver(controller: GameController): boolean {
  return controller.state.pending?.kind === 'gameOver';
}

export class SoundDirector {
  private scene: Scene;
  private session: number;
  private seq = 0;
  private over: boolean;
  private queued = false;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly controller: GameController,
    private readonly sink: AudioSink,
    scene: Scene = 'title',
    private readonly defer: Defer = microtask,
  ) {
    this.scene = scene;
    this.session = controller.session;
    this.over = isOver(controller);
    this.unsubscribe = controller.subscribe(() => this.changed());
    this.applyScene(true);
    this.queue();
  }

  get currentScene(): Scene {
    return this.scene;
  }

  setScene(scene: Scene): void {
    if (scene === this.scene) return;
    this.scene = scene;
    this.applyScene(true);
    this.queue();
  }

  dispose(): void {
    this.unsubscribe();
  }

  flush(): void {
    if (this.scene !== 'game') return;
    const c = this.controller;
    const fresh = c.fx.filter((batch) => batch.seq > this.seq);
    this.seq = Math.max(this.seq, c.fxSeq);
    const time = c.fxSpeed > 0 ? fxTime(c.fxSpeed) : 1;
    const events = soundsFor(fresh, { state: c.state, viewer: c.human, time });
    const over = isOver(c);
    if (over && !this.over) {
      const ending = endingSound(c.state.pending, c.human, c.autoplay);
      if (ending) events.push(soundEvent(ending, { seq: c.fxSeq, at: ENDING_AT * time }));
    }
    this.over = over;
    if (events.length > 0) this.sink.play(events);
    this.sink.setMood(musicMood(c.state));
  }

  private changed(): void {
    const c = this.controller;
    if (c.session !== this.session) {
      this.session = c.session;
      this.over = isOver(c);
      if (this.scene === 'game') this.sink.setTheme(themeFor(c.decks, c.human), true);
    }
    this.queue();
  }

  private queue(): void {
    if (this.queued) return;
    this.queued = true;
    this.defer(() => {
      this.queued = false;
      this.flush();
    });
  }

  private applyScene(restart: boolean): void {
    if (this.scene === 'title') {
      this.sink.setTheme(TITLE_THEME);
      this.sink.setMood('calm');
      return;
    }
    const c = this.controller;
    this.sink.setTheme(themeFor(c.decks, c.human), restart);
    this.sink.setMood(musicMood(c.state));
  }
}
