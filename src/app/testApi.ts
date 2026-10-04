import { chooseAction } from '../ai';
import {
  DECK_LIST,
  DEFAULT_DECK_ID,
  allCardDefs,
  applyAction,
  checkInvariants,
  createGame,
  createScenario,
  deckSize,
  describeState,
  getCardDef,
  getDeck,
  getLegalActions,
  rulesText,
  tryApplyAction,
  typeLine,
  type Action,
  type DeckDef,
  type GameState,
  type PendingDecision,
  type ScenarioSpec,
} from '../engine';
import {
  GameAudio,
  type AudioLevel,
  type AudioState,
  type PlayedSound,
  type RenderResult,
  type RenderTarget,
  type SoundId,
  type ThemeSummary,
} from '../audio';
import type { Prompt } from '../llm/prompt';
import { CHECKS, runChecks, type CheckResult } from './checks';
import type { ControllerOptions, GameController, LlmRecord, OpponentSetup, Replay } from './controller';
import type { DeckDraft } from './deckBuilding';
import { DeckLibrary } from './deckLibrary';
import type { ExpeditionRun, RelicId } from './expedition';
import { ExpeditionController } from './expeditionController';
import type { FxCue } from './fx';

export interface EngineApi {
  createGame: typeof createGame;
  createScenario: typeof createScenario;
  applyAction: typeof applyAction;
  tryApplyAction: typeof tryApplyAction;
  getLegalActions: typeof getLegalActions;
  describeState: typeof describeState;
  checkInvariants: typeof checkInvariants;
  chooseAction: typeof chooseAction;
  play(state: GameState, actions: Action[]): GameState;
}

export const API_VERSION = '1.7';

export interface DeckSummary {
  id: string;
  name: string;
  colors: string[];
  description: string;
  size: number;
  custom: boolean;
  playable: boolean;
  cards: { id: string; name: string; count: number }[];
}

export interface DeckInput {
  id?: string;
  name: string;
  featured?: string;
  cards: { card: string; count: number }[];
}

export type DeckResult = { ok: true; deck: DeckSummary; problems: string[] } | { ok: false; error: string };

export type ApiResult = { ok: true; pending: PendingDecision | null } | { ok: false; error: string };

export type FxRecord = FxCue & { seq: number };

export interface UiHooks {
  freezeFx(progress: number | null): Promise<string[]>;
  audio?: GameAudio;
  expedition?: ExpeditionController;
  showExpedition?: () => void;
  library?: DeckLibrary;
}

export type ExpeditionResult = { ok: true; run: ExpeditionRun | null } | { ok: false; error: string };

export interface ExpeditionApi {
  state(): ExpeditionRun | null;
  start(options?: { deck?: string; seed?: number }): ExpeditionResult;
  fight(): ExpeditionResult;
  chooseCard(card: string | null): ExpeditionResult;
  swapCard(out: string | null): ExpeditionResult;
  chooseRelic(relic: RelicId): ExpeditionResult;
  abandon(): void;
  show(): void;
}

const NO_UI: UiHooks = { freezeFx: async () => [] };

export interface AudioApi {
  state(): AudioState;
  played(since?: number): PlayedSound[];
  sounds(): SoundId[];
  themes(): ThemeSummary[];
  level(): AudioLevel;
  render(target: RenderTarget): Promise<RenderResult>;
  setMusic(on: boolean): void;
  setSfx(on: boolean): void;
  setVolume(volume: number): void;
  unlock(): Promise<AudioState>;
}

function audioApi(audio: GameAudio): AudioApi {
  return {
    state: () => audio.state(),
    played: (since) => audio.played(since),
    sounds: () => audio.sounds(),
    themes: () => audio.themes(),
    level: () => audio.level(),
    render: (target) => audio.render(target),
    setMusic: (on) => audio.setMusic(on),
    setSfx: (on) => audio.setSfx(on),
    setVolume: (volume) => audio.setVolume(volume),
    unlock: () => audio.unlock(),
  };
}

export interface ManaDuelApi {
  version: string;
  help(): string;
  state(): GameState;
  describe(revealAll?: boolean): string;
  pending(): PendingDecision | null;
  legalActions(): Action[];
  dispatch(action: Action): ApiResult;
  pass(): ApiResult;
  endTurn(): ApiResult;
  concede(): ApiResult;
  newGame(options?: ControllerOptions): void;
  loadScenario(spec: ScenarioSpec): void;
  loadReplay(replay: Replay): ApiResult;
  replay(): Replay;
  settle(): PendingDecision | null;
  idle(): Promise<PendingDecision | null>;
  playToEnd(): PendingDecision | null;
  setAiDelay(ms: number): void;
  setAutoplay(on: boolean): void;
  setAutoPass(on: boolean): void;
  fx(since?: number): FxRecord[];
  fxSeq(): number;
  setFxSpeed(speed: number): void;
  freezeFx(progress?: number | null): Promise<string[]>;
  log(): string[];
  cards(): { id: string; name: string; type: string; cost: string | null; text: string[]; token: boolean }[];
  decks(): DeckSummary[];
  saveDeck(deck: DeckInput): DeckResult;
  deleteDeck(id: string): boolean;
  matchup(): [string, string] | null;
  opponent(): OpponentSetup;
  llmDecisions(): LlmRecord[];
  llmPrompt(): Promise<Prompt | null>;
  checks(): { id: string; title: string }[];
  runChecks(ids?: string[]): CheckResult[];
  audio: AudioApi;
  expedition: ExpeditionApi;
  engine: EngineApi;
}

const HELP = `window.manaDuel — automation API
  state()               full GameState (JSON)
  describe(reveal?)     readable snapshot
  pending()             what the game waits for: {kind, player, ...}
  legalActions()        legal actions for you (player 0)
  dispatch(action)      e.g. {type:'playLand', player:0, card:'c12'}
                        {type:'cast', player:0, card:'c7', targets:[{player:1}] | [{card:'c50'}]}
                        {type:'declareAttackers', player:0, attackers:['c9']}
                        {type:'declareBlockers', player:0, blocks:[{blocker:'c9', attacker:'c50'}]}
                        {type:'pass', player:0}, {type:'keep', player:0}, {type:'mulligan', player:0}
  pass(), endTurn(), concede()
  settle()              run the AI now instead of waiting for its animations; stops where an LLM must answer
  await idle()          resolves once the game waits for you or is over (LLM answers included)
  playToEnd()           let the AI finish the game for both seats (an LLM seat: setAutoplay(true), await idle())
  newGame({seed, skipMulligans, startingPlayer, aiDelayMs, autoPass, decks: ['dawntide', 'duskmire'],
           opponent: {kind: 'llm', model: 'openai/gpt-6-luna'} | {kind: 'classic'}})
                        decks are [yours, AI's]; omitted, the current decks and opponent are kept
  opponent()            who plays the AI seat: {kind: 'classic'} or {kind: 'llm', model}
  llmDecisions()        the LLM's recent decisions: action, source (model | fallback), reason, error, ms, usage
  await llmPrompt()     the exact {system, prompt} the LLM gets for the AI's pending decision, else null
  decks()               the decks you can pick: id, name, colors, card list; custom ones (yours) with playable
  saveDeck({id?, name, cards: [{card, count}], featured?})   saves one of your decks; {ok, deck, problems}
  deleteDeck(id)        removes one of your decks
  matchup()             deck ids in play, [yours, AI's] (null for a loaded scenario)
  loadScenario(spec)    build a position: {activePlayer, step, players:[{hand, battlefield, library, life}, {...}]}
  replay() / loadReplay(replay)
  setAiDelay(ms), setAutoplay(on), log(), cards()
  setAutoPass(on)       off: you pass yourself wherever you could act, as the LLM does (also ?autoPass=off);
                        a window with nothing to do and End turn still pass on their own
  fx(since?)            animation cues of recent actions, oldest first: {seq, kind, card | player, ...}
  fxSeq()               seq of the latest action: read it before acting, then fx(seq) lists only newer cues
  setFxSpeed(speed)     animation speed: 1 normal, 0.25 slow motion, 0 off (also ?fx=off|slow|<speed>)
  freezeFx(progress?)   for a screenshot: call it with the action, holds the running animations and
                        transitions at 0..1 of their length (default 0.5), lists the fx ones; null resumes
  checks() / runChecks(ids?)   built-in feature checks (docs/VERIFICATION.md), [] of failures = healthy
  audio.state()         music and sound effects: {context: none | running | suspended, music: {on, theme, mood,
                        heard, bar, notes}, sfx: {on, played, dropped}}; silent until your first tap or key
  audio.played(since?)  sounds started for recent actions, oldest first: {seq, sound, at, color}; since as in fx()
  audio.level()         {rms, peak} of what plays now; await audio.render(sound | {theme, mood, bars}) renders
                        offline: {seconds, peak, rms, tail, finite}
  audio.setMusic(on), audio.setSfx(on), audio.setVolume(0..1)   also ?music=on|off&sfx=on|off
  audio.unlock(), audio.sounds(), audio.themes()   (docs/AUDIO.md)
  expedition.state()    the Expedition run: base deck, deck, relics, rivals, wins, stage, saved duel; null without one
  expedition.start({deck, seed})  a new run from a deck id (default: Emberwild), shown on its screen
  expedition.fight()    the run's next duel, or the saved one where it was, shown in the game
  expedition.chooseCard(id | null), swapCard(id | null), chooseRelic(id), abandon(), show()
                        each answer is {ok, run} or {ok: false, error}
  engine.*              pure engine: createScenario, applyAction, play(state, actions), chooseAction...`;

function toApiResult(result: { ok: true; state: GameState } | { ok: false; error: string }): ApiResult {
  return result.ok ? { ok: true, pending: result.state.pending } : result;
}

function summary(deck: DeckDef, custom: boolean, problems: string[]): DeckSummary {
  return {
    id: deck.id,
    name: deck.name,
    colors: [...deck.colors],
    description: deck.description,
    size: deckSize(deck),
    custom,
    playable: problems.length === 0,
    cards: deck.cards.map((entry) => ({ id: entry.card, name: getCardDef(entry.card).name, count: entry.count })),
  };
}

function withCustomDecks(options: ControllerOptions, library: DeckLibrary): ControllerOptions {
  if (!options.decks) return options;
  const [mine, theirs] = options.decks.map((spec) => (typeof spec === 'string' ? (library.get(spec) ?? spec) : spec));
  return mine !== undefined && theirs !== undefined ? { ...options, decks: [mine, theirs] } : options;
}

function expeditionApi(expedition: ExpeditionController, show: () => void, showGame: () => void): ExpeditionApi {
  const attempt = (act: () => void): ExpeditionResult => {
    try {
      act();
      return { ok: true, run: structuredClone(expedition.run) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
  return {
    state: () => structuredClone(expedition.run),
    start: (options = {}) =>
      attempt(() => {
        expedition.start(getDeck(options.deck ?? DEFAULT_DECK_ID), options.seed);
        show();
      }),
    fight: () =>
      attempt(() => {
        expedition.fight();
        showGame();
      }),
    chooseCard: (card) => attempt(() => expedition.chooseCard(card)),
    swapCard: (out) => attempt(() => expedition.swapCard(out)),
    chooseRelic: (relic) => attempt(() => expedition.chooseRelic(relic)),
    abandon: () => expedition.abandon(),
    show,
  };
}

export function createTestApi(controller: GameController, showGame: () => void, ui: UiHooks = NO_UI): ManaDuelApi {
  const library = ui.library ?? new DeckLibrary();
  return {
    version: API_VERSION,
    help: () => HELP,
    state: () => structuredClone(controller.state),
    describe: (revealAll = false) => describeState(controller.state, controller.human, revealAll),
    pending: () => structuredClone(controller.state.pending),
    legalActions: () => structuredClone(controller.legalActions()),
    dispatch: (action) => toApiResult(controller.dispatch(action)),
    pass: () => toApiResult(controller.dispatch({ type: 'pass', player: controller.human })),
    endTurn: () => toApiResult(controller.endTurn()),
    concede: () => toApiResult(controller.concede()),
    newGame: (options = {}) => {
      controller.newGame(withCustomDecks(options, library));
      showGame();
    },
    loadScenario: (spec) => {
      controller.loadScenario(spec);
      showGame();
    },
    loadReplay: (replay) => {
      const result = toApiResult(controller.loadReplay(replay));
      showGame();
      return result;
    },
    replay: () => controller.getReplay(),
    settle: () => {
      controller.settle();
      return structuredClone(controller.state.pending);
    },
    idle: async () => {
      controller.settle();
      await controller.whenIdle();
      return structuredClone(controller.state.pending);
    },
    playToEnd: () => {
      const autoplay = controller.autoplay;
      controller.autoplay = true;
      controller.settle();
      controller.setAutoplay(autoplay);
      return structuredClone(controller.state.pending);
    },
    setAiDelay: (ms) => controller.setAiDelay(ms),
    setAutoplay: (on) => controller.setAutoplay(on),
    setAutoPass: (on) => controller.setAutoPass(on),
    fx: (since = 0) =>
      controller.fx
        .filter((batch) => batch.seq > since)
        .flatMap((batch) => batch.cues.map((cue) => ({ seq: batch.seq, ...structuredClone(cue) }))),
    fxSeq: () => controller.fxSeq,
    setFxSpeed: (speed) => controller.setFxSpeed(speed),
    freezeFx: (progress = 0.5) => ui.freezeFx(progress),
    log: () => controller.log.map((entry) => entry.text),
    cards: () =>
      allCardDefs()
        .filter((def) => !def.id.startsWith('test_'))
        .map((def) => ({ id: def.id, name: def.name, type: typeLine(def), cost: def.cost ?? null, text: rulesText(def), token: def.token === true })),
    decks: () => [...DECK_LIST.map((deck) => summary(deck, false, [])), ...library.decks.map((deck) => summary(deck, true, library.problems(deck)))],
    saveDeck: (input) => {
      try {
        const draft: DeckDraft = { id: input.id ?? null, name: input.name, featured: input.featured ?? null, cards: input.cards.map((entry) => ({ ...entry })) };
        const deck = library.save(draft);
        const problems = library.problems(deck);
        return { ok: true, deck: summary(deck, true, problems), problems };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    deleteDeck: (id) => {
      if (!library.get(id)) return false;
      library.remove(id);
      return true;
    },
    matchup: () => controller.matchupIds(),
    opponent: () => structuredClone(controller.opponent),
    llmDecisions: () => structuredClone(controller.llmRecords),
    llmPrompt: () => controller.llmPrompt(),
    checks: () => CHECKS.map((check) => ({ id: check.id, title: check.title })),
    runChecks: (ids) => runChecks(ids),
    audio: audioApi(ui.audio ?? new GameAudio({ createContext: null })),
    expedition: expeditionApi(ui.expedition ?? new ExpeditionController(controller), ui.showExpedition ?? (() => undefined), showGame),
    engine: {
      createGame,
      createScenario,
      applyAction,
      tryApplyAction,
      getLegalActions,
      describeState,
      checkInvariants,
      chooseAction,
      play: (state, actions) => actions.reduce((current, action) => applyAction(current, action), state),
    },
  };
}
