import { chooseAction } from '../src/ai';
import {
  DECK_LIST,
  applyAction,
  checkInvariants,
  createGame,
  describeEvent,
  describeState,
  getLegalActions,
  hasDeck,
  type Action,
  type GameState,
  type PlayerId,
} from '../src/engine';

type BotKind = 'ai' | 'random';
type Matchup = [string, string];

interface Options {
  games: number;
  seed: number;
  bots: [BotKind, BotKind];
  decks: [string, string];
  quiet: boolean;
  json: boolean;
  log: number | null;
  maxActions: number;
}

const ALL = 'all';

function parseArgs(argv: string[]): Options {
  const options: Options = {
    games: 50,
    seed: 1,
    bots: ['ai', 'ai'],
    decks: [ALL, ALL],
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
    else if (arg === '--decks') options.decks = parseDecks(next());
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--log') options.log = Number(next());
    else if (arg === '--help') {
      console.log(
        'Usage: npm run sim -- [--games N] [--seed S] [--p0 ai|random] [--p1 ai|random] [--decks all|DECK|DECK,DECK] [--quiet] [--json] [--log SEED]',
      );
      process.exit(0);
    } else throw new Error(`Unknown option ${arg}`);
  }
  return options;
}

function parseBot(value: string): BotKind {
  if (value !== 'ai' && value !== 'random') throw new Error(`Unknown bot "${value}" (use ai or random)`);
  return value;
}

function parseDecks(value: string): [string, string] {
  const [first = ALL, second = first] = value.split(',');
  for (const deck of [first, second]) {
    if (deck !== ALL && !hasDeck(deck)) {
      throw new Error(`Unknown deck "${deck}" (use ${ALL} or one of ${DECK_LIST.map((d) => d.id).join(', ')})`);
    }
  }
  return [first, second];
}

function matchups(decks: [string, string]): Matchup[] {
  const ids = (deck: string): string[] => (deck === ALL ? DECK_LIST.map((d) => d.id) : [deck]);
  return ids(decks[0]).flatMap((a) => ids(decks[1]).map((b): Matchup => [a, b]));
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
  decks: Matchup;
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

function playGame(seed: number, decks: Matchup, options: Options, log?: string[]): GameResult {
  let s = createGame({ seed, players: [{ deck: decks[0] }, { deck: decks[1] }] });
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
      decks,
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
    decks,
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

function deckStats(results: GameResult[]): Record<string, { games: number; wins: number; winRate: number }> {
  const stats: Record<string, { games: number; wins: number; winRate: number }> = {};
  for (const deck of DECK_LIST) {
    const games = results.filter((r) => r.decks[0] !== r.decks[1] && r.decks.includes(deck.id));
    if (games.length === 0) continue;
    const wins = games.filter((r) => r.winner !== null && r.decks[r.winner] === deck.id).length;
    stats[deck.id] = { games: games.length, wins, winRate: +(wins / games.length).toFixed(2) };
  }
  return stats;
}

function matchupStats(results: GameResult[]): Record<string, string> {
  const stats: Record<string, string> = {};
  const pairs = new Map<string, Matchup>();
  for (const result of results) {
    const pair = [...result.decks].sort() as Matchup;
    pairs.set(pair.join(' vs '), pair);
  }
  for (const [label, [a, b]] of pairs) {
    const games = results.filter((r) => [...r.decks].sort().join(' vs ') === label);
    const winsOf = (deck: string): number => games.filter((r) => r.winner !== null && r.decks[r.winner] === deck).length;
    const draws = games.filter((r) => r.winner === null).length;
    stats[label] = a === b ? `${games.length} games` : `${winsOf(a)}-${winsOf(b)}${draws ? ` (${draws} draws)` : ''}`;
  }
  return stats;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const pairs = matchups(options.decks);
  if (options.log !== null) {
    const lines: string[] = [];
    const result = playGame(options.log, pairs[0] as Matchup, options, lines);
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
    const result = playGame(options.seed + i, pairs[i % pairs.length] as Matchup, options);
    results.push(result);
    if (!options.quiet && !options.json) {
      const outcome = result.error ? 'ERROR' : result.winner === null ? 'draw' : `p${result.winner} (${result.reason})`;
      console.log(`seed ${result.seed} (${result.decks.join(' vs ')}): ${outcome} in ${result.turns} turns`);
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
    decks: deckStats(finished),
    matchups: matchupStats(finished),
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
