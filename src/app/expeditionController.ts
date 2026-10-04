import type { DeckDef } from '../engine';
import { randomSeed, type GameController, type OpponentSetup } from './controller';
import {
  chooseCard,
  chooseRelic,
  createRun,
  currentRival,
  duelSetup,
  isExpeditionRun,
  recordDuel,
  startDuel,
  swapCard,
  withDuel,
  type DuelResult,
  type ExpeditionRun,
  type RelicId,
} from './expedition';

export interface RunStore {
  load(): unknown;
  save(run: ExpeditionRun | null): void;
}

export const NO_STORE: RunStore = { load: () => null, save: () => undefined };

export const SAVE_DELAY_MS = 500;

export interface DuelInfo {
  number: number;
  total: number;
  rival: string;
  boss: boolean;
  result: DuelResult | null;
}

type Listener = () => void;

export class ExpeditionController {
  run: ExpeditionRun | null;
  private duelSession: number | null = null;
  private recordedSession: number | null = null;
  private savedActions = -1;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private duelInfo: DuelInfo | null = null;
  private listeners = new Set<Listener>();
  private readonly stopWatching: () => void;

  constructor(
    private readonly game: GameController,
    private readonly store: RunStore = NO_STORE,
  ) {
    const stored = store.load();
    this.run = isExpeditionRun(stored) ? stored : null;
    this.stopWatching = game.subscribe(() => this.watch());
  }

  get inDuel(): boolean {
    return this.duelSession !== null && this.duelSession === this.game.session;
  }

  get currentDuel(): DuelInfo | null {
    return this.inDuel ? this.duelInfo : null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.cancelSave();
    this.stopWatching();
    this.listeners.clear();
  }

  flush(): void {
    this.cancelSave();
    const run = this.run;
    if (!run || !this.following(run) || run.duel?.actions.length === this.game.state.actionCount) return;
    this.update(withDuel(run, this.game.getReplay()));
  }

  start(base: DeckDef, seed: number = randomSeed()): ExpeditionRun {
    const run = createRun(base, seed);
    this.cancelSave();
    this.duelSession = null;
    this.update(run);
    return run;
  }

  abandon(): void {
    this.cancelSave();
    this.duelSession = null;
    this.update(null);
  }

  fight(opponent: OpponentSetup = this.game.opponent): void {
    const run = this.run;
    if (!run || run.stage.kind !== 'duel') throw new Error('the expedition has no duel to fight now');
    this.game.setAutoplay(false);
    if (run.duel && this.game.loadReplay(run.duel, opponent).ok) {
      this.follow(run);
      return;
    }
    const { run: next, seed, startingPlayer } = startDuel(run);
    const setup = duelSetup(next);
    this.game.newGame({ ...setup, seed, startingPlayer, opponent, autoplay: false, skipMulligans: false });
    this.follow(withDuel(next, this.game.getReplay()));
  }

  chooseCard(card: string | null): void {
    this.update(chooseCard(this.require(), card));
  }

  swapCard(out: string | null): void {
    this.update(swapCard(this.require(), out));
  }

  chooseRelic(relic: RelicId): void {
    this.update(chooseRelic(this.require(), relic));
  }

  private follow(run: ExpeditionRun): void {
    const rival = currentRival(run);
    this.duelInfo = rival ? { number: run.wins + 1, total: run.rivals.length, rival: rival.deck, boss: rival.boss, result: null } : null;
    this.duelSession = this.game.session;
    this.recordedSession = null;
    this.savedActions = this.game.state.actionCount;
    this.update(run);
    this.watch();
  }

  private require(): ExpeditionRun {
    if (!this.run) throw new Error('there is no expedition under way');
    return this.run;
  }

  private following(run: ExpeditionRun): boolean {
    return this.inDuel && this.recordedSession !== this.game.session && run.stage.kind === 'duel' && currentRival(run) !== null;
  }

  private watch(): void {
    const run = this.run;
    if (!run || !this.following(run)) return;
    const s = this.game.state;
    const pending = s.pending;
    if (pending?.kind === 'gameOver') {
      this.cancelSave();
      this.recordedSession = this.game.session;
      const result: DuelResult = pending.winner === null ? 'draw' : pending.winner === this.game.human ? 'won' : 'lost';
      if (this.duelInfo) this.duelInfo = { ...this.duelInfo, result };
      this.update(recordDuel(run, result, s.turn));
      return;
    }
    if (s.actionCount === this.savedActions) return;
    this.savedActions = s.actionCount;
    this.saveTimer ??= setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  private cancelSave(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  private update(run: ExpeditionRun | null): void {
    this.run = run;
    this.store.save(run);
    for (const listener of this.listeners) listener();
  }
}
