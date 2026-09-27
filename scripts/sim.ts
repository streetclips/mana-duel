import { chooseAction } from '../src/ai';
import {
  applyAction,
  checkInvariants,
  createGame,
  describeEvent,
  describeState,
  getLegalActions,
  type Action,
  type GameState,
  type PlayerId,
} from '../src/engine';

type BotKind = 'ai' | 'random';

interface Options {
  games: number;
  seed: number;
  bots: [BotKind, BotKind];
  quiet: boolean;
  json: boolean;
  log: number | null;
  maxActions: number;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    games: 50,
    seed: 1,
    bots: ['ai', 'ai'],
    quiet: false,
    json: false,
    log: null,
    maxActions: 20_000,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = (): string => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    if (arg === '--games') options.games = Number(next());
    else if (arg === '--seed') options.seed = Number(next());
    else if (arg === '--p0') options.bots[0] = parseBot(next());
    else if (arg === '--p1') options.bots[1] = parseBot(next());
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--log') options.log = Number(next());
    else if (arg === '--help') {
      console.log('Usage: npm run sim -- [--games N] [--seed S] [--p0 ai|random] [--p1 ai|random] [--quiet] [--json] [--log SEED]');
      process.exit(0);
    } else throw new Error(`Unknown option ${arg}`);
  }
  return options;
}

function parseBot(value: string): BotKind {
  if (value !== 'ai' && value !== 'random') throw new Error(`Unknown bot "${value}" (use ai or random)`);
  return value;
}

function lcg(seed: number): () => number {
  let r = seed >>> 0 || 1;
  return () => {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    return r / 4294967296;
  };
}

function randomAction(s: GameState, rand: () => number): Action {
  const legal = getLegalActions(s, { limit: 128 });
  const active = legal.filter((action) => action.type !== 'pass');
  const pool = active.length > 0 && rand() < 0.7 ? active : legal;
  const action = pool[Math.floor(rand() * pool.length)];
  if (!action) throw new Error(`No legal action for ${s.pending?.kind}`);
  return action;
}

interface GameResult {
  seed: number;
  winner: PlayerId | null;
  reason: string;
  startingPlayer: PlayerId;
  turns: number;
  actions: number;
  maxDecisionMs: number;
  decisionMs: number;
  decisions: number;
  error?: string;
}

function playGame(seed: number, options: Options, log?: string[]): GameResult {
  let s = createGame({ seed });
  const rand = lcg(seed);
  let actions = 0;
  let maxDecisionMs = 0;
  let decisionMs = 0;
  let decisions = 0;
  const record = (state: GameState): void => {
    if (!log) return;
    for (const event of state.events) {
      if (event.t === 'draw' && state.turn === 0) continue;
      const line = describeEvent(state, event, 0);
      if (line) log.push(line);
    }
  };
  record(s);
  try {
    while (s.pending && s.pending.kind !== 'gameOver') {
      if (actions >= options.maxActions) throw new Error('game did not finish');
      const player = s.pending.player;
      const started = performance.now();
      const action = options.bots[player] === 'ai' ? chooseAction(s, player) : randomAction(s, rand);
      if (options.bots[player] === 'ai') {
        const elapsed = performance.now() - started;
        decisionMs += elapsed;
        decisions += 1;
        maxDecisionMs = Math.max(maxDecisionMs, elapsed);
      }
      s = applyAction(s, action);
      actions += 1;
      record(s);
      const problems = checkInvariants(s);
      if (problems.length > 0) throw new Error(`invariant violated: ${problems.join('; ')}`);
    }
  } catch (error) {
    return {
      seed,
      winner: null,
      reason: 'error',
      startingPlayer: s.startingPlayer,
      turns: s.turn,
      actions,
      maxDecisionMs,
      decisionMs,
      decisions,
      error: `${(error as Error).message}\n${describeState(s, 0, true)}`,
    };
  }
  const pending = s.pending;
  return {
    seed,
    winner: pending?.kind === 'gameOver' ? pending.winner : null,
    reason: pending?.kind === 'gameOver' ? pending.reason : 'unknown',
    startingPlayer: s.startingPlayer,
    turns: s.turn,
    actions,
    maxDecisionMs,
    decisionMs,
    decisions,
  };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (options.log !== null) {
    const lines: string[] = [];
    const result = playGame(options.log, options, lines);
    console.log(lines.join('\n'));
    console.log(`\nResult: ${JSON.stringify({ ...result, error: undefined })}`);
    if (result.error) {
      console.error(result.error);
      process.exit(1);
    }
    return;
  }

  const results: GameResult[] = [];
  const started = Date.now();
  for (let i = 0; i < options.games; i++) {
    const result = playGame(options.seed + i, options);
    results.push(result);
    if (!options.quiet && !options.json) {
      const outcome = result.error ? 'ERROR' : result.winner === null ? 'draw' : `p${result.winner} (${result.reason})`;
      console.log(`seed ${result.seed}: ${outcome} in ${result.turns} turns`);
    }
  }

  const finished = results.filter((result) => !result.error);
  const errors = results.filter((result) => result.error);
  const count = (predicate: (result: GameResult) => boolean): number => finished.filter(predicate).length;
  const decisions = results.reduce((sum, result) => sum + result.decisions, 0);
  const summary = {
    games: results.length,
    bots: { p0: options.bots[0], p1: options.bots[1] },
    wins: { p0: count((r) => r.winner === 0), p1: count((r) => r.winner === 1), draws: count((r) => r.winner === null) },
    startingPlayerWins: count((r) => r.winner === r.startingPlayer),
    reasons: Object.fromEntries(
      [...new Set(finished.map((r) => r.reason))].map((reason) => [reason, count((r) => r.reason === reason)]),
    ),
    avgTurns: finished.length ? +(finished.reduce((sum, r) => sum + r.turns, 0) / finished.length).toFixed(1) : 0,
    avgDecisionMs: decisions ? +(results.reduce((sum, r) => sum + r.decisionMs, 0) / decisions).toFixed(2) : 0,
    maxDecisionMs: +Math.max(0, ...results.map((r) => r.maxDecisionMs)).toFixed(1),
    errors: errors.length,
    seconds: (Date.now() - started) / 1000,
  };

  if (options.json) console.log(JSON.stringify({ summary, errors: errors.map((e) => ({ seed: e.seed, error: e.error })) }, null, 2));
  else {
    console.log(JSON.stringify(summary, null, 2));
    for (const error of errors) console.error(`\nseed ${error.seed} failed:\n${error.error}`);
  }
  if (errors.length > 0) process.exit(1);
}

main();
