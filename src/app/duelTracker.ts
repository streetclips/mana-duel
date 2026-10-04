import type { GameController, Replay } from './controller';

export const SAVE_DELAY_MS = 500;

export type DuelResult = 'won' | 'lost' | 'draw';

export interface DuelHooks {
  save(replay: Replay): void;
  end(result: DuelResult, turns: number): void;
}

export class DuelTracker {
  private session: number | null = null;
  private endedSession: number | null = null;
  private saved = -1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly stop: () => void;

  constructor(
    private readonly game: GameController,
    private readonly hooks: DuelHooks,
  ) {
    this.stop = game.subscribe(() => this.watch());
  }

  get following(): boolean {
    return this.session !== null && this.session === this.game.session;
  }

  get ended(): boolean {
    return this.following && this.endedSession === this.game.session;
  }

  follow(): void {
    this.cancel();
    this.session = this.game.session;
    this.endedSession = null;
    this.saved = this.game.state.actionCount;
    this.watch();
  }

  forget(): void {
    this.cancel();
    this.session = null;
  }

  flush(): void {
    this.cancel();
    if (!this.following || this.ended || this.game.state.actionCount === this.saved) return;
    this.saved = this.game.state.actionCount;
    this.hooks.save(this.game.getReplay());
  }

  dispose(): void {
    this.cancel();
    this.stop();
  }

  private watch(): void {
    if (!this.following || this.ended) return;
    const s = this.game.state;
    const pending = s.pending;
    if (pending?.kind === 'gameOver') {
      this.cancel();
      this.endedSession = this.game.session;
      this.hooks.end(pending.winner === null ? 'draw' : pending.winner === this.game.human ? 'won' : 'lost', s.turn);
      return;
    }
    if (s.actionCount !== this.saved) this.timer ??= setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  private cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
