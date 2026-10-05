import {
  COLORS,
  cardColors,
  getCardDef,
  getCost,
  hasCardDef,
  isRelicDef,
  manaValue,
  nextRandom,
  normalizeSeed,
  shuffleInPlace,
  type CardDef,
  type Color,
  type DeckDef,
  type DeckEntry,
  type Effect,
  type Keyword,
  type PlayerId,
  type RngHolder,
} from '../engine';
import { isBasicLand, isLandCard, poolCards } from './cardPool';
import type { Matchup, Replay } from './controller';
import { buildDeck, countCards, draftProblems, fillWithBasics, type Allowance, type DeckDraft } from './deckBuilding';

export const PACK_SIZE = 12;
export const ROUNDS = 3;
export const SEALED_PACKS = 6;
export const MATCH_WINS = 2;
export const DECK_SPELLS = 23;
export const DRAFT_DECK_ID = 'draft';
export const AI_DRAFT_DECK_ID = 'draft-ai';
export const DEFAULT_DRAFT_NAME = 'Mi draft';

const BASICS = ['plains', 'island', 'swamp', 'mountain', 'forest'];
const COMMIT_AFTER = 5;
const EXTRA_LANDS = 2;

export type DraftFormat = 'draft' | 'sealed';

export type DraftStage = 'picking' | 'building' | 'match' | 'done';

export interface GameRecord {
  winner: PlayerId | null;
  turns: number;
}

export interface DraftRun {
  version: 1;
  format: DraftFormat;
  seed: number;
  rng: number;
  round: number;
  packs: [string[], string[]];
  picks: [string[], string[]];
  deck: DeckEntry[] | null;
  name: string;
  featured: string | null;
  aiDeck: DeckEntry[];
  wins: [number, number];
  games: GameRecord[];
  stage: DraftStage;
  duel: Replay | null;
}

export interface GameStart {
  run: DraftRun;
  seed: number;
  startingPlayer: PlayerId;
}

const KEYWORD_VALUE: Record<Keyword, number> = {
  flying: 2,
  reach: 0.5,
  haste: 0.8,
  vigilance: 0.5,
  trample: 1,
  firstStrike: 1.2,
  doubleStrike: 2.5,
  deathtouch: 1.8,
  lifelink: 1.2,
  menace: 1,
  defender: -1.5,
  flash: 0.8,
  skulk: 0.8,
  undying: 2.5,
  hexproof: 1.2,
  evolve: 1,
  prowess: 0.8,
};

function effectValue(effect: Effect): number {
  switch (effect.kind) {
    case 'damage':
      return 1.5 + effect.amount * 1.6;
    case 'destroy':
      return 8;
    case 'bounce':
      return 3;
    case 'counter':
      return 4.5;
    case 'draw':
      return effect.amount * 2.2;
    case 'gainLife':
      return effect.amount * 0.35;
    case 'loseLife':
      return effect.who === 'opponent' ? effect.amount * 0.8 : -effect.amount * 0.4;
    case 'fight':
      return 5;
    case 'bite':
      return 5.5;
    case 'pump':
      return effect.toughness < 0 ? 1.5 + -effect.toughness * 1.6 : 1 + (effect.power + effect.toughness) * 0.35 + (effect.keywords?.length ?? 0) * 0.5;
    case 'pumpTeam':
      return 2 + (effect.power + effect.toughness) * 0.8 + (effect.keywords?.length ?? 0) * 0.8;
    case 'addCounters':
      return effect.amount * 1.2;
    case 'addCountersTeam':
      return effect.amount * 3;
    case 'createTokens': {
      const token = getCardDef(effect.token);
      return effect.amount * (1 + (token.power ?? 0) * 0.9 + (token.toughness ?? 0) * 0.5 + (token.keywords ?? []).reduce((sum, keyword) => sum + KEYWORD_VALUE[keyword] * 0.5, 0));
    }
    case 'discard':
      return effect.who === 'opponent' ? effect.amount * 1.8 : -effect.amount * 0.6;
    case 'extraLands':
      return 0.5;
    case 'searchLand':
      return 1 + (effect.battlefield + (effect.hand ?? 0)) * 0.8;
    case 'returnToBattlefield':
      return 0;
  }
}

function abilitiesValue(def: CardDef): number {
  const triggers = (def.triggers ?? []).reduce((sum, trigger) => {
    const value = trigger.effects.reduce((total, effect) => total + effectValue(effect), 0);
    return sum + (trigger.on === 'enters' || trigger.on === 'dies' ? value * 0.9 : value * 0.6);
  }, 0);
  const activated = (def.activated ?? []).reduce((sum, ability) => sum + 0.8 + ability.effects.reduce((total, effect) => total + effectValue(effect), 0) * 0.3, 0);
  return triggers + activated + (def.mana ? 1.2 : 0);
}

export function cardRating(id: string): number {
  const def = getCardDef(id);
  if (isLandCard(id)) return isBasicLand(id) ? 0 : 1.5;
  const cost = manaValue(getCost(id));
  if (def.types.includes('creature')) {
    const body = 1 + (def.power ?? 0) * 1.3 + (def.toughness ?? 0) * 0.8;
    const keywords = (def.keywords ?? []).reduce((sum, keyword) => sum + KEYWORD_VALUE[keyword], 0);
    return body + keywords + abilitiesValue(def) - cost * 0.85;
  }
  const spell = (def.spell?.effects ?? []).reduce((sum, effect) => sum + effectValue(effect), 0);
  return spell - cost * 0.85;
}

export function draftPool(): string[] {
  return poolCards().filter((id) => !isBasicLand(id));
}

export function openPack(holder: RngHolder, size = PACK_SIZE): string[] {
  const pool = draftPool();
  shuffleInPlace(holder, pool);
  return pool.slice(0, size);
}

function colorWeights(picks: readonly string[]): Record<Color, number> {
  const weights: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const card of picks) {
    if (isLandCard(card)) continue;
    const colors = cardColors(getCardDef(card));
    for (const color of colors) weights[color] += Math.max(0, cardRating(card)) / colors.length;
  }
  return weights;
}

function topColors(picks: readonly string[], count = 2): Color[] {
  const weights = colorWeights(picks);
  return [...COLORS].sort((a, b) => weights[b] - weights[a]).slice(0, count);
}

function fit(card: string, colors: readonly Color[]): number {
  const def = getCardDef(card);
  if (isLandCard(card)) return (def.mana ?? []).filter((color) => colors.includes(color)).length >= 2 ? 1 : -1;
  const off = cardColors(def).filter((color) => !colors.includes(color)).length;
  return off === 0 ? 1.5 : -2.5 * off;
}

export function aiPick(pack: readonly string[], picks: readonly string[]): string {
  const committed = picks.length >= COMMIT_AFTER ? topColors(picks) : null;
  let best = pack[0] ?? '';
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const card of pack) {
    const score = cardRating(card) + (committed ? fit(card, committed) : 0);
    if (score > bestScore) {
      best = card;
      bestScore = score;
    }
  }
  return best;
}

function countOf(cards: readonly string[]): DeckEntry[] {
  const entries: DeckEntry[] = [];
  for (const card of cards) {
    const entry = entries.find((candidate) => candidate.card === card);
    if (entry) entry.count += 1;
    else entries.push({ card, count: 1 });
  }
  return entries;
}

export function autoBuild(pool: readonly string[]): DeckEntry[] {
  let best: string[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < COLORS.length; i++) {
    for (let j = i + 1; j < COLORS.length; j++) {
      const pair = [COLORS[i], COLORS[j]] as Color[];
      const spells = pool
        .filter((card) => !isLandCard(card) && cardColors(getCardDef(card)).every((color) => pair.includes(color)))
        .sort((a, b) => cardRating(b) - cardRating(a))
        .slice(0, DECK_SPELLS);
      const score = spells.reduce((sum, card) => sum + cardRating(card), 0) - (DECK_SPELLS - spells.length) * 3;
      if (score > bestScore) {
        best = spells;
        bestScore = score;
      }
    }
  }
  const missing = Math.max(0, DECK_SPELLS - best.length - EXTRA_LANDS);
  return fillWithBasics(countOf([...best, ...splashFor(pool, best, missing)]));
}

function splashFor(pool: readonly string[], spells: readonly string[], count: number): string[] {
  if (count === 0) return [];
  const rest = pool.filter((card) => !isLandCard(card));
  for (const card of spells) rest.splice(rest.indexOf(card), 1);
  const colors = new Set(spells.flatMap((card) => cardColors(getCardDef(card))));
  let best: string[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const splash of COLORS) {
    const allowed = new Set([...colors, splash]);
    const cards = rest
      .filter((card) => cardColors(getCardDef(card)).every((color) => allowed.has(color)))
      .sort((a, b) => cardRating(b) - cardRating(a))
      .slice(0, count);
    const score = cards.reduce((sum, card) => sum + cardRating(card), 0);
    if (score > bestScore) {
      best = cards;
      bestScore = score;
    }
  }
  return best;
}

export function allowances(run: DraftRun): Allowance[] {
  return [...countOf(run.picks[0]).map((entry) => ({ card: entry.card, max: entry.count })), ...BASICS.map((card) => ({ card, max: null }))];
}

export function suggestedDeck(run: DraftRun): DeckEntry[] {
  return autoBuild(run.picks[0]);
}

export function draftDeck(run: DraftRun): DeckDef {
  return { ...buildDeck({ id: DRAFT_DECK_ID, name: run.name, featured: run.featured, cards: run.deck ?? [] }, DRAFT_DECK_ID) };
}

export function aiDraftDeck(run: DraftRun): DeckDef {
  return { ...buildDeck({ id: AI_DRAFT_DECK_ID, name: 'Draft de la IA', featured: null, cards: run.aiDeck }, AI_DRAFT_DECK_ID), description: 'El mazo que la IA se construyó con sus cartas.' };
}

function finishPicking(run: DraftRun): DraftRun {
  run.stage = 'building';
  run.aiDeck = autoBuild(run.picks[1]);
  return run;
}

export function createDraft(format: DraftFormat, seed: number): DraftRun {
  const holder: RngHolder = { rng: normalizeSeed(seed) };
  const run: DraftRun = {
    version: 1,
    format,
    seed: normalizeSeed(seed),
    rng: 0,
    round: 0,
    packs: [[], []],
    picks: [[], []],
    deck: null,
    name: DEFAULT_DRAFT_NAME,
    featured: null,
    aiDeck: [],
    wins: [0, 0],
    games: [],
    stage: 'picking',
    duel: null,
  };
  if (format === 'sealed') {
    for (const player of [0, 1] as const) {
      for (let i = 0; i < SEALED_PACKS; i++) run.picks[player].push(...openPack(holder));
    }
    run.rng = holder.rng;
    return finishPicking(run);
  }
  run.packs = [openPack(holder), openPack(holder)];
  run.rng = holder.rng;
  return run;
}

export function picksLeft(run: DraftRun): number {
  return run.stage === 'picking' ? run.packs[0].length : 0;
}

export function pickNumber(run: DraftRun): number {
  return PACK_SIZE - run.packs[0].length + 1;
}

export function pickCard(run: DraftRun, card: string): DraftRun {
  if (run.stage !== 'picking') throw new Error(`the draft is at its ${run.stage} stage, not picking`);
  if (!run.packs[0].includes(card)) throw new Error(`"${card}" is not in the pack`);
  const next = structuredClone(run);
  const theirs = aiPick(next.packs[1], next.picks[1]);
  next.packs[0].splice(next.packs[0].indexOf(card), 1);
  next.packs[1].splice(next.packs[1].indexOf(theirs), 1);
  next.picks[0].push(card);
  next.picks[1].push(theirs);
  next.packs = [next.packs[1], next.packs[0]];
  if (next.packs[0].length > 0) return next;
  next.round += 1;
  if (next.round >= ROUNDS) return finishPicking(next);
  const holder: RngHolder = { rng: next.rng };
  next.packs = [openPack(holder), openPack(holder)];
  next.rng = holder.rng;
  return next;
}

export function deckProblems(run: DraftRun, draft: DeckDraft): string[] {
  return draftProblems(draft, allowances(run));
}

export function saveDeck(run: DraftRun, draft: DeckDraft): DraftRun {
  if (run.stage !== 'building' && run.stage !== 'match') throw new Error(`the draft is at its ${run.stage} stage, not building`);
  const problems = deckProblems(run, draft);
  if (problems.length > 0) throw new Error(`the deck cannot be played: ${problems.join(' ')}`);
  const next = structuredClone(run);
  const deck = buildDeck(draft, DRAFT_DECK_ID);
  next.deck = deck.cards;
  next.name = deck.name;
  next.featured = deck.featured;
  next.stage = 'match';
  return next;
}

export function matchSetup(run: DraftRun): Matchup {
  if (run.stage !== 'match' || !run.deck) throw new Error(`the draft is at its ${run.stage} stage, not match`);
  return [draftDeck(run), aiDraftDeck(run)];
}

export function startGame(run: DraftRun): GameStart {
  matchSetup(run);
  const [flip, rng] = nextRandom(run.rng);
  const [value, after] = nextRandom(rng);
  const next = structuredClone(run);
  next.rng = after;
  const last = run.games.at(-1);
  const loser = last && last.winner !== null ? ((1 - last.winner) as PlayerId) : null;
  return { run: next, seed: Math.floor(value * 2 ** 31), startingPlayer: loser ?? (flip < 0.5 ? 0 : 1) };
}

export function withGame(run: DraftRun, duel: Replay | null): DraftRun {
  const next = structuredClone(run);
  next.duel = duel ? structuredClone(duel) : null;
  return next;
}

export function recordGame(run: DraftRun, winner: PlayerId | null, turns: number): DraftRun {
  if (run.stage !== 'match') throw new Error(`the draft is at its ${run.stage} stage, not match`);
  const next = structuredClone(run);
  next.duel = null;
  next.games.push({ winner, turns });
  if (winner !== null) next.wins[winner] += 1;
  if (next.wins.some((wins) => wins >= MATCH_WINS)) next.stage = 'done';
  return next;
}

export function matchWinner(run: DraftRun): PlayerId | null {
  if (run.wins[0] >= MATCH_WINS) return 0;
  return run.wins[1] >= MATCH_WINS ? 1 : null;
}

export function deckSize(run: DraftRun): number {
  return countCards(run.deck ?? []);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCardList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((card) => typeof card === 'string' && hasCardDef(card) && !getCardDef(card).token && !isRelicDef(getCardDef(card)))
  );
}

function isEntries(value: unknown): value is DeckEntry[] {
  return Array.isArray(value) && value.every((entry) => isRecord(entry) && isCardList([entry.card]) && typeof entry.count === 'number' && Number.isInteger(entry.count) && entry.count > 0);
}

function isPair<T>(value: unknown, check: (item: unknown) => item is T): value is [T, T] {
  return Array.isArray(value) && value.length === 2 && check(value[0]) && check(value[1]);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isDraftRun(value: unknown): value is DraftRun {
  if (!isRecord(value) || value.version !== 1) return false;
  const { format, seed, rng, round, packs, picks, deck, name, featured, aiDeck, wins, games, stage, duel } = value;
  return (
    (format === 'draft' || format === 'sealed') &&
    isCount(seed) &&
    isCount(rng) &&
    isCount(round) &&
    isPair(packs, isCardList) &&
    isPair(picks, isCardList) &&
    (deck === null || isEntries(deck)) &&
    typeof name === 'string' &&
    (featured === null || isCardList([featured])) &&
    isEntries(aiDeck) &&
    isPair(wins, isCount) &&
    Array.isArray(games) &&
    games.every((game) => isRecord(game) && (game.winner === null || game.winner === 0 || game.winner === 1) && isCount(game.turns)) &&
    (stage === 'picking' || stage === 'building' || stage === 'match' || stage === 'done') &&
    (duel === null || (isRecord(duel) && typeof duel.seed === 'number' && Array.isArray(duel.actions)))
  );
}
