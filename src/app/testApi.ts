import { chooseAction } from '../ai';
import {
  DECK_LIST,
  allCardDefs,
  applyAction,
  checkInvariants,
  createGame,
  createScenario,
  deckSize,
  describeState,
  getCardDef,
  getLegalActions,
  rulesText,
  tryApplyAction,
  typeLine,
  type Action,
  type GameState,
  type PendingDecision,
  type ScenarioSpec,
} from '../engine';
import { CHECKS, runChecks, type CheckResult } from './checks';
import type { ControllerOptions, GameController, Matchup, Replay } from './controller';

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

export const API_VERSION = '1.1';

export interface DeckSummary {
  id: string;
  name: string;
  colors: string[];
  description: string;
  size: number;
  cards: { id: string; name: string; count: number }[];
}

export type ApiResult = { ok: true; pending: PendingDecision | null } | { ok: false; error: string };

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
  playToEnd(): PendingDecision | null;
  setAiDelay(ms: number): void;
  setAutoplay(on: boolean): void;
  log(): string[];
  cards(): { id: string; name: string; type: string; cost: string | null; text: string[] }[];
  decks(): DeckSummary[];
  matchup(): Matchup | null;
  checks(): { id: string; title: string }[];
  runChecks(ids?: string[]): CheckResult[];
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
  settle()              run the AI now instead of waiting for its animations
  playToEnd()           let the AI finish the game for both seats
  newGame({seed, skipMulligans, startingPlayer, aiDelayMs, decks: ['dawntide', 'duskmire']})
                        decks are [yours, AI's]; omitted, the current decks are kept
  decks()               the decks you can pick: id, name, colors, card list
  matchup()             deck ids in play, [yours, AI's] (null for a loaded scenario)
  loadScenario(spec)    build a position: {activePlayer, step, players:[{hand, battlefield, library, life}, {...}]}
  replay() / loadReplay(replay)
  setAiDelay(ms), setAutoplay(on), log(), cards()
  checks() / runChecks(ids?)   built-in feature checks (docs/VERIFICATION.md), [] of failures = healthy
  engine.*              pure engine: createScenario, applyAction, play(state, actions), chooseAction...`;

function toApiResult(result: { ok: true; state: GameState } | { ok: false; error: string }): ApiResult {
  return result.ok ? { ok: true, pending: result.state.pending } : result;
}

export function createTestApi(controller: GameController, showGame: () => void): ManaDuelApi {
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
      controller.newGame(options);
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
    playToEnd: () => {
      const autoplay = controller.autoplay;
      controller.autoplay = true;
      controller.settle();
      controller.setAutoplay(autoplay);
      return structuredClone(controller.state.pending);
    },
    setAiDelay: (ms) => controller.setAiDelay(ms),
    setAutoplay: (on) => controller.setAutoplay(on),
    log: () => controller.log.map((entry) => entry.text),
    cards: () =>
      allCardDefs()
        .filter((def) => !def.id.startsWith('test_'))
        .map((def) => ({ id: def.id, name: def.name, type: typeLine(def), cost: def.cost ?? null, text: rulesText(def) })),
    decks: () =>
      DECK_LIST.map((deck) => ({
        id: deck.id,
        name: deck.name,
        colors: [...deck.colors],
        description: deck.description,
        size: deckSize(deck),
        cards: deck.cards.map((entry) => ({ id: entry.card, name: getCardDef(entry.card).name, count: entry.count })),
      })),
    matchup: () => (controller.decks ? [...controller.decks] : null),
    checks: () => CHECKS.map((check) => ({ id: check.id, title: check.title })),
    runChecks: (ids) => runChecks(ids),
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
