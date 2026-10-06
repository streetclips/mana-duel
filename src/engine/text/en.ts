import { count, plural } from '../../i18n/plural';
import { getCardDef } from '../registry';
import type { Refusal } from '../refusals';
import { isPlayerTarget } from '../targets';
import {
  COLORS,
  type CardDef,
  type CardId,
  type CardType,
  type Color,
  type Effect,
  type GameEvent,
  type GameState,
  type Keyword,
  type PlayerId,
  type Step,
  type Target,
  type TargetSpec,
  type TriggerCondition,
  type TriggerEvent,
} from '../types';
import { capitalizeParts, formatModifier, joined, line, lowerFirst, mention, type TextPart } from './parts';
import {
  activatedText,
  describeState,
  rulesText,
  triggerText,
  type RulesGrammar,
  type SentenceContext,
  type StateWords,
  type TargetRef,
} from './shared';
import type { EngineText } from './types';

const KEYWORD_NAMES: Record<Keyword, string> = {
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
  prowess: 'Prowess',
};

const KEYWORD_REMINDERS: Record<Keyword, string> = {
  flying: "Can't be blocked except by creatures with flying or reach.",
  reach: 'Can block creatures with flying.',
  haste: 'Can attack and {T} as soon as it comes under your control.',
  vigilance: "Attacking doesn't cause it to tap.",
  trample: "Combat damage beyond what's lethal to its blockers is dealt to the defending player.",
  firstStrike: 'Deals combat damage before creatures without first strike.',
  doubleStrike: 'Deals both first-strike and regular combat damage.',
  deathtouch: 'Any amount of damage it deals to a creature is enough to destroy it.',
  lifelink: 'Damage it deals also causes its controller to gain that much life.',
  menace: "Can't be blocked except by two or more creatures.",
  defender: "Can't attack.",
  flash: 'You may cast it any time you could cast an instant.',
  skulk: "Can't be blocked by creatures with greater power.",
  undying: 'When it dies, if it had no +1/+1 counters on it, it returns to the battlefield with a +1/+1 counter on it.',
  hexproof: "Can't be the target of spells or abilities your opponents control.",
  evolve: 'Gets a +1/+1 counter whenever another creature with greater power or toughness enters under your control.',
  prowess: 'Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.',
};

const STEP_NAMES: Record<Step, string> = {
  mulligan: 'Opening hand',
  untap: 'Untap step',
  upkeep: 'Upkeep',
  draw: 'Draw step',
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

const TYPE_NAMES: Record<CardType, string> = {
  land: 'Land',
  creature: 'Creature',
  instant: 'Instant',
  sorcery: 'Sorcery',
  relic: 'Relic',
};

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

const COLOR_WORDS: Record<Color, string> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };

const OPPONENT = 'the opponent';

function article(next: string): string {
  return /^(?:[aeiou]|8|1[18]\b)/i.test(next) ? 'an' : 'a';
}

function withArticle(phrase: string): string {
  return `${article(phrase)} ${phrase}`;
}

function countWord(amount: number): string {
  return NUMBER_WORDS[amount] ?? String(amount);
}

function andList(items: string[], conjunction = 'and'): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items.at(-1)}`;
}

function joinedAnd(items: TextPart[][]): TextPart[] {
  const last = items.at(-1);
  if (!last || items.length === 1) return last ?? [];
  if (items.length === 2) return [...(items[0] ?? []), ' and ', ...last];
  return [...joined(items.slice(0, -1), ', '), ', and ', ...last];
}

function typeLine(def: CardDef): string {
  const words = [
    ...(def.supertypes ?? []),
    ...(def.token ? ['Token'] : []),
    ...def.types.map((type) => TYPE_NAMES[type]),
  ];
  const subtypes = (def.subtypes ?? []).join(' ');
  return subtypes ? `${words.join(' ')} — ${subtypes}` : words.join(' ');
}

function keywordList(keywords: readonly Keyword[]): string {
  return andList(keywords.map((keyword) => lowerFirst(KEYWORD_NAMES[keyword])));
}

function formatPump(power: number, toughness: number, keywords: readonly Keyword[]): string {
  if (keywords.length === 0) return formatModifier(power, toughness);
  if (power === 0 && toughness === 0) return keywordList(keywords);
  return `${formatModifier(power, toughness)}, ${keywordList(keywords)}`;
}

function tokenDescription(defId: string, amount: number): string {
  const token = getCardDef(defId);
  const colors = token.colors?.length ? andList(token.colors.map((color) => COLOR_WORDS[color])) : 'colorless';
  const subtypes = token.subtypes?.length ? ` ${token.subtypes.join(' ')}` : '';
  const keywords = token.keywords?.length ? ` with ${keywordList(token.keywords)}` : '';
  return `${token.power}/${token.toughness} ${colors}${subtypes} creature ${plural(amount, 'token', 'tokens')}${keywords}`;
}

function creatureNoun(spec: Extract<TargetSpec, { kind: 'creature' }>): string {
  const noun = spec.tapped ? 'target tapped creature' : 'target creature';
  if (spec.controller === 'you') return `${noun} you control`;
  if (spec.controller === 'opponent') return `${noun} you don't control`;
  return noun;
}

function targetPhrase(spec: TargetSpec): string {
  switch (spec.kind) {
    case 'any':
      return 'any target';
    case 'creature':
      return creatureNoun(spec);
    case 'player':
      if (spec.controller === 'opponent') return 'target opponent';
      if (spec.controller === 'you') return 'you';
      return 'target player';
    case 'spell':
      return 'target spell';
  }
}

function targetChoice(spec: TargetSpec): string {
  if (spec.kind === 'player' && spec.controller === 'you') return 'yourself';
  return targetPhrase(spec);
}

function repeatedPhrase(spec: TargetSpec): string {
  switch (spec.kind) {
    case 'creature':
      return 'that creature';
    case 'player':
      return 'that player';
    case 'spell':
      return 'that spell';
    case 'any':
      return 'that target';
  }
}

function plusCounters(amount: number): string {
  return amount === 1 ? 'a +1/+1 counter' : `${countWord(amount)} +1/+1 counters`;
}

function countersLabel(amount: number): string {
  return `${amount} +1/+1 ${plural(amount, 'counter', 'counters')}`;
}

function cardsCount(amount: number): string {
  return amount === 1 ? 'a card' : `${countWord(amount)} cards`;
}

function landCards(defId: string, amount: number): string {
  const def = getCardDef(defId);
  const kind = def.supertypes?.includes('Basic') ? `basic ${def.name}` : def.name;
  const cards = `${kind} ${plural(amount, 'card', 'cards')}`;
  return amount === 1 ? withArticle(cards) : `${countWord(amount)} ${cards}`;
}

function searchLandSentence(land: string, battlefield: number, hand: number, tapped: boolean): string {
  const search = `Search your library for ${landCards(land, battlefield + hand)}`;
  if (hand === 0) {
    const put = battlefield === 1 ? 'put it' : 'put them';
    return `${search}, ${put} onto the battlefield${tapped ? ' tapped' : ''}, then shuffle.`;
  }
  if (battlefield === 0)
    return `${search}, ${hand === 1 ? 'reveal it, put it' : 'reveal them, put them'} into your hand, then shuffle.`;
  return `${search}, put one onto the battlefield${tapped ? ' tapped' : ''} and the other into your hand, then shuffle.`;
}

function extraLandsText(amount: number): string {
  return amount === 1 ? 'an additional land' : `${countWord(amount)} additional lands`;
}

function damageAmount(amount: number): string {
  return `${amount} damage`;
}

function lifeAmount(amount: number): string {
  return `${amount} life`;
}

function gainsText(verb: 'gets' | 'get', power: number, toughness: number, keywords: readonly Keyword[] = []): string {
  const gain = verb === 'gets' ? 'gains' : 'gain';
  if (keywords.length === 0) return `${verb} ${formatModifier(power, toughness)}`;
  if (power === 0 && toughness === 0) return `${gain} ${keywordList(keywords)}`;
  return `${verb} ${formatModifier(power, toughness)} and ${gain} ${keywordList(keywords)}`;
}

function effectSentence(effect: Effect, ref: TargetRef, context: SentenceContext): string {
  switch (effect.kind) {
    case 'damage':
      return `${context.subject} deals ${damageAmount(effect.amount)} to ${ref(effect.to, 'object')}.`;
    case 'pump':
      return `${ref(effect.to, 'subject')} ${gainsText('gets', effect.power, effect.toughness, effect.keywords)} until end of turn.`;
    case 'destroy':
      return `Destroy ${ref(effect.to, 'object')}.`;
    case 'bounce':
      return `Return ${ref(effect.to, 'object')} to its owner's hand.`;
    case 'counter':
      return `Counter ${ref(effect.to, 'object')}.`;
    case 'draw':
      return `Draw ${cardsCount(effect.amount)}.`;
    case 'gainLife':
      return `You gain ${lifeAmount(effect.amount)}.`;
    case 'loseLife':
      return effect.who === 'opponent'
        ? `Each opponent loses ${lifeAmount(effect.amount)}.`
        : `You lose ${lifeAmount(effect.amount)}.`;
    case 'fight':
      return `${ref(effect.a, 'subject')} fights ${ref(effect.b, 'object')}.`;
    case 'bite':
      return `${ref(effect.a, 'subject')} deals damage equal to its power to ${ref(effect.b, 'object')}.`;
    case 'pumpTeam':
      return `Creatures you control ${gainsText('get', effect.power, effect.toughness, effect.keywords)} until end of turn.`;
    case 'addCounters':
      return `Put ${plusCounters(effect.amount)} on ${ref(effect.to, 'object')}.`;
    case 'addCountersTeam':
      return `Put ${plusCounters(effect.amount)} on each creature you control.`;
    case 'createTokens': {
      const description = tokenDescription(effect.token, effect.amount);
      return `Create ${effect.amount === 1 ? withArticle(description) : `${countWord(effect.amount)} ${description}`}.`;
    }
    case 'discard':
      if (effect.who !== 'opponent') return `Discard ${cardsCount(effect.amount)}.`;
      if (context.on === 'damagesPlayer') return `That player discards ${cardsCount(effect.amount)}.`;
      return `Each opponent discards ${cardsCount(effect.amount)}.`;
    case 'returnToBattlefield':
      return `Return it to the battlefield under its owner's control with ${plusCounters(effect.counters)} on it.`;
    case 'extraLands':
      return `You may play ${extraLandsText(effect.amount)} this turn.`;
    case 'searchLand':
      return searchLandSentence(effect.land, effect.battlefield, effect.hand ?? 0, effect.tapped ?? false);
  }
}

const TRIGGER_OPENERS: Record<TriggerEvent, string> = {
  upkeep: 'At the beginning of your upkeep',
  enters: 'When this creature enters',
  dies: 'When this creature dies',
  attacks: 'Whenever this creature attacks',
  spell: 'Whenever you cast an instant or sorcery spell',
  allyEnters: 'Whenever another creature you control enters',
  allyDies: 'Whenever another creature you control dies',
  damagesPlayer: 'Whenever this creature deals combat damage to a player',
  lifeGain: 'Whenever you gain life',
  landfall: 'Landfall — Whenever a land you control enters',
};

const RELIC_OPENERS: Partial<Record<TriggerEvent, string>> = {
  allyEnters: 'Whenever a creature you control enters',
  allyDies: 'Whenever a creature you control dies',
};

const TRIGGER_CONDITIONS: Record<TriggerCondition, string> = {
  opponentDamaged: 'if an opponent was dealt damage this turn',
  emptyHand: 'if you have no cards in hand',
};

function manaChoice(colors: readonly Color[]): string {
  if (colors.length === COLORS.length) return 'one mana of any color';
  return andList(
    colors.map((color) => `{${color}}`),
    'or',
  );
}

function cardRefParts(s: GameState, id: CardId, viewer: PlayerId): TextPart[] {
  const card = s.cards[id];
  if (!card) return [id];
  return card.controller === viewer ? line`your ${mention(s, id)}` : line`the opponent's ${mention(s, id)}`;
}

function playerLabel(player: PlayerId, viewer: PlayerId): string {
  return player === viewer ? 'you' : OPPONENT;
}

function targetRefParts(s: GameState, target: Target, viewer: PlayerId): TextPart[] {
  return isPlayerTarget(target) ? [playerLabel(target.player, viewer)] : cardRefParts(s, target.card, viewer);
}

function act(player: PlayerId, viewer: PlayerId, second: string, third: string): string {
  return player === viewer ? `You ${second}` : `The opponent ${third}`;
}

function possessive(player: PlayerId, viewer: PlayerId): string {
  return player === viewer ? 'your' : 'their';
}

function targetsSuffix(s: GameState, targets: Target[], viewer: PlayerId): TextPart[] {
  if (targets.length === 0) return [];
  return line` targeting ${joinedAnd(targets.map((target) => targetRefParts(s, target, viewer)))}`;
}

function describeEventParts(s: GameState, event: GameEvent, viewer: PlayerId): TextPart[] | null {
  switch (event.t) {
    case 'start':
      return event.startingPlayer === viewer ? line`You go first.` : line`The opponent goes first.`;
    case 'mulligan':
      return line`${act(event.player, viewer, 'mulligan', 'mulligans')} (${event.count}).`;
    case 'keep':
      return line`${act(event.player, viewer, 'keep', 'keeps')} ${count(event.handSize, 'card', 'cards')}.`;
    case 'bottom':
      return line`${act(event.player, viewer, 'put', 'puts')} ${count(event.count, 'card', 'cards')} on the bottom of ${possessive(event.player, viewer)} library.`;
    case 'turn':
      return line`Turn ${event.turn} — ${event.player === viewer ? 'your turn' : "the opponent's turn"}.`;
    case 'draw':
      return event.player === viewer ? line`You draw ${mention(s, event.card)}.` : line`The opponent draws a card.`;
    case 'drawEmpty':
      return event.player === viewer
        ? line`You can't draw: your library is empty.`
        : line`The opponent can't draw: their library is empty.`;
    case 'land':
      return line`${act(event.player, viewer, 'play', 'plays')} ${mention(s, event.card)}.`;
    case 'cast':
      return line`${act(event.player, viewer, 'cast', 'casts')} ${mention(s, event.card)}${targetsSuffix(s, event.targets, viewer)}.`;
    case 'activate': {
      const own = s.cards[event.card]?.controller === event.player;
      const source = own
        ? line`${possessive(event.player, viewer)} ${mention(s, event.card)}`
        : cardRefParts(s, event.card, viewer);
      return line`${act(event.player, viewer, 'activate', 'activates')} ${source}${targetsSuffix(s, event.targets, viewer)}.`;
    }
    case 'trigger':
      return line`${capitalizeParts(cardRefParts(s, event.card, viewer))} triggers${targetsSuffix(s, event.targets, viewer)}.`;
    case 'fizzle': {
      const subject =
        event.item.kind === 'spell' ? [mention(s, event.item.card)] : line`${mention(s, event.item.source)}'s ability`;
      return line`${subject} doesn't resolve: its targets are gone.`;
    }
    case 'counter':
      return line`${capitalizeParts(cardRefParts(s, event.card, viewer))} is countered.`;
    case 'bounce':
      return line`${mention(s, event.card)} returns to ${event.player === viewer ? 'your hand' : "the opponent's hand"}.`;
    case 'attack':
      if (event.attackers.length === 0) return null;
      return line`${act(event.player, viewer, 'attack', 'attacks')} with ${joinedAnd(event.attackers.map((id) => [mention(s, id)]))}.`;
    case 'block':
      if (event.blocks.length === 0) return line`${act(event.player, viewer, "don't block", "doesn't block")}.`;
      return line`${act(event.player, viewer, 'block', 'blocks')}: ${joined(
        event.blocks.map((block) => line`${mention(s, block.blocker)} → ${mention(s, block.attacker)}`),
        ', ',
      )}.`;
    case 'damage':
      return line`${capitalizeParts(cardRefParts(s, event.source, viewer))} deals ${damageAmount(event.amount)} to ${targetRefParts(s, event.target, viewer)}.`;
    case 'life':
      return event.delta > 0
        ? line`${act(event.player, viewer, 'gain', 'gains')} ${lifeAmount(event.delta)} (${event.life}).`
        : null;
    case 'loseLife':
      return line`${act(event.player, viewer, 'lose', 'loses')} ${lifeAmount(event.amount)}.`;
    case 'pump':
      return line`${capitalizeParts(cardRefParts(s, event.card, viewer))} ${gainsText('gets', event.power, event.toughness, event.keywords)} until end of turn.`;
    case 'create': {
      const token = mention(s, event.card);
      const name = typeof token === 'string' ? token : token.name;
      return line`${act(event.player, viewer, 'create', 'creates')} ${article(name)} ${token} token.`;
    }
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
      return line`${act(event.player, viewer, 'discard', 'discards')} ${mention(s, event.card)}.`;
    case 'concede':
      return line`${act(event.player, viewer, 'concede', 'concedes')}.`;
    case 'gameOver':
      if (event.winner === null) return line`The game ends in a draw.`;
      return event.winner === viewer ? line`You win!` : line`The opponent wins.`;
    case 'search': {
      const mine = event.player === viewer;
      const where = event.to === 'hand' ? `into ${mine ? 'your' : 'their'} hand` : 'onto the battlefield';
      return line`${act(event.player, viewer, 'search', 'searches')} ${possessive(event.player, viewer)} library and ${mine ? 'put' : 'puts'} ${mention(s, event.card)} ${where}.`;
    }
    case 'extraLands':
      return line`${act(event.player, viewer, 'may', 'may')} play ${extraLandsText(event.amount)} this turn.`;
    case 'resolve':
    case 'enter':
      return null;
  }
}

function refusal(refused: Refusal): string {
  switch (refused.code) {
    case 'malformedAction':
      return 'malformed action';
    case 'unknownAction':
      return `unknown action type "${refused.type}"`;
    case 'unknownPlayer':
      return 'unknown player';
    case 'noDecision':
      return "the game isn't waiting for any decision";
    case 'gameOver':
      return 'the game is over';
    case 'notWaitingFor':
      return `the game isn't waiting for the "${refused.kind}" decision`;
    case 'notTheirDecision':
      return `it isn't player ${refused.player}'s decision`;
    case 'otherSeat':
      return 'you can only act for your own seat';
    case 'notYourDecision':
      return "it isn't your decision";
    case 'noMoreMulligans':
      return 'no more mulligans are allowed';
    case 'cardsNotList':
      return 'the cards must be a list';
    case 'chooseExactly':
      return `choose exactly ${count(refused.count, 'card', 'cards')}`;
    case 'chosenNotInHand':
      return `${refused.card} isn't in your hand`;
    case 'chosenTwice':
      return `${refused.card} was chosen twice`;
    case 'notInHand':
      return "that card isn't in your hand";
    case 'notALand':
      return "that card isn't a land";
    case 'landTiming':
      return 'lands can only be played in your main phase while the stack is empty';
    case 'landPlayed':
      return "you've already played a land this turn";
    case 'allLandsPlayed':
      return "you've already played all the lands you can this turn";
    case 'landsAreNotCast':
      return 'lands are played, not cast';
    case 'noPriority':
      return "you don't have priority";
    case 'sorceryTiming':
      return 'this can only be cast in your main phase while the stack is empty';
    case 'notEnoughMana':
      return 'not enough mana';
    case 'notYourPermanent':
      return "you don't control that permanent";
    case 'noSuchAbility':
      return "that permanent doesn't have that ability";
    case 'tapped':
      return 'that permanent is tapped';
    case 'summoningSick':
      return 'that creature has summoning sickness';
    case 'triggerGone':
      return "that triggered ability isn't waiting for targets anymore";
    case 'targetsNotList':
      return 'the targets must be a list';
    case 'targetCount':
      return `wrong number of targets: ${refused.given} instead of ${refused.expected}`;
    case 'targetMalformed':
      return `target ${refused.index} is malformed`;
    case 'illegalTarget':
      return `target ${refused.index} (${refused.target}) isn't legal`;
    case 'sameTargetTwice':
      return "the same target can't be chosen twice";
    case 'attackersNotList':
      return 'the attackers must be a list';
    case 'attackersNotIds':
      return 'the attackers must be card ids';
    case 'attackerTwice':
      return `${refused.card} was declared twice`;
    case 'cannotAttack':
      return `${refused.card} can't attack`;
    case 'blocksNotList':
      return 'the blocks must be a list';
    case 'noCombat':
      return "there's no combat";
    case 'malformedBlock':
      return 'malformed block';
    case 'blockerTwice':
      return `${refused.card} can only block one attacker`;
    case 'cannotBlock':
      return `${refused.blocker} can't block ${refused.attacker}`;
    case 'menace':
      return `${refused.attacker} has menace and can't be blocked except by two or more creatures`;
  }
}

const RULES: RulesGrammar = {
  keywordNames: KEYWORD_NAMES,
  keywordLine: (keywords) => keywords,
  entersTapped: 'This land enters tapped.',
  manaAbility: (colors) => `{T}: Add ${manaChoice(colors)}.`,
  triggerOpeners: TRIGGER_OPENERS,
  relicOpeners: RELIC_OPENERS,
  triggerConditions: TRIGGER_CONDITIONS,
  undying: `${TRIGGER_OPENERS.dies}, if it had no +1/+1 counters on it, return it to the battlefield under its owner's control with a +1/+1 counter on it.`,
  evolve: `${TRIGGER_OPENERS.allyEnters}, if that creature has greater power or toughness than this creature, put a +1/+1 counter on this creature.`,
  prowess: KEYWORD_REMINDERS.prowess,
  sacrificeCost: 'Sacrifice this creature',
  selves: {
    pronoun: { subject: 'it', object: 'it' },
    creature: { subject: 'this creature', object: 'this creature' },
    sacrificed: { subject: 'it', object: 'it' },
  },
  targetPhrase,
  repeatedPhrase,
  effectSentence,
  moreDamage: (amount, target) => `and ${damageAmount(amount)} to ${target}.`,
  andThen: ', then ',
};

const STATE: StateWords = {
  stepName: (step) => STEP_NAMES[step],
  turn: 'Turn',
  active: 'active',
  life: lifeAmount,
  library: 'library',
  graveyard: 'graveyard',
  hand: 'hand',
  hiddenHand: (cards) => `${cards} cards`,
  battlefield: 'battlefield',
  relics: 'relics',
  stack: 'stack',
  ability: (source) => `${source}'s ability`,
  targets: targetsSuffix,
  waitingFor: 'waiting for',
  tapped: 'tapped',
  summoningSick: 'summoning sick',
  damage: (amount) => `${amount} damage`,
  counters: countersLabel,
  attacking: 'attacking',
  blocking: (attacker) => `blocking ${attacker}`,
};

export const en: EngineText = {
  playerNames: ['You', 'AI'],
  keywordName: (keyword) => KEYWORD_NAMES[keyword],
  keywordReminder: (keyword) => KEYWORD_REMINDERS[keyword],
  stepName: (step) => STEP_NAMES[step],
  colorName: (color) => COLOR_WORDS[color],
  typeLine,
  rulesText: (def) => rulesText(RULES, def),
  triggerText: (def, index) => triggerText(RULES, def, index),
  activatedText: (def, index) => activatedText(RULES, def, index),
  tokenDescription,
  targetChoice,
  formatPump,
  countersLabel,
  targetRefParts,
  describeEventParts,
  describeState: (s, viewer, revealAll) => describeState(STATE, s, viewer, revealAll),
  refusal,
};
