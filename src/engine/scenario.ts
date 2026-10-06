import { defaultPlayerNames } from './describe';
import { advance, emptyState } from './game';
import { getCardDef, hasCardDef } from './registry';
import { isRelicDef } from './state';
import type { CardId, GameState, PlayerId, Zone } from './types';

export interface ScenarioCard {
  card: string;
  id?: CardId;
  tapped?: boolean;
  sick?: boolean;
  damage?: number;
  counters?: number;
}

export type ScenarioEntry = string | ScenarioCard;

export interface ScenarioPlayer {
  name?: string;
  life?: number;
  hand?: ScenarioEntry[];
  battlefield?: ScenarioEntry[];
  library?: ScenarioEntry[];
  graveyard?: ScenarioEntry[];
  relics?: ScenarioEntry[];
  landsPlayed?: number;
  extraLands?: number;
  damagedThisTurn?: boolean;
}

export interface ScenarioSpec {
  seed?: number;
  turn?: number;
  activePlayer?: PlayerId;
  startingPlayer?: PlayerId;
  step?: 'main1' | 'main2';
  turnLimit?: number;
  players: [ScenarioPlayer?, ScenarioPlayer?];
}

const DEFAULT_LIBRARY: ScenarioEntry[] = Array.from({ length: 10 }, () => 'mountain');

export function createScenario(spec: ScenarioSpec): GameState {
  const defaults = defaultPlayerNames();
  const names: [string, string] = [spec.players[0]?.name ?? defaults[0], spec.players[1]?.name ?? defaults[1]];
  const s = emptyState(spec.seed ?? 1, names, spec.turnLimit);
  s.turn = spec.turn ?? 3;
  s.activePlayer = spec.activePlayer ?? 0;
  s.startingPlayer = spec.startingPlayer ?? 0;
  s.step = spec.step ?? 'main1';

  const usedIds = new Set<string>();
  for (const player of [0, 1] as const) {
    for (const entry of [
      ...(spec.players[player]?.hand ?? []),
      ...(spec.players[player]?.battlefield ?? []),
      ...(spec.players[player]?.library ?? DEFAULT_LIBRARY),
      ...(spec.players[player]?.graveyard ?? []),
      ...(spec.players[player]?.relics ?? []),
    ]) {
      if (typeof entry !== 'string' && entry.id) {
        if (usedIds.has(entry.id)) throw new Error(`Duplicate scenario card id "${entry.id}"`);
        usedIds.add(entry.id);
      }
    }
  }
  let counter = 0;
  const nextAutoId = (): CardId => {
    let id: string;
    do {
      counter += 1;
      id = `c${counter}`;
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
  };

  const place = (player: PlayerId, zone: Exclude<Zone, 'stack' | 'gone'>, entry: ScenarioEntry): void => {
    const card = typeof entry === 'string' ? { card: entry } : entry;
    if (!hasCardDef(card.card)) throw new Error(`Unknown card definition "${card.card}"`);
    if (getCardDef(card.card).token && zone !== 'battlefield')
      throw new Error(`The token "${card.card}" can only be on the battlefield`);
    if (isRelicDef(getCardDef(card.card)) !== (zone === 'command')) {
      throw new Error(
        zone === 'command'
          ? `"${card.card}" is not a relic`
          : `The relic "${card.card}" can only be among a player's relics`,
      );
    }
    const id = card.id ?? nextAutoId();
    s.cards[id] = {
      id,
      def: card.card,
      owner: player,
      controller: player,
      zone,
      tapped: zone === 'battlefield' ? Boolean(card.tapped) : false,
      summoningSick: zone === 'battlefield' ? Boolean(card.sick) : false,
      damage: zone === 'battlefield' ? (card.damage ?? 0) : 0,
      deathtouchDamage: false,
      counters: zone === 'battlefield' ? (card.counters ?? 0) : 0,
    };
    s.players[player][zone].push(id);
  };

  for (const player of [0, 1] as const) {
    const ps = spec.players[player] ?? {};
    const state = s.players[player];
    state.life = ps.life ?? state.life;
    state.kept = true;
    state.bottomed = true;
    state.landsPlayedThisTurn = ps.landsPlayed ?? 0;
    state.extraLandsThisTurn = ps.extraLands ?? 0;
    state.damagedThisTurn = ps.damagedThisTurn ?? false;
    for (const entry of ps.hand ?? []) place(player, 'hand', entry);
    for (const entry of ps.battlefield ?? []) place(player, 'battlefield', entry);
    for (const entry of ps.library ?? DEFAULT_LIBRARY) place(player, 'library', entry);
    for (const entry of ps.graveyard ?? []) place(player, 'graveyard', entry);
    for (const entry of ps.relics ?? []) place(player, 'command', entry);
  }

  advance(s);
  return s;
}
