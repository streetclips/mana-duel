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
  isPlayerTarget,
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

const REASON = z.string().describe('Tu razonamiento, en español y en una o dos frases cortas.');

function pendingOf(s: GameState, player: PlayerId): Exclude<PendingDecision, { kind: 'gameOver' }> {
  const pending = s.pending;
  if (!pending || pending.kind === 'gameOver') throw new Error('la partida no está esperando ninguna decisión');
  if (pending.player !== player) throw new Error(`no le toca decidir al jugador ${player}`);
  return pending;
}

function count(amount: number, one: string, many: string): string {
  return `${amount} ${amount === 1 ? one : many}`;
}

function creatureLine(s: GameState, id: CardId): string {
  const keywords = getKeywords(s, id).map((keyword) => KEYWORD_NAMES[keyword]);
  const stats = `${getPower(s, id)}/${getToughness(s, id)}`;
  return `${cardName(s, id)} ${stats}${keywords.length ? `, ${keywords.join(', ')}` : ''}`;
}

function objectLabel(s: GameState, target: Target, viewer: PlayerId): string {
  if (isPlayerTarget(target) && target.player === viewer) return 'ti';
  return targetLabel(s, target, viewer);
}

function targetsSuffix(s: GameState, targets: Target[], viewer: PlayerId): string {
  if (targets.length === 0) return '';
  return ` sobre ${targets.map((target) => objectLabel(s, target, viewer)).join(' y ')}`;
}

function passText(s: GameState): string {
  if (s.stack.length > 0) return 'Pasar la prioridad: no respondes; lo que está en lo alto de la pila se resuelve cuando los dos jugadores pasan';
  if (s.step === 'end') return 'Pasar la prioridad: no haces nada más este turno';
  return `Pasar la prioridad: no haces nada ahora; cuando los dos jugadores pasen, la partida avanza a: ${STEP_NAMES[nextStepOf(s)]}`;
}

function cardList(s: GameState, ids: CardId[]): string {
  return ids.map((id) => `${cardName(s, id)} (${id})`).join(', ');
}

export function describeAction(s: GameState, action: Action, viewer: PlayerId): string {
  switch (action.type) {
    case 'keep': {
      const ps = s.players[action.player];
      const bottom = ps.mulligans > 0 ? ` y luego poner ${count(ps.mulligans, 'carta', 'cartas')} de ella en el fondo` : '';
      return `Quedarte con esta mano de ${ps.hand.length} cartas${bottom}`;
    }
    case 'mulligan':
      return `Mulligan: barajar esta mano, robar una mano nueva de 7 y poner ${count(s.players[action.player].mulligans + 1, 'carta', 'cartas')} en el fondo`;
    case 'pass':
      return passText(s);
    case 'playLand':
      return `Jugar la tierra ${cardName(s, action.card)} (${action.card})`;
    case 'cast': {
      const def = getCardDef(getCard(s, action.card).def);
      return `Lanzar ${def.name} (${action.card}) por ${formatCost(getCost(def.id))}${targetsSuffix(s, action.targets, viewer)}`;
    }
    case 'activate': {
      const def = getCardDef(getCard(s, action.card).def);
      return `Activar ${cardLabel(s, action.card, viewer)}: "${activatedText(def, action.ability)}"${targetsSuffix(s, action.targets, viewer)}`;
    }
    case 'chooseTargets':
      return `Objetivo: ${action.targets.map((target) => targetLabel(s, target, viewer)).join(' y ')}`;
    case 'declareAttackers':
      return action.attackers.length === 0 ? 'No atacar con nada' : `Atacar con ${cardList(s, action.attackers)}`;
    case 'declareBlockers':
      return action.blocks.length === 0
        ? 'No bloquear'
        : `Bloquear: ${action.blocks.map((block) => `${cardName(s, block.blocker)} (${block.blocker}) bloquea a ${cardName(s, block.attacker)} (${block.attacker})`).join(', ')}`;
    case 'bottom':
      return `Poner ${cardList(s, action.cards)} en el fondo`;
    case 'discard':
      return `Descartar ${cardList(s, action.cards)}`;
    case 'concede':
      return 'Rendirte';
  }
}

function priorityQuestion(s: GameState, player: PlayerId): string {
  const whose = s.activePlayer === player ? 'tu turno' : 'el turno del rival';
  const top = s.stack.at(-1);
  if (top) {
    const source = top.kind === 'spell' ? top.card : top.source;
    const what = top.controller === player ? `tu ${cardName(s, source)}` : `${cardName(s, source)} del rival`;
    return `Tienes la prioridad en ${whose}, paso: ${STEP_NAMES[s.step]}. En lo alto de la pila está ${what}: puedes responder o dejar que se resuelva.`;
  }
  return `Tienes la prioridad en ${whose}, paso: ${STEP_NAMES[s.step]}, con la pila vacía.`;
}

function triggerQuestion(s: GameState, trigger: string): string {
  const pending = s.triggers.find((candidate) => candidate.id === trigger);
  if (!pending) return 'Elige los objetivos de una habilidad disparada.';
  const def = getCardDef(getCard(s, pending.source).def);
  return `Se ha disparado tu ${def.name} (${pending.source}): "${triggerText(def, pending.ability)}" Elige sus objetivos.`;
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
    choice: z.enum(ids as [string, ...string[]]).describe('El id de la opción que eliges.'),
  });
  return {
    kind,
    question,
    options: choices.map((choice) => `${choice.id}: ${choice.text}`),
    answer: 'Responde con "choice": el id de exactamente una opción.',
    schema,
    toAction(answer) {
      const { choice } = schema.parse(answer);
      const picked = choices.find((candidate) => candidate.id === choice);
      if (!picked) throw new DecisionError(`"${choice}" no es una de las opciones de la lista`);
      return picked.action;
    },
  };
}

function attackersDecision(s: GameState, player: PlayerId): Decision {
  const eligible = eligibleAttackers(s);
  const shape = Object.fromEntries(eligible.map((id) => [id, z.boolean().describe(creatureLine(s, id))]));
  const schema = z.object({
    reason: REASON,
    attack: z.object(shape).describe('Para cada criatura que puede atacar: true para atacar con ella, false para dejarla atrás.'),
  });
  const untapped = creaturesOf(s, opponent(player)).filter((id) => !getCard(s, id).tapped);
  return {
    kind: 'declareAttackers',
    question: `Declara las atacantes. El rival tiene ${count(untapped.length, 'criatura enderezada', 'criaturas enderezadas')} que ${untapped.length === 1 ? 'podría' : 'podrían'} bloquear${untapped.length ? `: ${untapped.map((id) => `${creatureLine(s, id)} (${id})`).join('; ')}` : ''}.`,
    options: eligible.map((id) => `${id}: ${creatureLine(s, id)}`),
    answer: 'Responde con "attack": un objeto con el id de cada criatura de la lista a true (ataca) o false (se queda atrás).',
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
      z.enum(['none', ...(options[id] ?? [])] as [string, ...string[]]).describe(`${creatureLine(s, id)}: el id de la atacante a la que bloquea, o "none"`),
    ]),
  );
  const schema = z.object({
    reason: REASON,
    blocks: z.object(shape).describe('Para cada una de tus criaturas que puede bloquear: la atacante a la que bloquea, o "none".'),
  });
  const attackers = s.combat?.attackers ?? [];
  return {
    kind: 'declareBlockers',
    question: `El rival ataca con ${attackers.map((id) => `${creatureLine(s, id)} (${id})`).join('; ')}. Declara las bloqueadoras: cada una de tus criaturas bloquea como mucho a una atacante, y varias pueden bloquear a la misma atacante.`,
    options: blockers.map((id) => `${id}: ${creatureLine(s, id)} — puede bloquear a ${(options[id] ?? []).join(', ')}`),
    answer: 'Responde con "blocks": un objeto que asigne a cada id de bloqueadora de la lista el id de la atacante a la que bloquea, o "none".',
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

function discardQuestion(s: GameState, player: PlayerId, amount: number, source: CardId | undefined): string {
  if (source === undefined) return `Limpieza: tienes más de 7 cartas en la mano. Descarta ${count(amount, 'carta', 'cartas')}.`;
  const what = getCard(s, source).controller === player ? `Tu ${cardName(s, source)}` : `${cardName(s, source)} del rival`;
  return `${what} te obliga a descartar ${count(amount, 'carta', 'cartas')}: elige cuáles.`;
}

function cardsDecision(kind: 'bottom' | 'discard', s: GameState, player: PlayerId, amount: number, source?: CardId): Decision {
  const hand = s.players[player].hand;
  const schema = z.object({
    reason: REASON,
    cards: z.array(z.enum(hand as [string, ...string[]])).describe(`Exactamente ${count(amount, 'id de carta', 'ids de carta')} de tu mano.`),
  });
  const question =
    kind === 'bottom'
      ? `Te has quedado la mano tras ${count(s.players[player].mulligans, 'mulligan', 'mulligans')}: pon ${count(amount, 'carta', 'cartas')} de tu mano en el fondo de tu biblioteca.`
      : discardQuestion(s, player, amount, source);
  return {
    kind,
    question,
    options: hand.map((id) => `${id}: ${cardName(s, id)}`),
    answer: `Responde con "cards": exactamente ${count(amount, 'id de carta', 'ids de carta')} de la lista.`,
    schema,
    toAction(answer) {
      const cards = [...new Set(schema.parse(answer).cards)];
      if (cards.length !== amount) throw new DecisionError(`elige exactamente ${count(amount, 'carta distinta', 'cartas distintas')} de tu mano, no ${cards.length}`);
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
        `Mano inicial: ¿te la quedas o haces mulligan? Llevas ${count(s.players[player].mulligans, 'mulligan', 'mulligans')}.`,
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
