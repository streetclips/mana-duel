import { chooseAction } from '../ai';
import {
  DECK_LIST,
  DEFAULT_DECK_ID,
  createGame,
  createScenario,
  describeEvent,
  getLegalActions,
  tryApplyAction,
  type Action,
  type ActionResult,
  type GameEvent,
  type GameOptions,
  type GameState,
  type PlayerId,
  type ScenarioSpec,
} from '../engine';
import { autoPassReason } from './autopass';
import { fxCues, fxHoldMs, type FxBatch, type FxCue } from './fx';

export interface LogEntry {
  id: number;
  turn: number;
  text: string;
  event: GameEvent;
}

export interface ControllerOptions {
  seed?: number;
  human?: PlayerId;
  aiDelayMs?: number;
  fxSpeed?: number;
  autoPass?: boolean;
  autoplay?: boolean;
  skipMulligans?: boolean;
  startingPlayer?: PlayerId;
  decks?: Matchup;
}

export type Matchup = [string, string];

export interface Replay {
  seed: number;
  startingPlayer: PlayerId;
  skipMulligans: boolean;
  decks: Matchup;
  actions: Action[];
}

const DEFAULT_MATCHUP: Matchup = [DEFAULT_DECK_ID, DEFAULT_DECK_ID];

export const DEFAULT_AI_DELAY_MS = 650;

type Listener = () => void;

const MAX_LOG = 400;
const MAX_FX = 60;
const MAX_FX_SPEED = 8;

function fxSpeedFrom(speed: number): number {
  return Number.isFinite(speed) && speed > 0 ? Math.min(speed, MAX_FX_SPEED) : 0;
}

export class GameController {
  state: GameState;
  log: LogEntry[] = [];
  fx: FxBatch[] = [];
  fxSeq = 0;
  fxSpeed: number;
  session = 0;
  readonly human: PlayerId;
  aiDelayMs: number;
  autoPass: boolean;
  autoplay: boolean;
  decks: Matchup | null;
  busy = false;
  private endTurnFor: number | null = null;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private logId = 0;
  private replay: Replay;
  private disposed = false;
  private lastCues: FxCue[] = [];

  constructor(options: ControllerOptions = {}) {
    this.human = options.human ?? 0;
    this.aiDelayMs = options.aiDelayMs ?? DEFAULT_AI_DELAY_MS;
    this.fxSpeed = fxSpeedFrom(options.fxSpeed ?? 1);
    this.autoPass = options.autoPass ?? true;
    this.autoplay = options.autoplay ?? false;
    this.decks = [...(options.decks ?? DEFAULT_MATCHUP)];
    const setup = this.setupFrom(options, this.decks);
    this.state = createGame(setup);
    this.replay = this.freshReplay(setup, this.decks);
    this.appendLog(this.state);
    this.recordFx(fxCues(null, this.state));
  }

  private setupFrom(options: ControllerOptions, decks: Matchup): GameOptions {
    return {
      seed: options.seed ?? randomSeed(),
      skipMulligans: options.skipMulligans ?? false,
      startingPlayer: options.startingPlayer,
      players: [
        { name: 'You', deck: decks[0] },
        { name: 'AI', deck: decks[1] },
      ],
    };
  }

  private freshReplay(setup: GameOptions, decks: Matchup): Replay {
    return {
      seed: this.state.seed,
      startingPlayer: this.state.startingPlayer,
      skipMulligans: setup.skipMulligans ?? false,
      decks: [...decks],
      actions: [],
    };
  }

  start(): void {
    this.disposed = false;
    this.schedule();
  }

  pause(): void {
    this.clearTimer();
    this.setBusy(false);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
    this.listeners.clear();
  }

  newGame(options: ControllerOptions = {}): void {
    this.clearTimer();
    if (options.aiDelayMs !== undefined) this.aiDelayMs = options.aiDelayMs;
    if (options.fxSpeed !== undefined) this.fxSpeed = fxSpeedFrom(options.fxSpeed);
    if (options.autoplay !== undefined) this.autoplay = options.autoplay;
    const decks: Matchup = [...(options.decks ?? this.decks ?? DEFAULT_MATCHUP)];
    const setup = this.setupFrom(options, decks);
    this.state = createGame(setup);
    this.decks = decks;
    this.replay = this.freshReplay(setup, decks);
    this.resetSession(true);
  }

  loadScenario(spec: ScenarioSpec): void {
    this.clearTimer();
    this.state = createScenario(spec);
    this.decks = null;
    this.replay = {
      seed: this.state.seed,
      startingPlayer: this.state.startingPlayer,
      skipMulligans: true,
      decks: [...DEFAULT_MATCHUP],
      actions: [],
    };
    this.resetSession(true);
  }

  loadReplay(replay: Replay): ActionResult {
    this.clearTimer();
    const decks: Matchup = [...(replay.decks ?? DEFAULT_MATCHUP)];
    let state = createGame(
      this.setupFrom({ seed: replay.seed, startingPlayer: replay.startingPlayer, skipMulligans: replay.skipMulligans }, decks),
    );
    for (const action of replay.actions) {
      const result = tryApplyAction(state, action);
      if (!result.ok) return result;
      state = result.state;
    }
    this.state = state;
    this.decks = decks;
    this.replay = { ...replay, decks, actions: [...replay.actions] };
    this.resetSession(false);
    return { ok: true, state };
  }

  private resetSession(animateStart: boolean): void {
    this.log = [];
    this.endTurnFor = null;
    this.session += 1;
    this.fx = [];
    this.recordFx(animateStart ? fxCues(null, this.state) : []);
    this.appendLog(this.state);
    this.notify();
    this.schedule();
  }

  getReplay(): Replay {
    return { ...this.replay, decks: [...this.replay.decks], actions: [...this.replay.actions] };
  }

  isHumanTurnToDecide(): boolean {
    const pending = this.state.pending;
    return !this.autoplay && !!pending && pending.kind !== 'gameOver' && pending.player === this.human;
  }

  legalActions(): Action[] {
    return this.isHumanTurnToDecide() ? getLegalActions(this.state) : [];
  }

  dispatch(action: Action): ActionResult {
    if (action.player !== this.human) return { ok: false, error: 'you can only act for your own seat' };
    if (action.type !== 'concede' && !this.isHumanTurnToDecide()) return { ok: false, error: 'it is not your decision' };
    return this.apply(action);
  }

  endTurn(): ActionResult {
    this.endTurnFor = this.state.turn;
    const pending = this.state.pending;
    if (pending?.kind === 'priority' && pending.player === this.human) {
      return this.dispatch({ type: 'pass', player: this.human });
    }
    this.schedule();
    return { ok: true, state: this.state };
  }

  concede(): ActionResult {
    return this.apply({ type: 'concede', player: this.human });
  }

  settle(maxActions = 5000): void {
    this.clearTimer();
    for (let i = 0; i < maxActions; i++) {
      const action = this.automaticAction();
      if (!action) break;
      const result = this.apply(action.action, false);
      if (!result.ok) throw new Error(`automatic action rejected: ${result.error}`);
    }
    this.schedule();
  }

  setAiDelay(ms: number): void {
    this.aiDelayMs = Math.max(0, ms);
    this.schedule();
  }

  setAutoplay(on: boolean): void {
    this.autoplay = on;
    this.schedule();
  }

  setFxSpeed(speed: number): void {
    this.fxSpeed = fxSpeedFrom(speed);
    this.notify();
    this.schedule();
  }

  private apply(action: Action, reschedule = true): ActionResult {
    const result = tryApplyAction(this.state, action);
    if (!result.ok) return result;
    const before = this.state;
    this.state = result.state;
    this.replay.actions.push(action);
    this.appendLog(result.state);
    this.recordFx(fxCues(before, result.state));
    if (this.state.turn !== before.turn) this.endTurnFor = null;
    this.notify();
    if (reschedule) this.schedule();
    return result;
  }

  private recordFx(cues: FxCue[]): void {
    this.fxSeq += 1;
    this.lastCues = cues;
    if (cues.length === 0) return;
    this.fx.push({ seq: this.fxSeq, cues });
    if (this.fx.length > MAX_FX) this.fx.shift();
  }

  private holdMs(): number {
    if (this.fxSpeed === 0 || this.aiDelayMs === 0) return 0;
    const pace = Math.min(1, this.aiDelayMs / DEFAULT_AI_DELAY_MS);
    return (fxHoldMs(this.lastCues, this.human, this.autoplay) * pace) / this.fxSpeed;
  }

  private appendLog(state: GameState): void {
    for (const event of state.events) {
      if (event.t === 'draw' && state.turn === 0) continue;
      const text = describeEvent(state, event, this.human);
      if (!text) continue;
      this.logId += 1;
      this.log.push({ id: this.logId, turn: state.turn, text, event });
    }
    if (this.log.length > MAX_LOG) this.log = this.log.slice(-MAX_LOG);
  }

  private automaticAction(): { action: Action; delay: number } | null {
    const s = this.state;
    const pending = s.pending;
    if (!pending || pending.kind === 'gameOver') return null;
    const humanDecides = pending.player === this.human && !this.autoplay;
    if (!humanDecides) {
      const action = chooseAction(s, pending.player);
      return { action, delay: this.delayFor(action) };
    }
    const endTurnRequested = this.endTurnFor === s.turn && s.activePlayer === this.human;
    if (pending.kind === 'declareAttackers' && endTurnRequested) {
      return { action: { type: 'declareAttackers', player: this.human, attackers: [] }, delay: this.holdMs() };
    }
    if (pending.kind === 'priority' && this.autoPass && autoPassReason(s, this.human, { endTurnRequested })) {
      const opponentsSpell = s.stack.length > 0 && s.stack.at(-1)?.controller !== this.human;
      return { action: { type: 'pass', player: this.human }, delay: Math.max(opponentsSpell ? this.aiDelayMs * 1.4 : 0, this.holdMs()) };
    }
    return null;
  }

  private delayFor(action: Action): number {
    if (this.aiDelayMs === 0) return 0;
    const thinking =
      action.type === 'pass' ? (this.state.stack.length > 0 ? this.aiDelayMs * 0.6 : this.aiDelayMs * 0.25) : this.aiDelayMs;
    return Math.max(thinking, this.holdMs());
  }

  private schedule(): void {
    this.clearTimer();
    if (this.disposed) return;
    const pending = this.state.pending;
    if (!pending || pending.kind === 'gameOver') {
      this.setBusy(false);
      return;
    }
    const humanDecides = pending.player === this.human && !this.autoplay;
    if (humanDecides) {
      const next = this.automaticAction();
      if (!next) {
        this.setBusy(false);
        return;
      }
      this.setBusy(true);
      this.timer = setTimeout(() => this.runScheduled(next.action), next.delay);
      return;
    }
    this.setBusy(true);
    this.timer = setTimeout(() => {
      this.timer = null;
      const next = this.automaticAction();
      if (!next) return this.schedule();
      this.timer = setTimeout(() => this.runScheduled(next.action), next.delay);
    }, 0);
  }

  private runScheduled(action: Action): void {
    this.timer = null;
    const result = this.apply(action);
    if (!result.ok) {
      console.error('Automatic action rejected', result.error, action);
      this.setBusy(false);
    }
  }

  private setBusy(busy: boolean): void {
    if (this.busy === busy) return;
    this.busy = busy;
    this.notify();
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function randomDeckId(): string {
  return DECK_LIST[Math.floor(Math.random() * DECK_LIST.length)]?.id ?? DEFAULT_DECK_ID;
}
