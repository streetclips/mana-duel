import {
  OPENING_HAND,
  STARTING_LIFE,
  getCardDef,
  rulesText,
  tokenDescription,
  type Color,
  type DeckEntry,
} from '../engine';
import { isLandCard } from './cardPool';
import type { Perks, SeatPerks } from './controller';
import { modesText, type RelicText } from './text/modes';

export type RelicId =
  | 'vigor'
  | 'foresight'
  | 'banner'
  | 'cartographer'
  | 'hourglass'
  | 'mask'
  | 'censer'
  | 'urn'
  | 'drum'
  | 'chalice'
  | 'tome'
  | 'phoenix'
  | 'bell'
  | 'grimoire'
  | 'crown';

export type RelicKind = 'start' | 'play' | 'run';

export type RelicOwner = 'any' | 'player' | 'boss';

export interface Relic {
  id: RelicId;
  name: string;
  text: string;
  kind: RelicKind;
  owner: RelicOwner;
}

export const VIGOR_LIFE = 6;

const BASIC_OF: Record<Color, string> = { W: 'plains', U: 'island', B: 'swamp', R: 'mountain', G: 'forest' };

function relic(id: RelicId, kind: RelicKind, owner: RelicOwner, describe: () => RelicText): Relic {
  return {
    id,
    get name() {
      return describe().name;
    },
    get text() {
      return describe().text;
    },
    kind,
    owner,
  };
}

function inPlay(id: RelicId, owner: RelicOwner): Relic {
  return relic(id, 'play', owner, () => {
    const def = getCardDef(id);
    return { name: def.name, text: rulesText(def).join(' ') };
  });
}

export const RELICS: readonly Relic[] = [
  relic('vigor', 'start', 'any', () => modesText().relics.vigor(VIGOR_LIFE)),
  relic('foresight', 'start', 'any', () => modesText().relics.foresight()),
  relic('banner', 'start', 'any', () => modesText().relics.banner(tokenDescription('soldier_token'))),
  relic('cartographer', 'start', 'any', () => modesText().relics.cartographer()),
  relic('hourglass', 'start', 'player', () => modesText().relics.hourglass()),
  relic('mask', 'start', 'any', () => modesText().relics.mask()),
  inPlay('censer', 'any'),
  inPlay('urn', 'any'),
  inPlay('drum', 'any'),
  inPlay('chalice', 'any'),
  inPlay('tome', 'any'),
  relic('phoenix', 'run', 'player', () => modesText().relics.phoenix()),
  inPlay('bell', 'boss'),
  inPlay('grimoire', 'boss'),
  inPlay('crown', 'boss'),
];

export function relicOf(id: RelicId): Relic {
  const relic = RELICS.find((candidate) => candidate.id === id);
  if (!relic) throw new Error(`Unknown relic "${id}"`);
  return relic;
}

export function isRelicId(value: unknown): value is RelicId {
  return RELICS.some((relic) => relic.id === value);
}

export function relicsOf(owners: readonly RelicOwner[]): RelicId[] {
  return RELICS.filter((relic) => owners.includes(relic.owner)).map((relic) => relic.id);
}

export function mostCommonLand(deck: readonly DeckEntry[], colors: readonly Color[]): string | null {
  let best: DeckEntry | null = null;
  for (const entry of deck) {
    if (!isLandCard(entry.card)) continue;
    if (!best || entry.count > best.count) best = entry;
  }
  if (best) return best.card;
  const color = colors[0];
  return color ? BASIC_OF[color] : null;
}

export interface SeatRelics {
  relics: readonly RelicId[];
  deck: readonly DeckEntry[];
  colors: readonly Color[];
  life?: number;
  openingHand?: number;
}

function seatPerks(seat: SeatRelics, rival: SeatRelics): Perks {
  const perks: Perks = {};
  const has = (id: RelicId): boolean => seat.relics.includes(id);
  const life = (seat.life ?? STARTING_LIFE) + (has('vigor') ? VIGOR_LIFE : 0);
  if (life !== STARTING_LIFE) perks.life = life;
  const hand =
    (seat.openingHand ?? OPENING_HAND) +
    (has('foresight') ? 1 : 0) -
    (has('cartographer') ? 1 : 0) -
    (rival.relics.includes('mask') ? 1 : 0);
  if (hand !== OPENING_HAND) perks.openingHand = Math.max(1, hand);
  const battlefield: string[] = [];
  if (has('banner')) battlefield.push('soldier_token');
  const land = has('cartographer') ? mostCommonLand(seat.deck, seat.colors) : null;
  if (land) battlefield.push(land);
  if (battlefield.length > 0) perks.battlefield = battlefield;
  const played = seat.relics.filter((id) => relicOf(id).kind === 'play');
  if (played.length > 0) perks.relics = played;
  if (has('hourglass')) perks.drawOnFirstTurn = true;
  return perks;
}

export function duelPerks(seats: readonly [SeatRelics, SeatRelics]): SeatPerks {
  return [seatPerks(seats[0], seats[1]), seatPerks(seats[1], seats[0])];
}

export function startsEveryDuel(relics: readonly RelicId[]): boolean {
  return relics.includes('hourglass');
}
