import { chooseAction } from '../ai';
import {
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
  autoPass?: boolean;
  autoplay?: boolean;
  skipMulligans?: boolean;
  startingPlayer?: PlayerId;
}

export interface Replay {
  seed: number;
  startingPlayer: PlayerId;
  skipMulligans: boolean;
  actions: Action[];
}

type Listener = () => void;

const MAX_LOG = 400;

export class GameController {
  state: GameState;
  log: LogEntry[] = [];
  lastEvents: GameEvent[] = [];
  readonly human: PlayerId;
  aiDelayMs: number;
  autoPass: boolean;
  autoplay: boolean;
  busy = false;
  private endTurnFor: number | null = null;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private logId = 0;
  private replay: Replay;
  private disposed = false;

  constructor(options: ControllerOptions = {}) {
    this.human = options.human ?? 0;
    this.aiDelayMs = options.aiDelayMs ?? 650;
    this.autoPass = options.autoPass ?? true;
    this.autoplay = options.autoplay ?? false;
    const setup = this.setupFrom(options);
    this.state = createGame(setup);
    this.replay = this.freshReplay(setup);
    this.appendLog(this.state);
  }

  private setupFrom(options: ControllerOptions): GameOptions {
    return {
      seed: options.seed ?? randomSeed(),
      skipMulligans: options.skipMulligans ?? false,
      startingPlayer: options.startingPlayer,
      players: [{ name: 'You' }, { name: 'AI' }],
    };
  }

  private freshReplay(setup: GameOptions): Replay {
    return {
      seed: this.state.seed,
      startingPlayer: this.state.startingPlayer,
      skipMulligans: setup.skipMulligans ?? false,
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
    if (options.autoplay !== undefined) this.autoplay = options.autoplay;
    const setup = this.setupFrom(options);
    this.state = createGame(setup);
    this.replay = this.freshReplay(setup);
    this.resetSession();
  }

  loadScenario(spec: ScenarioSpec): void {
    this.clearTimer();
    this.state = createScenario(spec);
    this.replay = { seed: this.state.seed, startingPlayer: this.state.startingPlayer, skipMulligans: true, actions: [] };
    this.resetSession();
  }

  loadReplay(replay: Replay): ActionResult {
    this.clearTimer();
    let state = createGame({
      seed: replay.seed,
      startingPlayer: replay.startingPlayer,
      skipMulligans: replay.skipMulligans,
      players: [{ name: 'You' }, { name: 'AI' }],
    });
    for (const action of replay.actions) {
      const result = tryApplyAction(state, action);
      if (!result.ok) return result;
      state = result.state;
    }
    this.state = state;
    this.replay = { ...replay, actions: [...replay.actions] };
    this.resetSession();
    return { ok: true, state };
  }

  private resetSession(): void {
    this.log = [];
    this.lastEvents = [];
    this.endTurnFor = null;
    this.appendLog(this.state);
    this.notify();
    this.schedule();
  }

  getReplay(): Replay {
    return { ...this.replay, actions: [...this.replay.actions] };
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

  private apply(action: Action, reschedule = true): ActionResult {
    const result = tryApplyAction(this.state, action);
    if (!result.ok) return result;
    const previousTurn = this.state.turn;
    this.state = result.state;
    this.replay.actions.push(action);
    this.lastEvents = result.state.events;
    this.appendLog(result.state);
    if (this.state.turn !== previousTurn) this.endTurnFor = null;
    this.notify();
    if (reschedule) this.schedule();
    return result;
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
      return { action: { type: 'declareAttackers', player: this.human, attackers: [] }, delay: 0 };
    }
    if (pending.kind === 'priority' && this.autoPass && autoPassReason(s, this.human, { endTurnRequested })) {
      const opponentsSpell = s.stack.length > 0 && s.stack.at(-1)?.controller !== this.human;
      return { action: { type: 'pass', player: this.human }, delay: opponentsSpell ? this.aiDelayMs * 1.4 : 0 };
    }
    return null;
  }

  private delayFor(action: Action): number {
    if (this.aiDelayMs === 0) return 0;
    if (action.type === 'pass') return this.state.stack.length > 0 ? this.aiDelayMs * 0.6 : this.aiDelayMs * 0.25;
    return this.aiDelayMs;
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
