import { formatCost } from './mana';
import { getCardDef, getCost } from './registry';
import { EVOLVE_TRIGGER, UNDYING_TRIGGER, getCard, getPower, getToughness, isCreatureDef } from './state';
import { isPlayerTarget } from './targets';
import type {
  CardDef,
  CardId,
  Color,
  Effect,
  EffectTarget,
  GameEvent,
  GameState,
  Keyword,
  PlayerId,
  Step,
  Target,
  TargetSpec,
  TriggerCondition,
  TriggerEvent,
} from './types';

export const KEYWORD_NAMES: Record<Keyword, string> = {
  flying: 'Flying',
  reach: 'Reach',
  haste: 'Haste',
  vigilance: 'Vigilance',
  trample: 'Trample',
  firstStrike: 'First strike',
  doubleStrike: 'Double strike',
  deathtouch: 'Deathtouch',
  lifelink: 'Lifelink',
  menace: 'Menace',
  defender: 'Defender',
  flash: 'Flash',
  skulk: 'Skulk',
  undying: 'Undying',
  hexproof: 'Hexproof',
  evolve: 'Evolve',
};

export const KEYWORD_REMINDERS: Record<Keyword, string> = {
  flying: "Can't be blocked except by creatures with flying or reach.",
  reach: 'Can block creatures with flying.',
  haste: 'Can attack and {T} as soon as it comes under your control.',
  vigilance: "Attacking doesn't cause it to tap.",
  trample: 'Combat damage beyond what is lethal to its blockers is dealt to the defending player.',
  firstStrike: 'Deals combat damage before creatures without first strike.',
  doubleStrike: 'Deals both first-strike and regular combat damage.',
  deathtouch: 'Any amount of damage it deals to a creature is enough to destroy it.',
  lifelink: 'Damage dealt by it also causes its controller to gain that much life.',
  menace: "Can't be blocked except by two or more creatures.",
  defender: "Can't attack.",
  flash: 'You may cast it any time you could cast an instant.',
  skulk: "Can't be blocked by creatures with greater power.",
  undying: 'When it dies, if it had no +1/+1 counters on it, it returns to the battlefield with a +1/+1 counter on it.',
  hexproof: "Can't be the target of spells or abilities your opponents control.",
  evolve: 'Gets a +1/+1 counter whenever another creature with greater power or toughness enters under your control.',
};

export const STEP_NAMES: Record<Step, string> = {
  mulligan: 'Opening hand',
  untap: 'Untap',
  upkeep: 'Upkeep',
  draw: 'Draw',
  main1: 'Main phase',
  beginCombat: 'Beginning of combat',
  declareAttackers: 'Declare attackers',
  declareBlockers: 'Declare blockers',
  firstStrikeDamage: 'First-strike damage',
  combatDamage: 'Combat damage',
  endCombat: 'End of combat',
  main2: 'Second main phase',
  end: 'End step',
  cleanup: 'Cleanup',
};

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

export function formatModifier(power: number, toughness: number): string {
  return `${signed(power)}/${signed(toughness)}`;
}

export function typeLine(def: CardDef): string {
  const main = [...(def.token ? ['Token'] : []), ...(def.supertypes ?? []), ...def.types.map(capitalize)].join(' ');
  return def.subtypes?.length ? `${main} — ${def.subtypes.join(' ')}` : main;
}

const COLOR_WORDS: Record<Color, string> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };

function andList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

export function keywordList(keywords: readonly Keyword[]): string {
  return andList(keywords.map((keyword) => lowerFirst(KEYWORD_NAMES[keyword])));
}

export function formatPump(power: number, toughness: number, keywords: readonly Keyword[] = []): string {
  if (keywords.length === 0) return formatModifier(power, toughness);
  if (power === 0 && toughness === 0) return keywordList(keywords);
  return `${formatModifier(power, toughness)}, ${keywordList(keywords)}`;
}

export function tokenDescription(defId: string, amount = 1): string {
  const token = getCardDef(defId);
  const colors = token.colors?.length ? andList(token.colors.map((color) => COLOR_WORDS[color])) : 'colorless';
  const noun = [...(token.subtypes ?? []), 'creature', amount === 1 ? 'token' : 'tokens'].join(' ');
  const keywords = token.keywords?.length ? ` with ${keywordList(token.keywords)}` : '';
  return `${token.power}/${token.toughness} ${colors} ${noun}${keywords}`;
}

export function targetPhrase(spec: TargetSpec): string {
  switch (spec.kind) {
    case 'any':
      return 'any target';
    case 'creature': {
      const noun = spec.tapped ? 'tapped creature' : 'creature';
      if (spec.controller === 'you') return `target ${noun} you control`;
      if (spec.controller === 'opponent') return `target ${noun} you don't control`;
      return `target ${noun}`;
    }
    case 'player':
      if (spec.controller === 'opponent') return 'target opponent';
      if (spec.controller === 'you') return 'you';
      return 'target player';
    case 'spell':
      return 'target spell';
  }
}

function countWord(amount: number): string {
  return NUMBER_WORDS[amount] ?? String(amount);
}

function plusCounters(amount: number): string {
  return amount === 1 ? 'a +1/+1 counter' : `${countWord(amount)} +1/+1 counters`;
}

export function countersLabel(count: number): string {
  return count === 1 ? '+1/+1 counter' : `${count} +1/+1 counters`;
}

function gainsText(verb: 'get' | 'gets', power: number, toughness: number, keywords: readonly Keyword[] = []): string {
  const gain = verb === 'gets' ? 'gains' : 'gain';
  if (keywords.length === 0) return `${verb} ${formatModifier(power, toughness)}`;
  if (power === 0 && toughness === 0) return `${gain} ${keywordList(keywords)}`;
  return `${verb} ${formatModifier(power, toughness)} and ${gain} ${keywordList(keywords)}`;
}

function cardsCount(amount: number): string {
  return amount === 1 ? 'a card' : `${countWord(amount)} cards`;
}

interface SentenceContext {
  subject: string;
  on?: TriggerEvent;
}

function effectSentence(effect: Effect, ref: (target: EffectTarget) => string, context: SentenceContext): string {
  const subject = context.subject;
  switch (effect.kind) {
    case 'damage':
      return `${subject} deals ${effect.amount} damage to ${ref(effect.to)}.`;
    case 'pump':
      return `${capitalize(ref(effect.to))} ${gainsText('gets', effect.power, effect.toughness, effect.keywords)} until end of turn.`;
    case 'destroy':
      return `Destroy ${ref(effect.to)}.`;
    case 'bounce':
      return `Return ${ref(effect.to)} to its owner's hand.`;
    case 'counter':
      return `Counter ${ref(effect.to)}.`;
    case 'draw':
      return effect.amount === 1 ? 'Draw a card.' : `Draw ${countWord(effect.amount)} cards.`;
    case 'gainLife':
      return `You gain ${effect.amount} life.`;
    case 'loseLife':
      return effect.who === 'opponent' ? `Each opponent loses ${effect.amount} life.` : `You lose ${effect.amount} life.`;
    case 'fight':
      return `${capitalize(ref(effect.a))} fights ${ref(effect.b)}.`;
    case 'bite':
      return `${capitalize(ref(effect.a))} deals damage equal to its power to ${ref(effect.b)}.`;
    case 'pumpTeam':
      return `Creatures you control ${gainsText('get', effect.power, effect.toughness, effect.keywords)} until end of turn.`;
    case 'addCounters':
      return `Put ${plusCounters(effect.amount)} on ${ref(effect.to)}.`;
    case 'addCountersTeam':
      return `Put ${plusCounters(effect.amount)} on each creature you control.`;
    case 'createTokens':
      return `Create ${effect.amount === 1 ? 'a' : countWord(effect.amount)} ${tokenDescription(effect.token, effect.amount)}.`;
    case 'discard':
      if (effect.who !== 'opponent') return `Discard ${cardsCount(effect.amount)}.`;
      if (context.on === 'damagesPlayer') return `That player discards ${cardsCount(effect.amount)}.`;
      return `Each opponent discards ${cardsCount(effect.amount)}.`;
    case 'returnToBattlefield':
      return `Return it to the battlefield under its owner's control with ${plusCounters(effect.counters)} on it.`;
  }
}

function sentences(effects: Effect[], specs: TargetSpec[], context: SentenceContext, self: string): string {
  const named = new Set<number>();
  const ref = (target: EffectTarget): string => {
    if (target === 'self') return self;
    const spec = specs[target];
    if (!spec || named.has(target)) return 'it';
    named.add(target);
    return targetPhrase(spec);
  };
  const lines: string[] = [];
  effects.forEach((effect, index) => {
    const previous = effects[index - 1];
    if (effect.kind === 'damage' && previous?.kind === 'damage' && lines.length > 0) {
      lines.push(`${(lines.pop() as string).replace(/\.$/, '')} and ${effect.amount} damage to ${ref(effect.to)}.`);
      return;
    }
    const text = effectSentence(effect, ref, context);
    if (effect.kind === 'discard' && effect.who !== 'opponent' && previous?.kind === 'draw' && lines.length > 0) {
      lines.push(`${(lines.pop() as string).replace(/\.$/, '')}, then ${lowerFirst(text)}`);
    } else lines.push(text);
  });
  return lines.join(' ');
}

const TRIGGER_OPENERS: Record<TriggerEvent, string> = {
  enters: 'When this creature enters',
  dies: 'When this creature dies',
  attacks: 'Whenever this creature attacks',
  spell: 'Whenever you cast an instant or sorcery spell',
  allyEnters: 'Whenever another creature you control enters',
  allyDies: 'Whenever another creature you control dies',
  damagesPlayer: 'Whenever this creature deals combat damage to a player',
  lifeGain: 'Whenever you gain life',
};

const TRIGGER_CONDITIONS: Record<TriggerCondition, string> = {
  opponentDamaged: 'if an opponent was dealt damage this turn',
};

const SELF_AS_THIS_CREATURE: ReadonlySet<TriggerEvent> = new Set(['allyEnters', 'allyDies', 'lifeGain']);

export function rulesText(def: CardDef): string[] {
  const lines: string[] = [];
  if (def.keywords?.length) {
    lines.push(def.keywords.map((keyword, i) => (i === 0 ? KEYWORD_NAMES[keyword] : lowerFirst(KEYWORD_NAMES[keyword]))).join(', '));
  }
  if (def.mana?.length) {
    lines.push(`{T}: Add ${def.mana.map((color) => `{${color}}`).join(' or ')}.`);
  }
  if (def.spell) {
    lines.push(sentences(def.spell.effects, def.spell.targets, { subject: def.name }, 'it'));
  }
  (def.triggers ?? []).forEach((_, index) => lines.push(triggerText(def, index)));
  (def.activated ?? []).forEach((_, index) => lines.push(activatedText(def, index)));
  return lines;
}

export function triggerText(def: CardDef, index: number): string {
  if (index === UNDYING_TRIGGER) {
    return `${TRIGGER_OPENERS.dies}, if it had no +1/+1 counters on it, return it to the battlefield under its owner's control with a +1/+1 counter on it.`;
  }
  if (index === EVOLVE_TRIGGER) {
    return `${TRIGGER_OPENERS.allyEnters}, if it has greater power or toughness than this creature, put a +1/+1 counter on this creature.`;
  }
  const trigger = def.triggers?.[index];
  if (!trigger) return '';
  const self = SELF_AS_THIS_CREATURE.has(trigger.on) ? 'this creature' : 'it';
  const condition = trigger.condition ? `${TRIGGER_CONDITIONS[trigger.condition]}, ` : '';
  return `${TRIGGER_OPENERS[trigger.on]}, ${condition}${lowerFirst(sentences(trigger.effects, trigger.targets, { subject: self, on: trigger.on }, self))}`;
}

export function activatedText(def: CardDef, index: number): string {
  const ability = def.activated?.[index];
  if (!ability) return '';
  const cost = [
    ability.cost && ability.cost !== '{0}' ? ability.cost : '',
    ability.tap ? '{T}' : '',
    ability.sacrifice ? 'Sacrifice this creature' : '',
  ]
    .filter(Boolean)
    .join(', ');
  const subject = ability.sacrifice ? 'It' : 'This creature';
  return `${cost}: ${sentences(ability.effects, ability.targets, { subject }, 'this creature')}`;
}

export function cardSummary(defId: string): string {
  const def = getCardDef(defId);
  const parts = [def.name];
  if (def.cost) parts.push(formatCost(getCost(defId)));
  parts.push(typeLine(def));
  if (isCreatureDef(def)) parts.push(`${def.power}/${def.toughness}`);
  const text = rulesText(def);
  if (text.length) parts.push(text.join(' '));
  return parts.join(' · ');
}

export function playerLabel(s: GameState, player: PlayerId, viewer: PlayerId): string {
  return player === viewer ? 'you' : s.players[player].name;
}

export function cardName(s: GameState, id: CardId): string {
  const card = s.cards[id];
  return card ? getCardDef(card.def).name : id;
}

export interface CardMention {
  card: CardId;
  name: string;
}

export type TextPart = string | CardMention;

type TextPiece = TextPart | TextPart[] | number;

export function plainText(parts: readonly TextPart[]): string {
  return parts.map((part) => (typeof part === 'string' ? part : part.name)).join('');
}

function line(literals: TemplateStringsArray, ...pieces: TextPiece[]): TextPart[] {
  const parts: TextPart[] = [];
  const add = (part: TextPart): void => {
    const last = parts.at(-1);
    if (typeof part === 'string' && typeof last === 'string') parts[parts.length - 1] = last + part;
    else if (part !== '') parts.push(part);
  };
  literals.forEach((literal, index) => {
    add(literal);
    const piece = pieces[index];
    if (piece === undefined) return;
    if (Array.isArray(piece)) piece.forEach(add);
    else add(typeof piece === 'number' ? String(piece) : piece);
  });
  return parts;
}

function joined(items: (TextPart | TextPart[])[], separator: string): TextPart[] {
  return items.flatMap((item, index) => [...(index === 0 ? [] : [separator]), ...(Array.isArray(item) ? item : [item])]);
}

function capitalizeParts(parts: TextPart[]): TextPart[] {
  const [first, ...rest] = parts;
  return typeof first === 'string' ? [capitalize(first), ...rest] : parts;
}

function mention(s: GameState, id: CardId): TextPart {
  const card = s.cards[id];
  return card ? { card: id, name: getCardDef(card.def).name } : id;
}

function cardRefParts(s: GameState, id: CardId, viewer: PlayerId): TextPart[] {
  const card = s.cards[id];
  if (!card) return [id];
  const whose = card.controller === viewer ? 'your' : `${s.players[card.controller].name}'s`;
  return line`${whose} ${mention(s, id)}`;
}

export function cardRef(s: GameState, id: CardId, viewer: PlayerId): string {
  return plainText(cardRefParts(s, id, viewer));
}

function targetRefParts(s: GameState, target: Target, viewer: PlayerId): TextPart[] {
  return isPlayerTarget(target) ? [playerLabel(s, target.player, viewer)] : cardRefParts(s, target.card, viewer);
}

export function targetRef(s: GameState, target: Target, viewer: PlayerId): string {
  return plainText(targetRefParts(s, target, viewer));
}

function verb(s: GameState, player: PlayerId, viewer: PlayerId, base: string, third?: string): string {
  const subject = capitalize(playerLabel(s, player, viewer));
  return `${subject} ${player === viewer ? base : (third ?? `${base}s`)}`;
}

function targetsSuffix(s: GameState, targets: Target[], viewer: PlayerId): TextPart[] {
  if (targets.length === 0) return [];
  return line` targeting ${joined(targets.map((target) => targetRefParts(s, target, viewer)), ' and ')}`;
}

export function describeEvent(s: GameState, event: GameEvent, viewer: PlayerId): string | null {
  const parts = describeEventParts(s, event, viewer);
  return parts && plainText(parts);
}

export function describeEventParts(s: GameState, event: GameEvent, viewer: PlayerId): TextPart[] | null {
  switch (event.t) {
    case 'start':
      return line`${verb(s, event.startingPlayer, viewer, 'go', 'goes')} first.`;
    case 'mulligan':
      return line`${verb(s, event.player, viewer, 'take')} a mulligan (${event.count}).`;
    case 'keep':
      return line`${verb(s, event.player, viewer, 'keep')} ${event.handSize} cards.`;
    case 'bottom':
      return line`${verb(s, event.player, viewer, 'put')} ${event.count} card${event.count === 1 ? '' : 's'} on the bottom.`;
    case 'turn':
      return line`Turn ${event.turn} — ${event.player === viewer ? 'your turn' : `${s.players[event.player].name}'s turn`}.`;
    case 'draw':
      return event.player === viewer
        ? line`You draw ${mention(s, event.card)}.`
        : line`${capitalize(playerLabel(s, event.player, viewer))} draws a card.`;
    case 'drawEmpty':
      return line`${capitalize(playerLabel(s, event.player, viewer))} can't draw: the library is empty.`;
    case 'land':
      return line`${verb(s, event.player, viewer, 'play')} ${mention(s, event.card)}.`;
    case 'cast':
      return line`${verb(s, event.player, viewer, 'cast')} ${mention(s, event.card)}${targetsSuffix(s, event.targets, viewer)}.`;
    case 'activate':
      return line`${verb(s, event.player, viewer, 'activate')} ${cardRefParts(s, event.card, viewer)}${targetsSuffix(s, event.targets, viewer)}.`;
    case 'trigger':
      return line`${capitalizeParts(cardRefParts(s, event.card, viewer))} triggers${targetsSuffix(s, event.targets, viewer)}.`;
    case 'fizzle': {
      const source = event.item.kind === 'spell' ? event.item.card : event.item.source;
      return line`${mention(s, source)} fizzles: its targets are gone.`;
    }
    case 'counter':
      return line`${capitalizeParts(cardRefParts(s, event.card, viewer))} is countered.`;
    case 'bounce':
      return line`${mention(s, event.card)} returns to ${event.player === viewer ? 'your' : `${s.players[event.player].name}'s`} hand.`;
    case 'attack':
      if (event.attackers.length === 0) return null;
      return line`${verb(s, event.player, viewer, 'attack')} with ${joined(event.attackers.map((id) => mention(s, id)), ', ')}.`;
    case 'block':
      if (event.blocks.length === 0) return line`${verb(s, event.player, viewer, "don't", "doesn't")} block.`;
      return line`${verb(s, event.player, viewer, 'block')}: ${joined(
        event.blocks.map((block) => line`${mention(s, block.blocker)} → ${mention(s, block.attacker)}`),
        ', ',
      )}.`;
    case 'damage':
      return line`${capitalizeParts(cardRefParts(s, event.source, viewer))} deals ${event.amount} damage to ${targetRefParts(s, event.target, viewer)}.`;
    case 'life':
      return event.delta > 0 ? line`${verb(s, event.player, viewer, 'gain')} ${event.delta} life (${event.life}).` : null;
    case 'loseLife':
      return line`${verb(s, event.player, viewer, 'lose')} ${event.amount} life.`;
    case 'pump':
      return line`${capitalizeParts(cardRefParts(s, event.card, viewer))} ${gainsText('gets', event.power, event.toughness, event.keywords)} until end of turn.`;
    case 'create':
      return line`${verb(s, event.player, viewer, 'create')} a ${mention(s, event.card)} token.`;
    case 'return':
      return line`${capitalizeParts(cardRefParts(s, event.card, viewer))} returns to the battlefield.`;
    case 'addCounters':
      return line`${capitalizeParts(cardRefParts(s, event.card, viewer))} gets ${event.amount === 1 ? 'a +1/+1 counter' : `${event.amount} +1/+1 counters`}.`;
    case 'fight':
      return line`${capitalizeParts(cardRefParts(s, event.a, viewer))} fights ${cardRefParts(s, event.b, viewer)}.`;
    case 'bite':
      return null;
    case 'dies':
      return line`${capitalizeParts(cardRefParts(s, event.card, viewer))} dies.`;
    case 'discard':
      return line`${verb(s, event.player, viewer, 'discard')} ${mention(s, event.card)}.`;
    case 'concede':
      return line`${verb(s, event.player, viewer, 'concede')}.`;
    case 'gameOver':
      if (event.winner === null) return line`The game is a draw.`;
      return event.winner === viewer ? line`You win!` : line`${s.players[event.winner].name} wins.`;
    case 'resolve':
    case 'enter':
      return null;
  }
}

function permanentLabel(s: GameState, id: CardId): string {
  const card = getCard(s, id);
  const def = getCardDef(card.def);
  const flags: string[] = [];
  if (card.tapped) flags.push('tapped');
  if (card.summoningSick && isCreatureDef(def)) flags.push('sick');
  if (card.damage > 0) flags.push(`${card.damage} dmg`);
  if (card.counters > 0) flags.push(countersLabel(card.counters));
  if (s.combat?.attackers.includes(id)) flags.push('attacking');
  const block = s.combat?.blocks.find((candidate) => candidate.blocker === id);
  if (block) flags.push(`blocking ${block.attacker}`);
  const stats = isCreatureDef(def) ? ` ${getPower(s, id)}/${getToughness(s, id)}` : '';
  return `${def.name}(${id})${stats}${flags.length ? ` [${flags.join(', ')}]` : ''}`;
}

export function describeState(s: GameState, viewer: PlayerId = 0, revealAll = false): string {
  const lines: string[] = [];
  lines.push(`Turn ${s.turn} · ${STEP_NAMES[s.step]} · active: ${s.players[s.activePlayer].name} (p${s.activePlayer})`);
  for (const player of [viewer, viewer === 0 ? 1 : 0] as PlayerId[]) {
    const ps = s.players[player];
    const showHand = revealAll || player === viewer;
    const hand = showHand ? ps.hand.map((id) => `${cardName(s, id)}(${id})`).join(', ') : `${ps.hand.length} cards`;
    lines.push(`${ps.name} (p${player}): ${ps.life} life · library ${ps.library.length} · graveyard ${ps.graveyard.length}`);
    lines.push(`  hand: ${hand || '—'}`);
    lines.push(`  battlefield: ${ps.battlefield.map((id) => permanentLabel(s, id)).join(', ') || '—'}`);
  }
  const stack = [...s.stack]
    .reverse()
    .map((item) => {
      const source = item.kind === 'spell' ? item.card : item.source;
      const label = item.kind === 'spell' ? cardName(s, source) : `${cardName(s, source)} ability`;
      return `${label}${plainText(targetsSuffix(s, item.targets, viewer))}`;
    })
    .join(' ← ');
  lines.push(`stack: ${stack || '—'}`);
  const pending = s.pending;
  if (pending) {
    const who = pending.kind === 'gameOver' ? '' : ` (${s.players[pending.player].name})`;
    lines.push(`waiting for: ${pending.kind}${who}`);
  }
  return lines.join('\n');
}
