import { z } from 'zod';
import {
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
  isPlayerTarget,
  keywordName,
  nextStepOf,
  opponent,
  refusalText,
  stepName,
  triggerText,
  type Action,
  type CardId,
  type GameState,
  type PendingDecision,
  type PlayerId,
  type Target,
} from '../engine';
import { llmText } from './text';
import type { LlmText } from './text/types';
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

function text(): LlmText['decision'] {
  return llmText().decision;
}

function reason(): z.ZodString {
  return z.string().describe(text().reason);
}

function pendingOf(s: GameState, player: PlayerId): Exclude<PendingDecision, { kind: 'gameOver' }> {
  const pending = s.pending;
  if (!pending || pending.kind === 'gameOver') throw new Error(refusalText({ code: 'noDecision' }));
  if (pending.player !== player) throw new Error(refusalText({ code: 'notTheirDecision', player }));
  return pending;
}

function creatureLine(s: GameState, id: CardId): string {
  const keywords = getKeywords(s, id).map((keyword) => keywordName(keyword));
  const stats = `${getPower(s, id)}/${getToughness(s, id)}`;
  return `${cardName(s, id)} ${stats}${keywords.length ? `, ${keywords.join(', ')}` : ''}`;
}

function objectLabel(s: GameState, target: Target, viewer: PlayerId): string {
  if (isPlayerTarget(target) && target.player === viewer) return text().you;
  return targetLabel(s, target, viewer);
}

function targetsSuffix(s: GameState, targets: Target[], viewer: PlayerId): string {
  if (targets.length === 0) return '';
  return text().targeting(targets.map((target) => objectLabel(s, target, viewer)).join(text().and));
}

function passText(s: GameState): string {
  if (s.stack.length > 0) return text().passResolves;
  if (s.step === 'end') return text().passEndStep;
  return text().passMovesOn(stepName(nextStepOf(s)));
}

function cardList(s: GameState, ids: CardId[]): string {
  return ids.map((id) => `${cardName(s, id)} (${id})`).join(', ');
}

export function describeAction(s: GameState, action: Action, viewer: PlayerId): string {
  const words = text();
  switch (action.type) {
    case 'keep': {
      const ps = s.players[action.player];
      return words.keep(ps.hand.length, ps.mulligans);
    }
    case 'mulligan':
      return words.mulligan(s.players[action.player].mulligans + 1);
    case 'pass':
      return passText(s);
    case 'playLand':
      return words.playLand(cardName(s, action.card), action.card);
    case 'cast': {
      const def = getCardDef(getCard(s, action.card).def);
      return words.cast(def.name, action.card, formatCost(getCost(def.id)), targetsSuffix(s, action.targets, viewer));
    }
    case 'activate': {
      const def = getCardDef(getCard(s, action.card).def);
      return words.activate(cardLabel(s, action.card, viewer), activatedText(def, action.ability), targetsSuffix(s, action.targets, viewer));
    }
    case 'chooseTargets':
      return words.chooseTargets(action.targets.map((target) => targetLabel(s, target, viewer)).join(words.and));
    case 'declareAttackers':
      return action.attackers.length === 0 ? words.noAttack : words.attack(cardList(s, action.attackers));
    case 'declareBlockers':
      return action.blocks.length === 0
        ? words.noBlock
        : words.block(
            action.blocks.map((block) => words.blocks(cardName(s, block.blocker), block.blocker, cardName(s, block.attacker), block.attacker)).join(', '),
          );
    case 'bottom':
      return words.bottom(cardList(s, action.cards));
    case 'discard':
      return words.discard(cardList(s, action.cards));
    case 'concede':
      return words.concede;
  }
}

function priorityQuestion(s: GameState, player: PlayerId): string {
  const words = text();
  const whose = s.activePlayer === player ? words.yourTurn : words.opponentTurn;
  const top = s.stack.at(-1);
  if (top) {
    const source = top.kind === 'spell' ? top.card : top.source;
    const what = top.controller === player ? words.yourCard(cardName(s, source)) : words.opponentCard(cardName(s, source));
    return words.priorityWithStack(whose, stepName(s.step), what);
  }
  return words.priority(whose, stepName(s.step));
}

function triggerQuestion(s: GameState, trigger: string): string {
  const pending = s.triggers.find((candidate) => candidate.id === trigger);
  if (!pending) return text().anyTrigger;
  const def = getCardDef(getCard(s, pending.source).def);
  return text().trigger(def.name, pending.source, triggerText(def, pending.ability));
}

function pickDecision(kind: DecisionKind, s: GameState, player: PlayerId, question: string): Decision {
  const words = text();
  const choices = getLegalActions(s).map((action, index) => ({
    id: String(index + 1),
    text: describeAction(s, action, player),
    action,
  }));
  const ids = choices.map((choice) => choice.id);
  const schema = z.object({
    reason: reason(),
    choice: z.enum(ids as [string, ...string[]]).describe(words.choiceId),
  });
  return {
    kind,
    question,
    options: choices.map((choice) => `${choice.id}: ${choice.text}`),
    answer: words.choiceAnswer,
    schema,
    toAction(answer) {
      const { choice } = schema.parse(answer);
      const picked = choices.find((candidate) => candidate.id === choice);
      if (!picked) throw new DecisionError(words.notAnOption(choice));
      return picked.action;
    },
  };
}

function attackersDecision(s: GameState, player: PlayerId): Decision {
  const words = text();
  const eligible = eligibleAttackers(s);
  const shape = Object.fromEntries(eligible.map((id) => [id, z.boolean().describe(creatureLine(s, id))]));
  const schema = z.object({
    reason: reason(),
    attack: z.object(shape).describe(words.attackShape),
  });
  const untapped = creaturesOf(s, opponent(player)).filter((id) => !getCard(s, id).tapped);
  return {
    kind: 'declareAttackers',
    question: words.attackQuestion(untapped.length, untapped.map((id) => `${creatureLine(s, id)} (${id})`).join('; ')),
    options: eligible.map((id) => `${id}: ${creatureLine(s, id)}`),
    answer: words.attackAnswer,
    schema,
    toAction(answer) {
      const { attack } = schema.parse(answer);
      return { type: 'declareAttackers', player, attackers: eligible.filter((id) => attack[id] === true) };
    },
  };
}

function blockersDecision(s: GameState, player: PlayerId): Decision {
  const words = text();
  const options = blockOptions(s);
  const blockers = Object.keys(options);
  const shape = Object.fromEntries(
    blockers.map((id) => [id, z.enum(['none', ...(options[id] ?? [])] as [string, ...string[]]).describe(words.blockerShape(creatureLine(s, id)))]),
  );
  const schema = z.object({
    reason: reason(),
    blocks: z.object(shape).describe(words.blocksShape),
  });
  const attackers = s.combat?.attackers ?? [];
  return {
    kind: 'declareBlockers',
    question: words.blockQuestion(attackers.map((id) => `${creatureLine(s, id)} (${id})`).join('; ')),
    options: blockers.map((id) => words.blockOption(id, creatureLine(s, id), (options[id] ?? []).join(', '))),
    answer: words.blockAnswer,
    schema,
    toAction(answer) {
      const parsed = schema.parse(answer).blocks;
      const blocks = blockers
        .filter((id) => parsed[id] !== undefined && parsed[id] !== 'none')
        .map((id) => ({ blocker: id, attacker: parsed[id] as CardId }));
      const error = blocksError(s, blocks);
      if (error) throw new DecisionError(refusalText(error));
      return { type: 'declareBlockers', player, blocks };
    },
  };
}

function discardQuestion(s: GameState, player: PlayerId, amount: number, source: CardId | undefined): string {
  const words = text();
  if (source === undefined) return words.cleanupDiscard(amount);
  const what = getCard(s, source).controller === player ? words.yourSource(cardName(s, source)) : words.opponentSource(cardName(s, source));
  return words.forcedDiscard(what, amount);
}

function cardsDecision(kind: 'bottom' | 'discard', s: GameState, player: PlayerId, amount: number, source?: CardId): Decision {
  const words = text();
  const hand = s.players[player].hand;
  const schema = z.object({
    reason: reason(),
    cards: z.array(z.enum(hand as [string, ...string[]])).describe(words.cardsShape(amount)),
  });
  const question = kind === 'bottom' ? words.bottomQuestion(s.players[player].mulligans, amount) : discardQuestion(s, player, amount, source);
  return {
    kind,
    question,
    options: hand.map((id) => `${id}: ${cardName(s, id)}`),
    answer: words.cardsAnswer(amount),
    schema,
    toAction(answer) {
      const cards = [...new Set(schema.parse(answer).cards)];
      if (cards.length !== amount) throw new DecisionError(words.wrongCardCount(amount, cards.length));
      return { type: kind, player, cards };
    },
  };
}

export function decisionFor(s: GameState, player: PlayerId): Decision {
  const pending = pendingOf(s, player);
  switch (pending.kind) {
    case 'mulligan':
      return pickDecision('mulligan', s, player, text().mulliganQuestion(s.players[player].mulligans));
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
