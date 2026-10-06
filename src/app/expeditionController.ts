import type { DeckDef } from '../engine';
import { randomSeed, type GameController, type OpponentSetup, type Replay } from './controller';
import { DuelTracker, type DuelResult } from './duelTracker';
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
  type ExpeditionRun,
} from './expedition';
import type { RelicId } from './relics';

export interface RunStore {
  load(): unknown;
  save(run: ExpeditionRun | null): void;
}

export const NO_STORE: RunStore = { load: () => null, save: () => undefined };

export interface DuelInfo {
  number: number;
  total: number;
  rival: string;
  boss: boolean;
  result: DuelResult | null;
  revived: boolean;
}

type Listener = () => void;

export class ExpeditionController {
  run: ExpeditionRun | null;
  private duelInfo: DuelInfo | null = null;
  private listeners = new Set<Listener>();
  private readonly tracker: DuelTracker;

  constructor(
    private readonly game: GameController,
    private readonly store: RunStore = NO_STORE,
  ) {
    const stored = store.load();
    this.run = isExpeditionRun(stored) ? stored : null;
    this.tracker = new DuelTracker(game, { save: (replay) => this.saveDuel(replay), end: (result, turns) => this.endDuel(result, turns) });
  }

  get inDuel(): boolean {
    return this.tracker.following;
  }

  get currentDuel(): DuelInfo | null {
    return this.inDuel ? this.duelInfo : null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.tracker.dispose();
    this.listeners.clear();
  }

  flush(): void {
    this.tracker.flush();
  }

  start(base: DeckDef, seed: number = randomSeed()): ExpeditionRun {
    const run = createRun(base, seed);
    this.tracker.forget();
    this.update(run);
    return run;
  }

  abandon(): void {
    this.tracker.forget();
    this.update(null);
  }

  fight(opponent: OpponentSetup = this.game.opponent): void {
    const run = this.run;
    if (!run || run.stage.kind !== 'duel') throw new Error('the expedition has no duel to fight now');
    this.game.setAutoplay(false);
    if (run.duel && this.game.loadReplay({ ...run.duel, decks: duelSetup(run).decks }, opponent).ok) {
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
    this.duelInfo = rival
      ? { number: run.wins + 1, total: run.rivals.length, rival: rival.deck, boss: rival.boss, result: null, revived: false }
      : null;
    this.update(run);
    this.tracker.follow();
  }

  private saveDuel(replay: Replay): void {
    const run = this.run;
    if (run?.stage.kind === 'duel') this.update(withDuel(run, replay));
  }

  private endDuel(result: DuelResult, turns: number): void {
    const run = this.run;
    if (run?.stage.kind !== 'duel' || !currentRival(run)) return;
    const next = recordDuel(run, result, turns);
    if (this.duelInfo) this.duelInfo = { ...this.duelInfo, result, revived: result === 'lost' && next.stage.kind === 'duel' };
    this.update(next);
  }

  private require(): ExpeditionRun {
    if (!this.run) throw new Error('there is no expedition under way');
    return this.run;
  }

  private update(run: ExpeditionRun | null): void {
    this.run = run;
    this.store.save(run);
    for (const listener of this.listeners) listener();
  }
}
