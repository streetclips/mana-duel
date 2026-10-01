import { chooseAction } from '../ai';
import {
  DECK_LIST,
  DEFAULT_DECK_ID,
  createGame,
  createScenario,
  describeEventParts,
  forcedAction,
  getLegalActions,
  opponent,
  plainText,
  tryApplyAction,
  type Action,
  type ActionResult,
  type GameEvent,
  type GameOptions,
  type GameState,
  type PendingDecision,
  type PlayerId,
  type ScenarioSpec,
  type Step,
  type TextPart,
} from '../engine';
import type { ReasoningEffort } from '../llm/models';
import type { LlmDecision, LlmPlayer } from '../llm/player';
import type { Prompt, PromptContext } from '../llm/prompt';
import { eventLines, thoughtLine } from '../llm/view';
import { autoPassReason } from './autopass';
import { fxCues, fxHoldMs, type FxBatch, type FxCue } from './fx';

export interface LogEntry {
  id: number;
  turn: number;
  text: string;
  parts: TextPart[];
  event: GameEvent | null;
}

export type LlmSetup = { kind: 'llm'; model: string; effort?: ReasoningEffort };
export type OpponentSetup = { kind: 'classic' } | LlmSetup;
export type LlmFactory = (setup: LlmSetup) => LlmPlayer;

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
  opponent?: OpponentSetup;
  llmFactory?: LlmFactory;
}

export type Matchup = [string, string];

export interface Replay {
  seed: number;
  startingPlayer: PlayerId;
  skipMulligans: boolean;
  decks: Matchup;
  actions: Action[];
}

export interface LlmRecord extends LlmDecision {
  turn: number;
  step: Step;
  decision: Exclude<PendingDecision['kind'], 'gameOver'>;
}

interface LlmTurn {
  state: GameState;
  started: number;
  abort: AbortController;
  decision: LlmDecision | null;
}

interface AutomaticAction {
  action: Action;
  delay: number;
  decision?: LlmDecision;
}

const DEFAULT_MATCHUP: Matchup = [DEFAULT_DECK_ID, DEFAULT_DECK_ID];
const CLASSIC_OPPONENT: OpponentSetup = { kind: 'classic' };

export const DEFAULT_AI_DELAY_MS = 650;

type Listener = () => void;

const MAX_LOG = 400;
const MAX_FX = 60;
const MAX_FX_SPEED = 8;
const MAX_LLM_RECORDS = 100;
const MAX_OPPONENT_LOG = 60;
const MAX_LLM_THOUGHTS = 20;

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
  opponent: OpponentSetup;
  llm: LlmPlayer | null;
  llmRecords: LlmRecord[] = [];
  private endTurnFor: number | null = null;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private logId = 0;
  private replay: Replay;
  private disposed = false;
  private lastCues: FxCue[] = [];
  private readonly llmFactory: LlmFactory | null;
  private llmTurn: LlmTurn | null = null;
  private opponentLog: string[] = [];
  private llmThoughts: string[] = [];

  constructor(options: ControllerOptions = {}) {
    this.human = options.human ?? 0;
    this.aiDelayMs = options.aiDelayMs ?? DEFAULT_AI_DELAY_MS;
    this.fxSpeed = fxSpeedFrom(options.fxSpeed ?? 1);
    this.autoPass = options.autoPass ?? true;
    this.autoplay = options.autoplay ?? false;
    this.llmFactory = options.llmFactory ?? null;
    this.opponent = options.opponent ?? CLASSIC_OPPONENT;
    this.llm = this.createLlm(this.opponent);
    this.decks = [...(options.decks ?? DEFAULT_MATCHUP)];
    const setup = this.setupFrom(options, this.decks);
    this.state = createGame(setup);
    this.replay = this.freshReplay(setup, this.decks);
    this.appendLog(this.state);
    this.recordFx(fxCues(null, this.state));
  }

  get aiSeat(): PlayerId {
    return opponent(this.human);
  }

  get llmThinking(): boolean {
    return this.llmTurn !== null && this.llmTurn.decision === null && this.llmTurn.state === this.state;
  }

  get llmUnavailable(): string | null {
    return this.llm?.unavailable ?? null;
  }

  private createLlm(setup: OpponentSetup): LlmPlayer | null {
    if (setup.kind === 'classic') return null;
    if (!this.llmFactory) throw new Error('this controller has no LLM factory, so it cannot seat an LLM opponent');
    return this.llmFactory(setup);
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
    this.cancelLlm();
    this.setBusy(false);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
    this.cancelLlm();
    this.listeners.clear();
  }

  whenIdle(): Promise<void> {
    if (!this.busy || this.disposed) return Promise.resolve();
    return new Promise((resolve) => {
      const stop = this.subscribe(() => {
        if (this.busy && !this.disposed) return;
        stop();
        resolve();
      });
    });
  }

  newGame(options: ControllerOptions = {}): void {
    this.clearTimer();
    this.cancelLlm();
    if (options.aiDelayMs !== undefined) this.aiDelayMs = options.aiDelayMs;
    if (options.fxSpeed !== undefined) this.fxSpeed = fxSpeedFrom(options.fxSpeed);
    if (options.autoplay !== undefined) this.autoplay = options.autoplay;
    if (options.autoPass !== undefined) this.autoPass = options.autoPass;
    const setupOpponent = options.opponent ?? this.opponent;
    this.llm = this.createLlm(setupOpponent);
    this.opponent = setupOpponent;
    const decks: Matchup = [...(options.decks ?? this.decks ?? DEFAULT_MATCHUP)];
    const setup = this.setupFrom(options, decks);
    this.state = createGame(setup);
    this.decks = decks;
    this.replay = this.freshReplay(setup, decks);
    this.resetSession(true);
  }

  loadScenario(spec: ScenarioSpec): void {
    this.clearTimer();
    this.cancelLlm();
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
    this.cancelLlm();
    this.state = state;
    this.decks = decks;
    this.replay = { ...replay, decks, actions: [...replay.actions] };
    this.resetSession(false);
    return { ok: true, state };
  }

  private resetSession(animateStart: boolean): void {
    this.log = [];
    this.opponentLog = [];
    this.llmThoughts = [];
    this.llmRecords = [];
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

  async llmPrompt(): Promise<Prompt | null> {
    const s = this.state;
    const pending = s.pending;
    if (!pending || pending.kind === 'gameOver' || pending.player !== this.aiSeat) return null;
    const context = this.llmContext();
    const [{ buildPrompt }, { decisionFor }] = await Promise.all([import('../llm/prompt'), import('../llm/decision')]);
    return buildPrompt(s, this.aiSeat, decisionFor(s, this.aiSeat), context);
  }

  private llmContext(): PromptContext {
    return { decks: this.decks, recentEvents: [...this.opponentLog], recentThoughts: [...this.llmThoughts] };
  }

  lastEventText(): string | undefined {
    for (let i = this.log.length - 1; i >= 0; i--) {
      const entry = this.log[i];
      if (entry?.event) return entry.text;
    }
    return undefined;
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
      const next = this.automaticAction();
      if (!next) break;
      const result = this.applyAutomatic(next, false);
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

  setAutoPass(on: boolean): void {
    this.autoPass = on;
    this.notify();
    this.schedule();
  }

  setFxSpeed(speed: number): void {
    this.fxSpeed = fxSpeedFrom(speed);
    this.notify();
    this.schedule();
  }

  private apply(action: Action, reschedule = true, decision?: LlmDecision): ActionResult {
    const result = tryApplyAction(this.state, action);
    if (!result.ok) return result;
    const before = this.state;
    this.state = result.state;
    this.replay.actions.push(action);
    if (decision) this.noteDecision(before, decision);
    this.appendLog(result.state);
    this.recordFx(fxCues(before, result.state));
    if (this.state.turn !== before.turn) this.endTurnFor = null;
    this.notify();
    if (reschedule) this.schedule();
    return result;
  }

  private applyAutomatic(next: AutomaticAction, reschedule: boolean): ActionResult {
    return this.apply(next.action, reschedule, next.decision);
  }

  private noteDecision(s: GameState, decision: LlmDecision): void {
    const note = this.noteFor(decision);
    if (note) this.appendNote(note);
    if (decision.source !== 'model' || !decision.reason) return;
    this.llmThoughts.push(thoughtLine(s, this.aiSeat, decision.reason));
    if (this.llmThoughts.length > MAX_LLM_THOUGHTS) this.llmThoughts.shift();
  }

  private noteFor(decision: LlmDecision): string | undefined {
    const name = this.state.players[this.aiSeat].name;
    if (decision.source === 'model') return decision.reason ? `${name} thinks: ${decision.reason}` : undefined;
    if (decision.source !== 'fallback') return undefined;
    return this.llmUnavailable
      ? `The LLM is unavailable (${this.llmUnavailable}): the classic AI plays the rest of this game.`
      : `The LLM could not decide (${decision.error ?? 'unknown error'}): the classic AI made this move.`;
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

  private appendNote(text: string): void {
    this.logId += 1;
    this.log.push({ id: this.logId, turn: this.state.turn, text, parts: [text], event: null });
  }

  private appendLog(state: GameState): void {
    for (const event of state.events) {
      if (event.t === 'draw' && state.turn === 0) continue;
      const parts = describeEventParts(state, event, this.human);
      if (!parts) continue;
      this.logId += 1;
      this.log.push({ id: this.logId, turn: state.turn, text: plainText(parts), parts, event });
    }
    if (this.log.length > MAX_LOG) this.log = this.log.slice(-MAX_LOG);
    this.opponentLog.push(...eventLines(state, this.aiSeat));
    if (this.opponentLog.length > MAX_OPPONENT_LOG) this.opponentLog = this.opponentLog.slice(-MAX_OPPONENT_LOG);
  }

  private isLlmSeat(player: PlayerId): boolean {
    return this.llm !== null && !this.llm.unavailable && player === this.aiSeat;
  }

  private automaticAction(): AutomaticAction | null {
    const s = this.state;
    const pending = s.pending;
    if (!pending || pending.kind === 'gameOver') return null;
    const humanDecides = pending.player === this.human && !this.autoplay;
    if (!humanDecides) {
      const answered = this.llmAnswer();
      if (answered) return answered;
      if (this.isLlmSeat(pending.player)) {
        const forced = forcedAction(s);
        return forced ? { action: forced, delay: this.delayFor(forced) } : null;
      }
      const action = chooseAction(s, pending.player);
      return { action, delay: this.delayFor(action) };
    }
    const endTurnRequested = this.endTurnFor === s.turn && s.activePlayer === this.human;
    if (pending.kind === 'declareAttackers' && endTurnRequested) {
      return { action: { type: 'declareAttackers', player: this.human, attackers: [] }, delay: this.holdMs() };
    }
    if (pending.kind === 'priority' && autoPassReason(s, this.human, { endTurnRequested, autoPass: this.autoPass })) {
      const opponentsSpell = s.stack.length > 0 && s.stack.at(-1)?.controller !== this.human;
      return { action: { type: 'pass', player: this.human }, delay: Math.max(opponentsSpell ? this.aiDelayMs * 1.4 : 0, this.holdMs()) };
    }
    return null;
  }

  private llmAnswer(): AutomaticAction | null {
    const turn = this.llmTurn;
    if (!turn || turn.state !== this.state || !turn.decision) return null;
    const thought = Date.now() - turn.started;
    return { action: turn.decision.action, delay: Math.max(0, this.delayFor(turn.decision.action) - thought), decision: turn.decision };
  }

  private askLlm(): void {
    const s = this.state;
    const pending = s.pending;
    const llm = this.llm;
    if (!llm || !pending || pending.kind === 'gameOver' || this.llmTurn?.state === s) return;
    this.cancelLlm();
    const turn: LlmTurn = { state: s, started: Date.now(), abort: new AbortController(), decision: null };
    this.llmTurn = turn;
    const player = pending.player;
    this.notify();
    llm
      .decide(s, player, { signal: turn.abort.signal, ...this.llmContext() })
      .catch((error: unknown): LlmDecision | null => {
        if (turn.abort.signal.aborted) return null;
        return {
          action: chooseAction(s, player),
          source: 'fallback',
          model: llm.model,
          attempts: 0,
          ms: Date.now() - turn.started,
          error: error instanceof Error ? error.message : String(error),
        };
      })
      .then((decision) => {
        if (!decision || this.llmTurn !== turn || this.disposed) return;
        turn.decision = decision;
        this.recordLlm(s, pending.kind, decision);
        this.schedule();
      });
  }

  private recordLlm(s: GameState, kind: LlmRecord['decision'], decision: LlmDecision): void {
    this.llmRecords.push({ ...decision, turn: s.turn, step: s.step, decision: kind });
    if (this.llmRecords.length > MAX_LLM_RECORDS) this.llmRecords.shift();
  }

  private cancelLlm(): void {
    const turn = this.llmTurn;
    this.llmTurn = null;
    if (turn && !turn.decision) turn.abort.abort();
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
    if (this.llmTurn && this.llmTurn.state !== this.state) this.cancelLlm();
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
      this.timer = setTimeout(() => this.runScheduled(next), next.delay);
      return;
    }
    this.setBusy(true);
    this.timer = setTimeout(() => {
      this.timer = null;
      const next = this.automaticAction();
      if (next) this.timer = setTimeout(() => this.runScheduled(next), next.delay);
      else this.askLlm();
    }, 0);
  }

  private runScheduled(next: AutomaticAction): void {
    this.timer = null;
    const result = this.applyAutomatic(next, true);
    if (!result.ok) {
      console.error('Automatic action rejected', result.error, next.action);
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
