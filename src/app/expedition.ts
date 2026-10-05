import {
  COLORS,
  DECK_LIST,
  OPENING_HAND,
  STARTING_LIFE,
  getCardDef,
  getDeck,
  hasCardDef,
  hasDeck,
  isRelicDef,
  nextRandom,
  normalizeSeed,
  shuffleInPlace,
  type Color,
  type DeckDef,
  type DeckEntry,
  type PlayerId,
  type RngHolder,
} from '../engine';
import { MAX_COPIES, spellPool } from './cardPool';
import type { Matchup, Perks, Replay, SeatPerks } from './controller';
import type { DuelResult } from './duelTracker';
import { duelPerks, isRelicId, relicOf, relicsOf, startsEveryDuel, type RelicId, type RelicOwner, type SeatRelics } from './relics';

export type { DuelResult };

export const EXPEDITION_DECK_ID = 'expedition';
export const DUELS = 7;
export const RELIC_EVERY = 3;
export const OFFERS = 3;
export const RIVAL_LIFE: readonly number[] = [14, 16, 16, 18, 20, 20, 20];
export const RIVAL_HAND: readonly number[] = [6, 6, 6, 6, 6, 6, 6];
export const RIVAL_RELICS: readonly number[] = [0, 0, 1, 1, 1, 2, 1];

export interface BaseDeck {
  id: string;
  name: string;
  colors: Color[];
  featured: string;
}

export interface Rival {
  deck: string;
  life: number;
  openingHand: number;
  relics: RelicId[];
  boss: boolean;
}

export interface DuelRecord {
  rival: string;
  result: DuelResult;
  turns: number;
}

export type Stage =
  | { kind: 'duel' }
  | { kind: 'card'; offers: string[] }
  | { kind: 'swap'; card: string }
  | { kind: 'relic'; offers: RelicId[] }
  | { kind: 'won' }
  | { kind: 'lost' };

export interface ExpeditionRun {
  version: 2;
  seed: number;
  rng: number;
  base: BaseDeck;
  deck: DeckEntry[];
  relics: RelicId[];
  spent: RelicId[];
  rivals: Rival[];
  wins: number;
  stage: Stage;
  history: DuelRecord[];
  added: string[];
  removed: string[];
  duel: Replay | null;
}

export interface DuelSetup {
  decks: Matchup;
  perks: SeatPerks;
}

export interface DuelStart {
  run: ExpeditionRun;
  seed: number;
  startingPlayer: PlayerId;
}

function copyRun(run: ExpeditionRun): ExpeditionRun {
  return structuredClone(run);
}

function fail(run: ExpeditionRun, wanted: Stage['kind']): never {
  throw new Error(`the expedition is at its ${run.stage.kind} stage, not ${wanted}`);
}

export interface RelicPools {
  common: RelicId[];
  boss: RelicId[];
}

export function shuffledRelicPools(holder: RngHolder): RelicPools {
  const common = relicsOf(['any']);
  shuffleInPlace(holder, common);
  const boss = relicsOf(['boss']);
  shuffleInPlace(holder, boss);
  return { common, boss };
}

export function rivalAt(index: number, deck: string, pools: RelicPools): Rival {
  const boss = index === DUELS - 1;
  return {
    deck,
    life: RIVAL_LIFE[index] ?? STARTING_LIFE,
    openingHand: RIVAL_HAND[index] ?? OPENING_HAND,
    relics: [...(boss ? pools.boss.slice(0, 1) : []), ...pools.common.splice(0, RIVAL_RELICS[index] ?? 0)],
    boss,
  };
}

export function createRun(base: DeckDef, seed: number): ExpeditionRun {
  const holder: RngHolder = { rng: normalizeSeed(seed) };
  const others = DECK_LIST.map((deck) => deck.id).filter((id) => id !== base.id);
  shuffleInPlace(holder, others);
  const pools = shuffledRelicPools(holder);
  const rivals = others.slice(0, DUELS).map((deck, index) => rivalAt(index, deck, pools));
  return {
    version: 2,
    seed: normalizeSeed(seed),
    rng: holder.rng,
    base: { id: base.id, name: base.name, colors: [...base.colors], featured: base.featured },
    deck: base.cards.map((entry) => ({ ...entry })),
    relics: [],
    spent: [],
    rivals,
    wins: 0,
    stage: { kind: 'duel' },
    history: [],
    added: [],
    removed: [],
    duel: null,
  };
}

export function currentRival(run: ExpeditionRun): Rival | null {
  return run.rivals[run.wins] ?? null;
}

export function deckSizeOf(run: ExpeditionRun): number {
  return run.deck.reduce((sum, entry) => sum + entry.count, 0);
}

export function copiesOf(run: ExpeditionRun, card: string): number {
  return run.deck.find((entry) => entry.card === card)?.count ?? 0;
}

export function changesLabel(run: ExpeditionRun): string {
  const changes = run.added.length;
  if (changes === 0) return 'sin cambios';
  return changes === 1 ? 'con 1 carta nueva' : `con ${changes} cartas nuevas`;
}

export function runDeck(run: ExpeditionRun): DeckDef {
  return {
    id: EXPEDITION_DECK_ID,
    name: run.base.name,
    description: `Tu mazo de la expedición: ${run.base.name} ${changesLabel(run)}.`,
    colors: [...run.base.colors],
    featured: run.base.featured,
    cards: run.deck.map((entry) => ({ ...entry })),
  };
}

function playerSeat(run: ExpeditionRun): SeatRelics {
  return { relics: run.relics, deck: run.deck, colors: run.base.colors };
}

export function rivalSeat(rival: Rival): SeatRelics {
  const deck = getDeck(rival.deck);
  return { relics: rival.relics, deck: deck.cards, colors: deck.colors, life: rival.life, openingHand: rival.openingHand };
}

export function perksAgainst(run: ExpeditionRun, rival: Rival): SeatPerks {
  return duelPerks([playerSeat(run), rivalSeat(rival)]);
}

export function rivalStart(run: ExpeditionRun, rival: Rival): { life: number; openingHand: number } {
  const perks: Perks = perksAgainst(run, rival)[1];
  return { life: perks.life ?? STARTING_LIFE, openingHand: perks.openingHand ?? OPENING_HAND };
}

export function phoenixReady(run: ExpeditionRun): boolean {
  return run.relics.includes('phoenix') && !run.spent.includes('phoenix');
}

export function duelSetup(run: ExpeditionRun): DuelSetup {
  const rival = currentRival(run);
  if (!rival || run.stage.kind !== 'duel') fail(run, 'duel');
  return { decks: [runDeck(run), rival.deck], perks: perksAgainst(run, rival) };
}

export function startDuel(run: ExpeditionRun): DuelStart {
  if (run.stage.kind !== 'duel') fail(run, 'duel');
  const [value, afterSeed] = nextRandom(run.rng);
  const [flip, rng] = nextRandom(afterSeed);
  const next = copyRun(run);
  next.rng = rng;
  const startingPlayer: PlayerId = startsEveryDuel(run.relics) || flip < 0.5 ? 0 : 1;
  return { run: next, seed: Math.floor(value * 2 ** 31), startingPlayer };
}

export function withDuel(run: ExpeditionRun, duel: Replay | null): ExpeditionRun {
  const next = copyRun(run);
  next.duel = duel ? structuredClone(duel) : null;
  return next;
}

function cardOffers(run: ExpeditionRun, holder: RngHolder): string[] {
  const pool = spellPool(run.base.colors).filter((card) => copiesOf(run, card) < MAX_COPIES);
  shuffleInPlace(holder, pool);
  return pool.slice(0, OFFERS);
}

function relicOffers(run: ExpeditionRun, holder: RngHolder): RelicId[] {
  const left = relicsOf(['any', 'player']).filter((id) => !run.relics.includes(id));
  shuffleInPlace(holder, left);
  return left.slice(0, OFFERS);
}

function afterReward(run: ExpeditionRun): ExpeditionRun {
  if (run.wins % RELIC_EVERY === 0) {
    const holder: RngHolder = { rng: run.rng };
    const offers = relicOffers(run, holder);
    run.rng = holder.rng;
    if (offers.length > 0) {
      run.stage = { kind: 'relic', offers };
      return run;
    }
  }
  run.stage = { kind: 'duel' };
  return run;
}

export function recordDuel(run: ExpeditionRun, result: DuelResult, turns: number): ExpeditionRun {
  const rival = currentRival(run);
  if (!rival || run.stage.kind !== 'duel') fail(run, 'duel');
  const next = copyRun(run);
  next.duel = null;
  next.history.push({ rival: rival.deck, result, turns });
  if (result === 'draw') return next;
  if (result === 'lost') {
    if (phoenixReady(run)) next.spent.push('phoenix');
    else next.stage = { kind: 'lost' };
    return next;
  }
  next.wins += 1;
  if (next.wins >= next.rivals.length) {
    next.stage = { kind: 'won' };
    return next;
  }
  const holder: RngHolder = { rng: next.rng };
  const offers = cardOffers(next, holder);
  next.rng = holder.rng;
  if (offers.length === 0) return afterReward(next);
  next.stage = { kind: 'card', offers };
  return next;
}

export function chooseCard(run: ExpeditionRun, card: string | null): ExpeditionRun {
  if (run.stage.kind !== 'card') fail(run, 'card');
  if (card !== null && !run.stage.offers.includes(card)) throw new Error(`"${card}" is not one of the cards on offer`);
  const next = copyRun(run);
  if (card === null) return afterReward(next);
  next.stage = { kind: 'swap', card };
  return next;
}

export function swapCard(run: ExpeditionRun, out: string | null): ExpeditionRun {
  if (run.stage.kind !== 'swap') fail(run, 'swap');
  if (out !== null && copiesOf(run, out) === 0) throw new Error(`"${out}" is not in the expedition deck`);
  const card = run.stage.card;
  const next = copyRun(run);
  if (out !== null) {
    next.deck = next.deck
      .map((entry) => (entry.card === out ? { ...entry, count: entry.count - 1 } : entry))
      .filter((entry) => entry.count > 0);
    next.removed.push(out);
  }
  const existing = next.deck.find((entry) => entry.card === card);
  if (existing) existing.count += 1;
  else next.deck.push({ card, count: 1 });
  next.added.push(card);
  return afterReward(next);
}

export function chooseRelic(run: ExpeditionRun, relic: RelicId): ExpeditionRun {
  if (run.stage.kind !== 'relic') fail(run, 'relic');
  if (!run.stage.offers.includes(relic)) throw new Error(`"${relic}" is not one of the relics on offer`);
  const next = copyRun(run);
  next.relics.push(relic);
  next.stage = { kind: 'duel' };
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCard(value: unknown): value is string {
  return typeof value === 'string' && hasCardDef(value) && !getCardDef(value).token && !isRelicDef(getCardDef(value));
}

function isCount(value: unknown, min = 0): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min;
}

function isBase(value: unknown): value is BaseDeck {
  if (!isRecord(value)) return false;
  const { id, name, colors, featured } = value;
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    Array.isArray(colors) &&
    colors.every((color) => (COLORS as readonly unknown[]).includes(color)) &&
    isCard(featured)
  );
}

function isRelicList(value: unknown, owners: readonly RelicOwner[]): value is RelicId[] {
  return (
    Array.isArray(value) &&
    value.every((relic) => isRelicId(relic) && owners.includes(relicOf(relic).owner)) &&
    new Set(value).size === value.length
  );
}

function isRival(value: unknown): value is Rival {
  if (!isRecord(value)) return false;
  const { deck, life, openingHand, relics, boss } = value;
  return (
    typeof deck === 'string' &&
    hasDeck(deck) &&
    isCount(life, 1) &&
    isCount(openingHand, 1) &&
    isRelicList(relics, ['any', 'boss']) &&
    typeof boss === 'boolean'
  );
}

function isStage(value: unknown): value is Stage {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'duel':
    case 'won':
    case 'lost':
      return true;
    case 'card':
      return Array.isArray(value.offers) && value.offers.every(isCard);
    case 'swap':
      return isCard(value.card);
    case 'relic':
      return Array.isArray(value.offers) && value.offers.every(isRelicId);
    default:
      return false;
  }
}

function isDuelRecord(value: unknown): value is DuelRecord {
  if (!isRecord(value)) return false;
  return typeof value.rival === 'string' && ['won', 'lost', 'draw'].includes(String(value.result)) && isCount(value.turns);
}

function isSavedDuel(value: unknown): value is Replay | null {
  if (value === null) return true;
  return isRecord(value) && typeof value.seed === 'number' && Array.isArray(value.decks) && Array.isArray(value.actions);
}

export function isExpeditionRun(value: unknown): value is ExpeditionRun {
  if (!isRecord(value) || value.version !== 2) return false;
  const { seed, rng, base, deck, relics, spent, rivals, wins, stage, history, added, removed, duel } = value;
  return (
    isCount(seed) &&
    isCount(rng) &&
    isBase(base) &&
    Array.isArray(deck) &&
    deck.every((entry) => isRecord(entry) && isCard(entry.card) && isCount(entry.count, 1)) &&
    isRelicList(relics, ['any', 'player']) &&
    isRelicList(spent, ['any', 'player']) &&
    spent.every((relic) => relics.includes(relic)) &&
    Array.isArray(rivals) &&
    rivals.length > 0 &&
    rivals.every(isRival) &&
    isCount(wins) &&
    wins <= rivals.length &&
    isStage(stage) &&
    Array.isArray(history) &&
    history.every(isDuelRecord) &&
    Array.isArray(added) &&
    added.every(isCard) &&
    Array.isArray(removed) &&
    removed.every(isCard) &&
    isSavedDuel(duel)
  );
}
