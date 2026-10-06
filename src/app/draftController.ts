import type { PlayerId } from '../engine';
import { randomSeed, type GameController, type OpponentSetup, type Replay } from './controller';
import type { DeckDraft } from './deckBuilding';
import {
  createDraft,
  isDraftRun,
  matchSetup,
  pickCard,
  recordGame,
  resumeSetup,
  saveDeck,
  startGame,
  withGame,
  type DraftFormat,
  type DraftRun,
} from './draft';
import { DuelTracker, type DuelResult } from './duelTracker';

export interface DraftStore {
  load(): unknown;
  save(run: DraftRun | null): void;
}

export const NO_DRAFT_STORE: DraftStore = { load: () => null, save: () => undefined };

export interface GameInfo {
  number: number;
  result: DuelResult | null;
  wins: [number, number];
}

type Listener = () => void;

export class DraftController {
  run: DraftRun | null;
  private gameInfo: GameInfo | null = null;
  private listeners = new Set<Listener>();
  private readonly tracker: DuelTracker;

  constructor(
    private readonly game: GameController,
    private readonly store: DraftStore = NO_DRAFT_STORE,
  ) {
    const stored = store.load();
    this.run = isDraftRun(stored) ? stored : null;
    this.tracker = new DuelTracker(game, {
      save: (replay) => this.saveGame(replay),
      end: (result, turns) => this.endGame(result, turns),
    });
  }

  get inGame(): boolean {
    return this.tracker.following;
  }

  get currentGame(): GameInfo | null {
    return this.inGame ? this.gameInfo : null;
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

  start(format: DraftFormat, seed: number = randomSeed()): DraftRun {
    const run = createDraft(format, seed);
    this.tracker.forget();
    this.update(run);
    return run;
  }

  abandon(): void {
    this.tracker.forget();
    this.update(null);
  }

  pick(card: string): void {
    this.update(pickCard(this.require(), card));
  }

  saveDeck(draft: DeckDraft): void {
    this.update(saveDeck(this.require(), draft));
  }

  play(opponent: OpponentSetup = this.game.opponent): void {
    const run = this.require();
    const decks = matchSetup(run);
    this.game.setAutoplay(false);
    if (run.duel && this.game.loadReplay({ ...run.duel, decks: resumeSetup(run) }, opponent).ok) {
      this.follow(run);
      return;
    }
    const { run: next, seed, startingPlayer } = startGame(run);
    this.game.newGame({
      decks,
      perks: [{}, {}],
      seed,
      startingPlayer,
      opponent,
      autoplay: false,
      skipMulligans: false,
    });
    this.follow(withGame(next, this.game.getReplay()));
  }

  private follow(run: DraftRun): void {
    this.gameInfo = { number: run.games.length + 1, result: null, wins: [...run.wins] };
    this.update(run);
    this.tracker.follow();
  }

  private saveGame(replay: Replay): void {
    const run = this.run;
    if (run?.stage === 'match') this.update(withGame(run, replay));
  }

  private endGame(result: DuelResult, turns: number): void {
    const run = this.run;
    if (run?.stage !== 'match') return;
    const winner: PlayerId | null = result === 'draw' ? null : result === 'won' ? 0 : 1;
    const next = recordGame(run, winner, turns);
    this.gameInfo = { number: run.games.length + 1, result, wins: [...next.wins] };
    this.update(next);
  }

  private require(): DraftRun {
    if (!this.run) throw new Error('there is no draft under way');
    return this.run;
  }

  private update(run: DraftRun | null): void {
    this.run = run;
    this.store.save(run);
    for (const listener of this.listeners) listener();
  }
}
