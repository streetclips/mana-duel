import {
  getCardDef,
  isCreature,
  isLand,
  opponent,
  type CardId,
  type GameState,
  type Keyword,
  type PlayerId,
  type TriggerEvent,
} from '../engine';

export const WIN_SCORE = 10_000;

export function lifeScore(life: number): number {
  if (life <= 0) return -1000;
  let score = 0;
  for (let point = 1; point <= life; point++) {
    if (point <= 5) score += 1.8;
    else if (point <= 10) score += 1.1;
    else if (point <= 20) score += 0.5;
    else score += 0.25;
  }
  return score;
}

function counters(s: GameState, id: CardId): number {
  return s.cards[id]?.counters ?? 0;
}

function printedKeywords(s: GameState, id: CardId): readonly Keyword[] {
  return getCardDef(s.cards[id]?.def ?? '').keywords ?? [];
}

const LASTING_TRIGGERS: ReadonlySet<TriggerEvent> = new Set([
  'attacks',
  'spell',
  'allyEnters',
  'allyDies',
  'damagesPlayer',
  'lifeGain',
  'landfall',
]);

export function creatureValue(s: GameState, id: CardId): number {
  const def = getCardDef(s.cards[id]?.def ?? '');
  const power = (def.power ?? 0) + counters(s, id);
  const toughness = (def.toughness ?? 0) + counters(s, id);
  let value = 1 + power * 1.5 + toughness;
  for (const keyword of printedKeywords(s, id)) {
    switch (keyword) {
      case 'flying':
        value += 1 + power * 0.6;
        break;
      case 'reach':
        value += 0.5;
        break;
      case 'vigilance':
        value += 0.6;
        break;
      case 'trample':
        value += power * 0.3;
        break;
      case 'firstStrike':
        value += 1 + power * 0.3;
        break;
      case 'doubleStrike':
        value += 1 + power;
        break;
      case 'deathtouch':
        value += 2.5;
        break;
      case 'lifelink':
        value += power * 0.5;
        break;
      case 'menace':
        value += 0.5 + power * 0.3;
        break;
      case 'defender':
        value -= power * 1.2;
        break;
      case 'skulk':
        value += 0.6 + power * 0.4;
        break;
      case 'undying':
        if (counters(s, id) === 0) value += 1 + power * 0.5;
        break;
      case 'hexproof':
        value += 1 + power * 0.3;
        break;
      case 'evolve':
        value += 1;
        break;
      case 'prowess':
        value += 0.8;
        break;
      case 'haste':
      case 'flash':
        break;
    }
  }
  if (def.mana?.length) value += 1.2;
  if (def.activated?.length) value += 1;
  for (const trigger of def.triggers ?? []) if (LASTING_TRIGGERS.has(trigger.on)) value += 1;
  return value;
}

export const CARD_IN_HAND_VALUE = 2.3;

function sideScore(s: GameState, player: PlayerId): number {
  const ps = s.players[player];
  let score = lifeScore(ps.life);
  let lands = 0;
  for (const id of ps.battlefield) {
    if (isCreature(s, id)) score += creatureValue(s, id);
    else if (isLand(s, id)) {
      lands += 1;
      score += lands <= 6 ? 1.5 : 0.4;
    }
  }
  score += ps.hand.length * CARD_IN_HAND_VALUE;
  if (ps.library.length < 4) score -= (4 - ps.library.length) * 3;
  return score;
}

function exposurePenalty(s: GameState, player: PlayerId): number {
  if (s.activePlayer !== player) return 0;
  const opp = opponent(player);
  const attackers = s.players[opp].battlefield
    .filter((id) => isCreature(s, id) && !printedKeywords(s, id).includes('defender'))
    .map((id) => ({
      power: (getCardDef(s.cards[id]?.def ?? '').power ?? 0) + counters(s, id),
      flying: printedKeywords(s, id).includes('flying'),
    }))
    .sort((a, b) => b.power - a.power);
  const blockers = s.players[player].battlefield.filter((id) => isCreature(s, id) && !s.cards[id]?.tapped);
  let flyingBlockers = blockers.filter((id) => {
    const keywords = printedKeywords(s, id);
    return keywords.includes('flying') || keywords.includes('reach');
  }).length;
  let groundBlockers = blockers.length - flyingBlockers;
  let unblocked = 0;
  for (const attacker of attackers) {
    if (attacker.flying) {
      if (flyingBlockers > 0) flyingBlockers -= 1;
      else unblocked += attacker.power;
    } else if (groundBlockers > 0) groundBlockers -= 1;
    else if (flyingBlockers > 0) flyingBlockers -= 1;
    else unblocked += attacker.power;
  }
  const life = s.players[player].life;
  if (unblocked >= life) return 25;
  if (unblocked + 2 >= life) return 8;
  return 0;
}

export function evaluate(s: GameState, player: PlayerId): number {
  const pending = s.pending;
  if (pending?.kind === 'gameOver') {
    if (pending.winner === null) return 0;
    return pending.winner === player ? WIN_SCORE : -WIN_SCORE;
  }
  const opp = opponent(player);
  return sideScore(s, player) - sideScore(s, opp) - exposurePenalty(s, player) + exposurePenalty(s, opp);
}
