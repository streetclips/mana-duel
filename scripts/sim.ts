import { fork } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chooseAction } from '../src/ai';
import { DUELS, rivalAt, rivalSeat, shuffledRelicPools } from '../src/app/expedition';
import { RELICS, duelPerks, isRelicId, relicOf, startsEveryDuel, type RelicId, type SeatRelics } from '../src/app/relics';
import {
  DECK_LIST,
  applyAction,
  checkInvariants,
  createGame,
  describeEvent,
  describeState,
  getLegalActions,
  hasCardDef,
  hasDeck,
  forcedAction,
  getDeck,
  normalizeSeed,
  type Action,
  type GameState,
  type PlayerId,
  type PlayerSetup,
} from '../src/engine';
import {
  DEFAULT_MODEL,
  createLlmPlayer,
  eventLines,
  isReasoningEffort,
  openRouterModel,
  thoughtLine,
  type LlmPlayer,
  type ReasoningEffort,
} from '../src/llm';

type BotKind = 'ai' | 'random' | 'llm';
type Matchup = [string, string];
type Perks = Pick<PlayerSetup, 'life' | 'openingHand' | 'battlefield'>;
type Relics = [RelicId[], RelicId[]];

interface Options {
  games: number;
  seed: number;
  bots: [BotKind, BotKind];
  decks: [string, string];
  perks: [Perks, Perks];
  relics: Relics;
  duel: number | null;
  quiet: boolean;
  json: boolean;
  log: number | null;
  maxActions: number;
  model: string;
  effort?: ReasoningEffort;
  workers: number;
  shard?: [number, number];
}

const ALL = 'all';

function parseArgs(argv: string[]): Options {
  const options: Options = {
    games: 50,
    seed: 1,
    bots: ['ai', 'ai'],
    decks: [ALL, ALL],
    perks: [{}, {}],
    relics: [[], []],
    duel: null,
    quiet: false,
    json: false,
    log: null,
    maxActions: 20_000,
    model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    workers: availableParallelism(),
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
    else if (arg === '--life0' || arg === '--life1') options.perks[seatOf(arg)].life = parseCount(arg, next());
    else if (arg === '--hand0' || arg === '--hand1') options.perks[seatOf(arg)].openingHand = parseCount(arg, next());
    else if (arg === '--start0' || arg === '--start1') options.perks[seatOf(arg)].battlefield = parseCards(next());
    else if (arg === '--relics0' || arg === '--relics1') options.relics[seatOf(arg)] = parseRelics(next());
    else if (arg === '--duel') options.duel = parseDuel(next());
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--log') options.log = Number(next());
    else if (arg === '--model') options.model = next();
    else if (arg === '--effort') options.effort = parseEffort(next());
    else if (arg === '--workers') options.workers = parseWorkers(next());
    else if (arg === '--shard') options.shard = parseShard(next());
    else if (arg === '--help') {
      console.log(
        'Usage: npm run sim -- [--games N] [--seed S] [--p0 ai|random|llm] [--p1 ai|random|llm] [--model ID] [--effort minimal|low|medium|high] [--decks all|DECK|DECK,DECK] [--life0|--life1 N] [--hand0|--hand1 N] [--start0|--start1 CARD,CARD] [--relics0|--relics1 RELIC,RELIC] [--duel 1-' + DUELS + '] [--workers N] [--quiet] [--json] [--log SEED]\n' +
          'Games without an llm bot run in parallel processes (--workers, one per CPU by default); the results are the same for any number of workers.\n' +
          'A seat can start with other life (--life1 14), another opening hand (--hand1 6) or permanents on the battlefield (--start0 soldier_token), as Expedition rivals and relics do; wins.p0 then reads as the first seat\'s odds.\n' +
          `A seat can also hold Expedition relics, on top of those (--relics1 bell,vigor): ${RELICS.filter((relic) => relic.kind !== 'run').map((relic) => relic.id).join(', ')}.\n` +
          '--duel N makes the second seat the Nth rival of an Expedition, in place of --life1, --hand1 and --start1: its life, hand and relics, drawn from each game\'s seed as a run draws them.\n' +
          'An llm bot asks an OpenRouter model (default ' + DEFAULT_MODEL + ') for every real decision; it needs OPENROUTER_API_KEY.',
      );
      process.exit(0);
    } else throw new Error(`Unknown option ${arg}`);
  }
  return options;
}

function seatOf(arg: string): PlayerId {
  return arg.endsWith('0') ? 0 : 1;
}

function parseCount(arg: string, value: string): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) throw new Error(`Invalid ${arg} "${value}" (use a whole number from 1)`);
  return count;
}

function parseCards(value: string): string[] {
  const cards = value.split(',').filter(Boolean);
  for (const card of cards) if (!hasCardDef(card)) throw new Error(`Unknown card "${card}"`);
  return cards;
}

function parseRelics(value: string): RelicId[] {
  const relics = value.split(',').filter(Boolean);
  for (const relic of relics) {
    if (!isRelicId(relic) || relicOf(relic).kind === 'run') {
      throw new Error(`Unknown relic "${relic}" (use ${RELICS.filter((candidate) => candidate.kind !== 'run').map((candidate) => candidate.id).join(', ')})`);
    }
  }
  return relics as RelicId[];
}

function parseDuel(value: string): number {
  const duel = Number(value);
  if (!Number.isInteger(duel) || duel < 1 || duel > DUELS) throw new Error(`Invalid --duel "${value}" (use a whole number from 1 to ${DUELS})`);
  return duel;
}

function seatRelics(options: Options, seat: PlayerId, deckId: string): SeatRelics {
  const deck = getDeck(deckId);
  return { relics: options.relics[seat], deck: deck.cards, colors: deck.colors, life: options.perks[seat].life, openingHand: options.perks[seat].openingHand };
}

function rivalRelics(options: Options, seed: number, deckId: string): SeatRelics {
  if (options.duel === null) return seatRelics(options, 1, deckId);
  const rival = rivalSeat(rivalAt(options.duel - 1, deckId, shuffledRelicPools({ rng: normalizeSeed(seed) })));
  return { ...rival, relics: [...rival.relics, ...options.relics[1]] };
}

function seatSetups(options: Options, seed: number, decks: Matchup): [PlayerSetup, PlayerSetup] {
  const perks = duelPerks([seatRelics(options, 0, decks[0]), rivalRelics(options, seed, decks[1])]);
  return [0, 1].map((seat) => {
    const base = seat === 1 && options.duel !== null ? {} : options.perks[seat as PlayerId];
    const battlefield = [...(base.battlefield ?? []), ...(perks[seat as PlayerId].battlefield ?? [])];
    return { deck: decks[seat as PlayerId], ...base, ...perks[seat as PlayerId], ...(battlefield.length > 0 ? { battlefield } : {}) };
  }) as [PlayerSetup, PlayerSetup];
}

function startingPlayerOf(options: Options): PlayerId | undefined {
  const first = options.relics.map(startsEveryDuel);
  if (first[0] === first[1]) return undefined;
  return first[0] ? 0 : 1;
}

function parseEffort(value: string): ReasoningEffort {
  if (!isReasoningEffort(value)) throw new Error(`Unknown effort "${value}" (use minimal, low, medium or high)`);
  return value;
}

function parseWorkers(value: string): number {
  const workers = Number(value);
  if (!Number.isInteger(workers) || workers < 1) throw new Error(`Invalid --workers "${value}" (use a whole number from 1)`);
  return workers;
}

function parseShard(value: string): [number, number] {
  const [start, end] = value.split(':').map(Number);
  if (!Number.isInteger(start) || !Number.isInteger(end)) throw new Error(`Invalid --shard "${value}"`);
  return [start as number, end as number];
}

function parseBot(value: string): BotKind {
  if (value !== 'ai' && value !== 'random' && value !== 'llm') throw new Error(`Unknown bot "${value}" (use ai, random or llm)`);
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

interface LlmStats {
  decisions: number;
  fallbacks: number;
  ms: number;
  cost: number;
  errors: string[];
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
  llm: LlmStats;
  error?: string;
}

function llmPlayer(options: Options): LlmPlayer {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('An llm bot needs OPENROUTER_API_KEY in the environment.');
  return createLlmPlayer({ model: openRouterModel({ model: options.model, apiKey, reasoningEffort: options.effort }) });
}

async function playGame(seed: number, decks: Matchup, options: Options, log?: string[]): Promise<GameResult> {
  let s = createGame({ seed, startingPlayer: startingPlayerOf(options), players: seatSetups(options, seed, decks) });
  const rand = lcg(seed);
  const llms = options.bots.map((bot) => (bot === 'llm' ? llmPlayer(options) : null));
  const seen: [string[], string[]] = [[], []];
  const thoughts: [string[], string[]] = [[], []];
  const llm: LlmStats = { decisions: 0, fallbacks: 0, ms: 0, cost: 0, errors: [] };
  let actions = 0;
  let maxDecisionMs = 0;
  let decisionMs = 0;
  let decisions = 0;
  const record = (state: GameState): void => {
    seen[0].push(...eventLines(state, 0));
    seen[1].push(...eventLines(state, 1));
    if (!log) return;
    for (const event of state.events) {
      if (event.t === 'draw' && state.turn === 0) continue;
      const line = describeEvent(state, event, 0);
      if (line) log.push(line);
    }
  };
  const decide = async (player: PlayerId): Promise<Action> => {
    const bot = llms[player];
    if (!bot) return options.bots[player] === 'ai' ? chooseAction(s, player) : randomAction(s, rand);
    const forced = forcedAction(s);
    if (forced) return forced;
    const decision = await bot.decide(s, player, { decks, recentEvents: seen[player], recentThoughts: thoughts[player] });
    llm.decisions += 1;
    llm.ms += decision.ms;
    llm.cost += decision.usage?.cost ?? 0;
    if (decision.source === 'fallback') {
      llm.fallbacks += 1;
      if (decision.error && !llm.errors.includes(decision.error)) llm.errors.push(decision.error);
    }
    if (decision.source === 'model' && decision.reason) thoughts[player].push(thoughtLine(s, player, decision.reason));
    if (log && decision.reason) log.push(`  (p${player} ${bot.model}: ${decision.reason})`);
    return decision.action;
  };
  record(s);
  try {
    while (s.pending && s.pending.kind !== 'gameOver') {
      if (actions >= options.maxActions) throw new Error('game did not finish');
      const player = s.pending.player;
      const started = performance.now();
      const action = await decide(player);
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
      llm,
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
    llm,
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

function llmSummary(options: Options, results: GameResult[]): Record<string, unknown> | undefined {
  if (!options.bots.includes('llm')) return undefined;
  const total = results.reduce((sum, result) => sum + result.llm.decisions, 0);
  return {
    model: options.model,
    effort: options.effort ?? 'default',
    decisions: total,
    fallbacks: results.reduce((sum, result) => sum + result.llm.fallbacks, 0),
    avgMs: total ? Math.round(results.reduce((sum, result) => sum + result.llm.ms, 0) / total) : 0,
    cost: +results.reduce((sum, result) => sum + result.llm.cost, 0).toFixed(5),
    errors: [...new Set(results.flatMap((result) => result.llm.errors))],
  };
}

async function playRange(options: Options, pairs: Matchup[], start: number, end: number, onResult?: (result: GameResult) => void): Promise<GameResult[]> {
  const results: GameResult[] = [];
  for (let i = start; i < end; i++) {
    const result = await playGame(options.seed + i, pairs[i % pairs.length] as Matchup, options);
    results.push(result);
    onResult?.(result);
  }
  return results;
}

function playInWorkers(argv: string[], games: number, workers: number): Promise<GameResult[]> {
  const size = Math.ceil(games / workers);
  const shards = Array.from({ length: workers }, (_, k): [number, number] => [k * size, Math.min(games, (k + 1) * size)]).filter(([start, end]) => start < end);
  const shardResults = shards.map(
    ([start, end]) =>
      new Promise<GameResult[]>((resolve, reject) => {
        const child = fork(fileURLToPath(import.meta.url), [...argv, '--shard', `${start}:${end}`], { execArgv: process.execArgv });
        let results: GameResult[] | null = null;
        child.on('message', (message) => {
          results = message as GameResult[];
        });
        child.on('error', reject);
        child.on('exit', (code) => (results ? resolve(results) : reject(new Error(`games ${start} to ${end - 1} stopped with exit code ${code}`))));
      }),
  );
  return Promise.all(shardResults).then((parts) => parts.flat());
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pairs = matchups(options.decks);
  if (options.shard) {
    const results = await playRange(options, pairs, ...options.shard);
    process.send?.(results, () => process.disconnect());
    return;
  }
  if (options.log !== null) {
    const lines: string[] = [];
    const result = await playGame(options.log, pairs[0] as Matchup, options, lines);
    console.log(lines.join('\n'));
    console.log(`\nResult: ${JSON.stringify({ ...result, llm: llmSummary(options, [result]), error: undefined })}`);
    if (result.error) {
      console.error(result.error);
      process.exit(1);
    }
    return;
  }

  const started = Date.now();
  const report = (result: GameResult): void => {
    if (options.quiet || options.json) return;
    const outcome = result.error ? 'ERROR' : result.winner === null ? 'draw' : `p${result.winner} (${result.reason})`;
    console.log(`seed ${result.seed} (${result.decks.join(' vs ')}): ${outcome} in ${result.turns} turns`);
  };
  const workers = options.bots.includes('llm') ? 1 : Math.min(options.workers, options.games);
  let results: GameResult[];
  if (workers > 1) {
    results = await playInWorkers(process.argv.slice(2), options.games, workers);
    results.forEach(report);
  } else {
    results = await playRange(options, pairs, 0, options.games, report);
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
    llm: llmSummary(options, results),
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

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
