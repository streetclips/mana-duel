import { getCardDef, hasCardDef } from './registry';
import { isCreature, isRelicDef, isTokenDef } from './state';
import type { CardId, GameState, PlayerId } from './types';

export function checkInvariants(s: GameState): string[] {
  const problems: string[] = [];
  const seen = new Map<CardId, string>();
  const note = (id: CardId, where: string): void => {
    const previous = seen.get(id);
    if (previous) problems.push(`${id} is both in ${previous} and ${where}`);
    seen.set(id, where);
  };

  for (const player of [0, 1] as PlayerId[]) {
    const ps = s.players[player];
    if (!Number.isInteger(ps.life)) problems.push(`p${player} life is not an integer`);
    if (!Number.isInteger(ps.extraLandsThisTurn) || ps.extraLandsThisTurn < 0)
      problems.push(`p${player} has invalid extra land plays`);
    if (player === s.activePlayer && ps.landsPlayedThisTurn > 1 + ps.extraLandsThisTurn)
      problems.push(`p${player} played more lands than allowed`);
    for (const zone of ['library', 'hand', 'graveyard', 'battlefield', 'command'] as const) {
      for (const id of ps[zone]) {
        note(id, `p${player}.${zone}`);
        const card = s.cards[id];
        if (!card) {
          problems.push(`${id} in p${player}.${zone} does not exist`);
          continue;
        }
        if (card.zone !== zone) problems.push(`${id} is listed in ${zone} but marked as ${card.zone}`);
        if (zone === 'battlefield' && card.controller !== player) problems.push(`${id} is on the wrong battlefield`);
        if (zone !== 'battlefield' && card.owner !== player) problems.push(`${id} is in the wrong player's ${zone}`);
        if (zone !== 'battlefield' && hasCardDef(card.def) && isTokenDef(getCardDef(card.def))) {
          problems.push(`token ${id} exists outside the battlefield`);
        }
        if (hasCardDef(card.def) && (zone === 'command') !== isRelicDef(getCardDef(card.def))) {
          problems.push(
            zone === 'command'
              ? `${id} is in p${player}.command but is not a relic`
              : `relic ${id} is outside the command zone`,
          );
        }
      }
    }
  }
  for (const item of s.stack) {
    if (item.kind !== 'spell') continue;
    note(item.card, 'stack');
    if (s.cards[item.card]?.zone !== 'stack') problems.push(`${item.card} is on the stack but not marked as such`);
  }
  for (const id in s.cards) {
    const card = s.cards[id];
    if (!card) continue;
    const token = hasCardDef(card.def) && isTokenDef(getCardDef(card.def));
    if (card.zone === 'gone') {
      if (!token) problems.push(`${id} ceased to exist but is not a token`);
      if (seen.has(id)) problems.push(`${id} ceased to exist but is still in ${seen.get(id)}`);
    } else if (!seen.has(id)) problems.push(`${id} is in no zone`);
    if (!hasCardDef(card.def)) problems.push(`${id} has an unknown definition ${card.def}`);
    if (card.damage < 0 || !Number.isInteger(card.damage)) problems.push(`${id} has invalid damage ${card.damage}`);
    if (card.counters < 0 || !Number.isInteger(card.counters))
      problems.push(`${id} has invalid counters ${card.counters}`);
    if (card.zone !== 'battlefield' && (card.tapped || card.damage > 0 || card.summoningSick || card.counters > 0)) {
      problems.push(`${id} keeps battlefield state outside the battlefield`);
    }
  }

  const pending = s.pending;
  if (!pending) problems.push('no pending decision');
  if (pending?.kind === 'priority' && s.priority !== pending.player) problems.push('priority holder mismatch');
  const turnBasedDecisions = ['mulligan', 'bottom', 'declareAttackers', 'declareBlockers', 'discard'];
  const effectDiscard = pending?.kind === 'discard' && pending.source !== undefined;
  if (pending && turnBasedDecisions.includes(pending.kind) && !effectDiscard && s.priority !== null) {
    problems.push(`priority is set during ${pending.kind}`);
  }

  if (s.combat) {
    for (const id of s.combat.attackers) {
      const card = s.cards[id];
      if (!card || card.zone !== 'battlefield' || card.controller !== s.activePlayer || !isCreature(s, id)) {
        problems.push(`invalid attacker ${id}`);
      }
    }
    for (const block of s.combat.blocks) {
      const card = s.cards[block.blocker];
      if (!card || card.zone !== 'battlefield' || card.controller === s.activePlayer)
        problems.push(`invalid blocker ${block.blocker}`);
      if (!s.combat.attackers.includes(block.attacker))
        problems.push(`${block.blocker} blocks a creature that is not attacking`);
    }
  }
  for (const effect of s.effects) {
    if (s.cards[effect.card]?.zone !== 'battlefield')
      problems.push(`effect ${effect.id} points to a card off the battlefield`);
  }
  for (const trigger of s.triggers) {
    if (!s.cards[trigger.source]) problems.push(`trigger ${trigger.id} has an unknown source`);
  }
  return problems;
}
