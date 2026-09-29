import { z } from 'zod';
import {
  STEP_NAMES,
  activatedText,
  blockOptions,
  blocksError,
  cardName,
  creaturesOf,
  eligibleAttackers,
  formatCost,
  getCard,
  getCardDef,
  getCost,
  getKeywords,
  getLegalActions,
  getPower,
  getToughness,
  KEYWORD_NAMES,
  nextStepOf,
  opponent,
  triggerText,
  type Action,
  type CardId,
  type GameState,
  type PendingDecision,
  type PlayerId,
  type Target,
} from '../engine';
import { cardLabel, targetLabel } from './view';

export type DecisionKind = Exclude<PendingDecision['kind'], 'gameOver'>;

export interface Decision {
  kind: DecisionKind;
  question: string;
  options: string[];
  answer: string;
  schema: z.ZodType;
  toAction(answer: unknown): Action;
}

export class DecisionError extends Error {
  override name = 'DecisionError';
}

const REASON = z.string().describe('Your reasoning, in one or two short sentences.');

function pendingOf(s: GameState, player: PlayerId): Exclude<PendingDecision, { kind: 'gameOver' }> {
  const pending = s.pending;
  if (!pending || pending.kind === 'gameOver') throw new Error('the game is not waiting for a decision');
  if (pending.player !== player) throw new Error(`player ${player} is not the one deciding`);
  return pending;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function creatureLine(s: GameState, id: CardId): string {
  const keywords = getKeywords(s, id).map((keyword) => KEYWORD_NAMES[keyword]);
  const stats = `${getPower(s, id)}/${getToughness(s, id)}`;
  return `${cardName(s, id)} ${stats}${keywords.length ? `, ${keywords.join(', ')}` : ''}`;
}

function targetsSuffix(s: GameState, targets: Target[], viewer: PlayerId): string {
  if (targets.length === 0) return '';
  return ` targeting ${targets.map((target) => targetLabel(s, target, viewer)).join(' and ')}`;
}

function passText(s: GameState): string {
  if (s.stack.length > 0) return 'Pass priority: do not respond; the top of the stack resolves once both players pass';
  if (s.step === 'end') return 'Pass priority: do nothing more this turn';
  return `Pass priority: do nothing now; once both players pass, the game moves on to ${STEP_NAMES[nextStepOf(s)]}`;
}

export function describeAction(s: GameState, action: Action, viewer: PlayerId): string {
  switch (action.type) {
    case 'keep': {
      const ps = s.players[action.player];
      const bottom = ps.mulligans > 0 ? `, then put ${plural(ps.mulligans, 'card')} of it on the bottom` : '';
      return `Keep this ${ps.hand.length}-card hand${bottom}`;
    }
    case 'mulligan':
      return `Mulligan: shuffle this hand away, draw a new hand of 7 and put ${plural(s.players[action.player].mulligans + 1, 'card')} on the bottom`;
    case 'pass':
      return passText(s);
    case 'playLand':
      return `Play the land ${cardName(s, action.card)} (${action.card})`;
    case 'cast': {
      const def = getCardDef(getCard(s, action.card).def);
      return `Cast ${def.name} (${action.card}) for ${formatCost(getCost(def.id))}${targetsSuffix(s, action.targets, viewer)}`;
    }
    case 'activate': {
      const def = getCardDef(getCard(s, action.card).def);
      return `Activate ${cardLabel(s, action.card, viewer)}: "${activatedText(def, action.ability)}"${targetsSuffix(s, action.targets, viewer)}`;
    }
    case 'chooseTargets':
      return `Target ${action.targets.map((target) => targetLabel(s, target, viewer)).join(' and ')}`;
    case 'declareAttackers':
      return action.attackers.length === 0
        ? 'Attack with nothing'
        : `Attack with ${action.attackers.map((id) => `${cardName(s, id)} (${id})`).join(', ')}`;
    case 'declareBlockers':
      return action.blocks.length === 0
        ? 'Block nothing'
        : `Block: ${action.blocks.map((block) => `${cardName(s, block.blocker)} (${block.blocker}) blocks ${cardName(s, block.attacker)} (${block.attacker})`).join(', ')}`;
    case 'bottom':
      return `Put ${action.cards.map((id) => `${cardName(s, id)} (${id})`).join(', ')} on the bottom`;
    case 'discard':
      return `Discard ${action.cards.map((id) => `${cardName(s, id)} (${id})`).join(', ')}`;
    case 'concede':
      return 'Concede the game';
  }
}

function priorityQuestion(s: GameState, player: PlayerId): string {
  const whose = s.activePlayer === player ? 'your' : "your opponent's";
  const top = s.stack.at(-1);
  if (top) {
    const source = top.kind === 'spell' ? top.card : top.source;
    const who = top.controller === player ? 'your' : "your opponent's";
    return `You have priority during ${whose} ${STEP_NAMES[s.step]}. On top of the stack is ${who} ${cardName(s, source)}: you may respond or let it resolve.`;
  }
  return `You have priority during ${whose} ${STEP_NAMES[s.step]}, with an empty stack.`;
}

function triggerQuestion(s: GameState, trigger: string): string {
  const pending = s.triggers.find((candidate) => candidate.id === trigger);
  if (!pending) return 'Choose the targets of a triggered ability.';
  const def = getCardDef(getCard(s, pending.source).def);
  return `Your ${def.name} (${pending.source}) triggered: "${triggerText(def, pending.ability)}" Choose its targets.`;
}

function pickDecision(kind: DecisionKind, s: GameState, player: PlayerId, question: string): Decision {
  const choices = getLegalActions(s).map((action, index) => ({
    id: String(index + 1),
    text: describeAction(s, action, player),
    action,
  }));
  const ids = choices.map((choice) => choice.id);
  const schema = z.object({
    reason: REASON,
    choice: z.enum(ids as [string, ...string[]]).describe('The id of the option you choose.'),
  });
  return {
    kind,
    question,
    options: choices.map((choice) => `${choice.id}: ${choice.text}`),
    answer: 'Answer with "choice": the id of exactly one option.',
    schema,
    toAction(answer) {
      const { choice } = schema.parse(answer);
      const picked = choices.find((candidate) => candidate.id === choice);
      if (!picked) throw new DecisionError(`"${choice}" is not one of the listed options`);
      return picked.action;
    },
  };
}

function attackersDecision(s: GameState, player: PlayerId): Decision {
  const eligible = eligibleAttackers(s);
  const shape = Object.fromEntries(eligible.map((id) => [id, z.boolean().describe(creatureLine(s, id))]));
  const schema = z.object({
    reason: REASON,
    attack: z.object(shape).describe('For each creature that can attack: true to attack with it, false to keep it back.'),
  });
  const untapped = creaturesOf(s, opponent(player)).filter((id) => !getCard(s, id).tapped);
  return {
    kind: 'declareAttackers',
    question: `Declare attackers. Your opponent has ${plural(untapped.length, 'untapped creature')} that could block${untapped.length ? `: ${untapped.map((id) => `${creatureLine(s, id)} (${id})`).join('; ')}` : ''}.`,
    options: eligible.map((id) => `${id}: ${creatureLine(s, id)}`),
    answer: 'Answer with "attack": an object with every listed creature id set to true (attacks) or false (stays back).',
    schema,
    toAction(answer) {
      const { attack } = schema.parse(answer);
      return { type: 'declareAttackers', player, attackers: eligible.filter((id) => attack[id] === true) };
    },
  };
}

function blockersDecision(s: GameState, player: PlayerId): Decision {
  const options = blockOptions(s);
  const blockers = Object.keys(options);
  const shape = Object.fromEntries(
    blockers.map((id) => [
      id,
      z.enum(['none', ...(options[id] ?? [])] as [string, ...string[]]).describe(`${creatureLine(s, id)}: the id of the attacker it blocks, or "none"`),
    ]),
  );
  const schema = z.object({
    reason: REASON,
    blocks: z.object(shape).describe('For each of your creatures that can block: the attacker it blocks, or "none".'),
  });
  const attackers = s.combat?.attackers ?? [];
  return {
    kind: 'declareBlockers',
    question: `Your opponent attacks with ${attackers.map((id) => `${creatureLine(s, id)} (${id})`).join('; ')}. Declare blockers: each of your creatures blocks at most one attacker, and several may block the same attacker.`,
    options: blockers.map((id) => `${id}: ${creatureLine(s, id)} — can block ${(options[id] ?? []).join(', ')}`),
    answer: 'Answer with "blocks": an object with every listed blocker id set to the id of the attacker it blocks, or "none".',
    schema,
    toAction(answer) {
      const parsed = schema.parse(answer).blocks;
      const blocks = blockers
        .filter((id) => parsed[id] !== undefined && parsed[id] !== 'none')
        .map((id) => ({ blocker: id, attacker: parsed[id] as CardId }));
      const error = blocksError(s, blocks);
      if (error) throw new DecisionError(error);
      return { type: 'declareBlockers', player, blocks };
    },
  };
}

function discardQuestion(s: GameState, player: PlayerId, count: number, source: CardId | undefined): string {
  if (source === undefined) return `Cleanup: you have more than 7 cards in hand. Discard ${plural(count, 'card')}.`;
  const whose = getCard(s, source).controller === player ? 'Your' : "Your opponent's";
  return `${whose} ${cardName(s, source)} makes you discard ${plural(count, 'card')}: choose which.`;
}

function cardsDecision(kind: 'bottom' | 'discard', s: GameState, player: PlayerId, count: number, source?: CardId): Decision {
  const hand = s.players[player].hand;
  const schema = z.object({
    reason: REASON,
    cards: z.array(z.enum(hand as [string, ...string[]])).describe(`Exactly ${plural(count, 'card id')} from your hand.`),
  });
  const question =
    kind === 'bottom'
      ? `You kept after ${plural(s.players[player].mulligans, 'mulligan')}: put ${plural(count, 'card')} from your hand on the bottom of your library.`
      : discardQuestion(s, player, count, source);
  return {
    kind,
    question,
    options: hand.map((id) => `${id}: ${cardName(s, id)}`),
    answer: `Answer with "cards": exactly ${plural(count, 'card id')} from the list.`,
    schema,
    toAction(answer) {
      const cards = [...new Set(schema.parse(answer).cards)];
      if (cards.length !== count) throw new DecisionError(`choose exactly ${plural(count, 'different card')} from your hand, not ${cards.length}`);
      return { type: kind, player, cards };
    },
  };
}

export function decisionFor(s: GameState, player: PlayerId): Decision {
  const pending = pendingOf(s, player);
  switch (pending.kind) {
    case 'mulligan':
      return pickDecision(
        'mulligan',
        s,
        player,
        `Opening hand: keep it or take a mulligan? You have taken ${plural(s.players[player].mulligans, 'mulligan')} so far.`,
      );
    case 'priority':
      return pickDecision('priority', s, player, priorityQuestion(s, player));
    case 'chooseTargets':
      return pickDecision('chooseTargets', s, player, triggerQuestion(s, pending.trigger));
    case 'declareAttackers':
      return attackersDecision(s, player);
    case 'declareBlockers':
      return blockersDecision(s, player);
    case 'bottom':
      return cardsDecision('bottom', s, player, pending.count);
    case 'discard':
      return cardsDecision('discard', s, player, pending.count, pending.source);
  }
}
