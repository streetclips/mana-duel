import {
  creaturesOf,
  isPlayerTarget,
  stackItemSource,
  targetKey,
  type CardId,
  type GameState,
  type PlayerId,
  type Target,
} from '../engine';

export type FxCue =
  | { kind: 'draw'; player: PlayerId; card: CardId }
  | { kind: 'discard'; player: PlayerId; card: CardId }
  | { kind: 'play'; player: PlayerId; card: CardId; via: 'land' | 'cast'; targets: Target[] }
  | { kind: 'ability'; player: PlayerId; card: CardId }
  | { kind: 'enter'; player: PlayerId; card: CardId }
  | { kind: 'attack'; player: PlayerId; card: CardId }
  | { kind: 'block'; player: PlayerId; card: CardId; attacker: CardId }
  | { kind: 'strike'; card: CardId; target: Target }
  | { kind: 'damage'; card: CardId; amount: number }
  | { kind: 'life'; player: PlayerId; delta: number }
  | { kind: 'pump'; card: CardId; power: number; toughness: number }
  | { kind: 'dies'; player: PlayerId; card: CardId; next: CardId | null }
  | { kind: 'bounce'; player: PlayerId; card: CardId; next: CardId | null }
  | { kind: 'counter'; player: PlayerId; card: CardId }
  | { kind: 'fizzle'; player: PlayerId; card: CardId }
  | { kind: 'turn'; player: PlayerId; turn: number };

export type FxKind = FxCue['kind'];

export interface FxBatch {
  seq: number;
  cues: FxCue[];
}

type CueOf<K extends FxKind> = Extract<FxCue, { kind: K }>;

function nextOnBattlefield(before: GameState | null, after: GameState, player: PlayerId, card: CardId): CardId | null {
  if (!before) return null;
  const order = creaturesOf(before, player);
  const index = order.indexOf(card);
  if (index < 0) return null;
  return order.slice(index + 1).find((id) => after.cards[id]?.zone === 'battlefield') ?? null;
}

function isFightDamage(fights: [CardId, CardId][], source: CardId, target: Target): boolean {
  if (isPlayerTarget(target)) return false;
  return fights.some(([a, b]) => (a === source && b === target.card) || (b === source && a === target.card));
}

export function fxCues(before: GameState | null, after: GameState): FxCue[] {
  const cues: FxCue[] = [];
  const damage = new Map<CardId, CueOf<'damage'>>();
  const life = new Map<PlayerId, CueOf<'life'>>();
  const pumps = new Map<CardId, CueOf<'pump'>>();
  const strikes = new Set<string>();
  const fights: [CardId, CardId][] = [];
  for (const event of after.events) {
    switch (event.t) {
      case 'draw':
        cues.push({ kind: 'draw', player: event.player, card: event.card });
        break;
      case 'discard':
        cues.push({ kind: 'discard', player: event.player, card: event.card });
        break;
      case 'land':
        cues.push({ kind: 'play', player: event.player, card: event.card, via: 'land', targets: [] });
        break;
      case 'cast':
        cues.push({ kind: 'play', player: event.player, card: event.card, via: 'cast', targets: event.targets.map((target) => ({ ...target })) });
        break;
      case 'activate':
      case 'trigger':
        cues.push({ kind: 'ability', player: event.player, card: event.card });
        break;
      case 'enter':
        cues.push({ kind: 'enter', player: event.player, card: event.card });
        break;
      case 'attack':
        for (const card of event.attackers) cues.push({ kind: 'attack', player: event.player, card });
        break;
      case 'block':
        for (const block of event.blocks) cues.push({ kind: 'block', player: event.player, card: block.blocker, attacker: block.attacker });
        break;
      case 'fight':
        fights.push([event.a, event.b]);
        break;
      case 'damage': {
        const key = `${event.source}>${targetKey(event.target)}`;
        if ((event.combat || isFightDamage(fights, event.source, event.target)) && !strikes.has(key)) {
          strikes.add(key);
          cues.push({ kind: 'strike', card: event.source, target: { ...event.target } });
        }
        if (isPlayerTarget(event.target)) break;
        const existing = damage.get(event.target.card);
        if (existing) {
          existing.amount += event.amount;
        } else {
          const cue: CueOf<'damage'> = { kind: 'damage', card: event.target.card, amount: event.amount };
          damage.set(event.target.card, cue);
          cues.push(cue);
        }
        break;
      }
      case 'life': {
        const existing = life.get(event.player);
        if (existing) {
          existing.delta += event.delta;
        } else {
          const cue: CueOf<'life'> = { kind: 'life', player: event.player, delta: event.delta };
          life.set(event.player, cue);
          cues.push(cue);
        }
        break;
      }
      case 'pump':
      case 'addCounters': {
        const power = event.t === 'pump' ? event.power : event.amount;
        const toughness = event.t === 'pump' ? event.toughness : event.amount;
        const existing = pumps.get(event.card);
        if (existing) {
          existing.power += power;
          existing.toughness += toughness;
        } else {
          const cue: CueOf<'pump'> = { kind: 'pump', card: event.card, power, toughness };
          pumps.set(event.card, cue);
          cues.push(cue);
        }
        break;
      }
      case 'dies':
        cues.push({ kind: 'dies', player: event.player, card: event.card, next: nextOnBattlefield(before, after, event.player, event.card) });
        break;
      case 'bounce':
        cues.push({ kind: 'bounce', player: event.player, card: event.card, next: nextOnBattlefield(before, after, event.player, event.card) });
        break;
      case 'counter':
        cues.push({ kind: 'counter', player: event.player, card: event.card });
        break;
      case 'fizzle':
        cues.push({ kind: 'fizzle', player: event.item.controller, card: stackItemSource(event.item) });
        break;
      case 'turn':
        cues.push({ kind: 'turn', player: event.player, turn: event.turn });
        break;
    }
  }
  return cues.filter((cue) => cue.kind !== 'life' || cue.delta !== 0);
}

export function revealsPlay(cue: CueOf<'play'>, viewer: PlayerId, spectating: boolean): boolean {
  return spectating || cue.player !== viewer;
}

const HOLD_MS: Partial<Record<FxKind, number>> = {
  play: 900,
  counter: 900,
  fizzle: 700,
  strike: 650,
  dies: 650,
  bounce: 550,
  life: 550,
  damage: 450,
  turn: 450,
  attack: 350,
  block: 350,
};

export function fxHoldMs(cues: FxCue[], viewer: PlayerId, spectating: boolean): number {
  let hold = 0;
  for (const cue of cues) {
    if (cue.kind === 'play' && !revealsPlay(cue, viewer, spectating)) continue;
    hold = Math.max(hold, HOLD_MS[cue.kind] ?? 0);
  }
  return hold;
}
