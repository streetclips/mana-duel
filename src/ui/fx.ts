import { revealsPlay, type FxBatch, type FxCue, type FxKind } from '../app/fx';
import { formatPump, type CardId, type GameState, type PlayerId, type Target } from '../engine';

export interface FxEntry {
  key: string;
  seq: number;
  cue: FxCue;
  born: number;
  delay: number;
  life: number;
  order: number;
}

const LIFE_MS: Record<FxKind, number> = {
  draw: 520,
  discard: 700,
  play: 1700,
  ability: 950,
  enter: 950,
  attack: 750,
  block: 750,
  strike: 480,
  damage: 1150,
  life: 1250,
  pump: 1150,
  dies: 1100,
  bounce: 1000,
  counter: 1700,
  fizzle: 1600,
  turn: 1450,
};

export const IMPACT_MS = 180;
export const DRAW_STAGGER_MS = 70;
const AFTER_IMPACT = new Set<FxKind>(['damage', 'life', 'dies']);
const MAX_CATCH_UP = 12;
const MAX_ENTRIES = 90;

export function fxTime(speed: number): number {
  return speed > 0 ? 1 / speed : 0;
}

function entriesOf(batch: FxBatch, now: number): FxEntry[] {
  const impact = batch.cues.some((cue) => cue.kind === 'strike') ? IMPACT_MS : 0;
  const counts = new Map<string, number>();
  return batch.cues.map((cue, index) => {
    const group = 'player' in cue ? `${cue.kind}:${cue.player}` : cue.kind;
    const order = counts.get(group) ?? 0;
    counts.set(group, order + 1);
    const life = LIFE_MS[cue.kind] + (cue.kind === 'draw' ? order * DRAW_STAGGER_MS : 0);
    return {
      key: `${batch.seq}.${index}`,
      seq: batch.seq,
      cue,
      born: now,
      delay: AFTER_IMPACT.has(cue.kind) ? impact : 0,
      life,
      order,
    };
  });
}

function expiry(entry: FxEntry, time: number): number {
  return entry.born + (entry.delay + entry.life) * time;
}

export class FxTracker {
  private session = -1;
  private seq = 0;
  private latest: number | null = null;
  private entries: FxEntry[] = [];

  get lastSeq(): number {
    return this.seq;
  }

  update(session: number, batches: readonly FxBatch[], now: number, speed: number): FxEntry[] {
    if (session !== this.session) {
      this.session = session;
      this.seq = 0;
      this.entries = [];
    }
    const incoming = batches.filter((batch) => batch.seq > this.seq);
    const last = incoming.at(-1);
    if (last) this.seq = last.seq;
    this.latest = batches.at(-1)?.seq ?? null;
    if (speed <= 0) {
      this.entries = [];
      return this.entries;
    }
    for (const batch of incoming.slice(-MAX_CATCH_UP)) this.entries.push(...entriesOf(batch, now));
    const time = fxTime(speed);
    const kept = this.entries
      .filter((entry) => entry.seq === this.latest || now < expiry(entry, time))
      .slice(-MAX_ENTRIES);
    if (kept.length !== this.entries.length) this.entries = kept;
    return this.entries;
  }

  nextExpiry(speed: number): number | null {
    const time = fxTime(speed);
    let next: number | null = null;
    for (const entry of this.entries) {
      if (entry.seq === this.latest) continue;
      const end = expiry(entry, time);
      if (next === null || end < next) next = end;
    }
    return next;
  }
}

let frozenSince: number | null = null;
let frozenTotal = 0;

export function fxNow(): number {
  return (frozenSince ?? performance.now()) - frozenTotal;
}

export function setFxClockFrozen(frozen: boolean): void {
  if (frozen && frozenSince === null) frozenSince = performance.now();
  if (!frozen && frozenSince !== null) {
    frozenTotal += performance.now() - frozenSince;
    frozenSince = null;
  }
}

export type FloatTone = 'minus' | 'plus';

export interface FloatFx {
  key: string;
  text: string;
  tone: FloatTone;
  delay: number;
}

export interface CardFx {
  kinds: FxKind[];
  seq: number;
  flash?: { key: string; tone: 'damage' | 'good' | 'gold'; delay: number };
  float?: FloatFx;
  burst?: { key: string; delay: number };
  ring?: { key: string; tone: 'attack' | 'block' | 'enter' };
  order?: number;
}

export interface PlayerFx {
  kinds: FxKind[];
  seq: number;
  life?: FloatFx;
  drawn?: { key: string; seq: number; count: number };
}

export interface GhostFx {
  key: string;
  card: CardId;
  def: string;
  kind: 'dies' | 'bounce';
  next: CardId | null;
  delay: number;
}

export interface RevealFx {
  key: string;
  kind: 'play' | 'counter' | 'fizzle';
  card: CardId;
  def: string;
  player: PlayerId;
  via: 'land' | 'cast' | null;
  targets: Target[];
}

export interface FxView {
  seq: number;
  cards: Map<CardId, CardFx>;
  players: Map<PlayerId, PlayerFx>;
  ghosts: Map<PlayerId, GhostFx[]>;
  stack: Map<CardId, FxKind>;
  reveal: RevealFx | null;
  turn: { key: string; player: PlayerId; turn: number } | null;
  hurt: { key: string; delay: number } | null;
}

function signedLife(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${-delta}`;
}

export function fxView(entries: FxEntry[], s: GameState, human: PlayerId, spectating: boolean, seq = 0): FxView {
  const view: FxView = {
    seq,
    cards: new Map(),
    players: new Map(),
    ghosts: new Map(),
    stack: new Map(),
    reveal: null,
    turn: null,
    hurt: null,
  };
  const card = (id: CardId, entry: FxEntry): CardFx => {
    const fx = view.cards.get(id) ?? { kinds: [], seq: entry.seq };
    view.cards.set(id, fx);
    if (!fx.kinds.includes(entry.cue.kind)) fx.kinds.push(entry.cue.kind);
    fx.seq = Math.max(fx.seq, entry.seq);
    return fx;
  };
  const player = (id: PlayerId, entry: FxEntry): PlayerFx => {
    const fx = view.players.get(id) ?? { kinds: [], seq: entry.seq };
    view.players.set(id, fx);
    if (!fx.kinds.includes(entry.cue.kind)) fx.kinds.push(entry.cue.kind);
    fx.seq = Math.max(fx.seq, entry.seq);
    return fx;
  };
  const defOf = (id: CardId): string | undefined => s.cards[id]?.def;

  for (const entry of entries) {
    const cue = entry.cue;
    switch (cue.kind) {
      case 'draw': {
        if (cue.player === human) {
          if (s.cards[cue.card]?.zone === 'hand') card(cue.card, entry).order = entry.order;
          break;
        }
        const fx = player(cue.player, entry);
        fx.drawn = { key: entry.key, seq: entry.seq, count: fx.drawn?.seq === entry.seq ? fx.drawn.count + 1 : 1 };
        break;
      }
      case 'discard':
        player(cue.player, entry);
        break;
      case 'play': {
        if (cue.via === 'cast') view.stack.set(cue.card, 'play');
        const def = defOf(cue.card);
        if (def && revealsPlay(cue, human, spectating)) {
          view.reveal = {
            key: entry.key,
            kind: 'play',
            card: cue.card,
            def,
            player: cue.player,
            via: cue.via,
            targets: cue.targets,
          };
        }
        break;
      }
      case 'ability':
        card(cue.card, entry).flash = { key: entry.key, tone: 'gold', delay: 0 };
        view.stack.set(cue.card, 'ability');
        break;
      case 'enter':
        card(cue.card, entry).ring = { key: entry.key, tone: 'enter' };
        break;
      case 'strike':
        card(cue.card, entry);
        break;
      case 'attack':
      case 'block':
        card(cue.card, entry).ring = { key: entry.key, tone: cue.kind };
        break;
      case 'damage': {
        const fx = card(cue.card, entry);
        fx.flash = { key: entry.key, tone: 'damage', delay: entry.delay };
        fx.burst = { key: entry.key, delay: entry.delay };
        fx.float = { key: entry.key, text: `−${cue.amount}`, tone: 'minus', delay: entry.delay };
        break;
      }
      case 'pump': {
        const shrink = cue.power < 0 || cue.toughness < 0;
        const fx = card(cue.card, entry);
        fx.flash = { key: entry.key, tone: shrink ? 'damage' : 'good', delay: 0 };
        fx.float = {
          key: entry.key,
          text: formatPump(cue.power, cue.toughness, cue.keywords),
          tone: shrink ? 'minus' : 'plus',
          delay: 0,
        };
        break;
      }
      case 'life': {
        const fx = player(cue.player, entry);
        fx.life = {
          key: entry.key,
          text: signedLife(cue.delta),
          tone: cue.delta > 0 ? 'plus' : 'minus',
          delay: entry.delay,
        };
        if (cue.player === human && cue.delta < 0) view.hurt = { key: entry.key, delay: entry.delay };
        break;
      }
      case 'dies':
      case 'bounce': {
        card(cue.card, entry);
        const def = defOf(cue.card);
        if (!def || s.cards[cue.card]?.zone === 'battlefield') break;
        const ghosts = view.ghosts.get(cue.player) ?? [];
        view.ghosts.set(cue.player, ghosts);
        ghosts.push({ key: entry.key, card: cue.card, def, kind: cue.kind, next: cue.next, delay: entry.delay });
        break;
      }
      case 'counter':
      case 'fizzle': {
        const def = defOf(cue.card);
        if (def)
          view.reveal = {
            key: entry.key,
            kind: cue.kind,
            card: cue.card,
            def,
            player: cue.player,
            via: null,
            targets: [],
          };
        break;
      }
      case 'turn':
        view.turn = { key: entry.key, player: cue.player, turn: cue.turn };
        break;
    }
  }
  return view;
}

export type BattlefieldItem = { id: CardId } | { ghost: GhostFx };

export function withGhosts(ids: CardId[], ghosts: GhostFx[] = []): BattlefieldItem[] {
  const items: BattlefieldItem[] = ids.map((id) => ({ id }));
  const idOf = (item: BattlefieldItem): CardId => ('id' in item ? item.id : item.ghost.card);
  for (const ghost of ghosts) {
    if (ids.includes(ghost.card) || items.some((item) => 'ghost' in item && item.ghost.card === ghost.card)) continue;
    const index = ghost.next === null ? -1 : items.findIndex((item) => idOf(item) === ghost.next);
    if (index < 0) items.push({ ghost });
    else items.splice(index, 0, { ghost });
  }
  return items;
}
