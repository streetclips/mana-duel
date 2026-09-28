import { formatCost } from './mana';
import { getCardDef, getCost } from './registry';
import { getCard, getPower, getToughness, isCreatureDef } from './state';
import { isPlayerTarget } from './targets';
import type {
  CardDef,
  CardId,
  Effect,
  EffectTarget,
  GameEvent,
  GameState,
  Keyword,
  PlayerId,
  Step,
  Target,
  TargetSpec,
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
  const main = [...(def.supertypes ?? []), ...def.types.map(capitalize)].join(' ');
  return def.subtypes?.length ? `${main} — ${def.subtypes.join(' ')}` : main;
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

function refPhrase(ref: EffectTarget, specs: TargetSpec[], self: string): string {
  if (ref === 'self') return self;
  const spec = specs[ref];
  return spec ? targetPhrase(spec) : 'it';
}

function effectSentence(effect: Effect, specs: TargetSpec[], subject: string, self: string): string {
  switch (effect.kind) {
    case 'damage':
      return `${subject} deals ${effect.amount} damage to ${refPhrase(effect.to, specs, self)}.`;
    case 'pump':
      return `${capitalize(refPhrase(effect.to, specs, self))} gets ${formatModifier(effect.power, effect.toughness)} until end of turn.`;
    case 'destroy':
      return `Destroy ${refPhrase(effect.to, specs, self)}.`;
    case 'bounce':
      return `Return ${refPhrase(effect.to, specs, self)} to its owner's hand.`;
    case 'counter':
      return `Counter ${refPhrase(effect.to, specs, self)}.`;
    case 'draw':
      return effect.amount === 1 ? 'Draw a card.' : `Draw ${NUMBER_WORDS[effect.amount] ?? effect.amount} cards.`;
    case 'gainLife':
      return `You gain ${effect.amount} life.`;
    case 'loseLife':
      return `You lose ${effect.amount} life.`;
    case 'fight':
      return `${capitalize(refPhrase(effect.a, specs, self))} fights ${refPhrase(effect.b, specs, self)}.`;
  }
}

function sentences(effects: Effect[], specs: TargetSpec[], subject: string, self: string): string {
  return effects.map((effect) => effectSentence(effect, specs, subject, self)).join(' ');
}

const TRIGGER_OPENERS = {
  enters: 'When this creature enters',
  dies: 'When this creature dies',
  attacks: 'Whenever this creature attacks',
} as const;

export function rulesText(def: CardDef): string[] {
  const lines: string[] = [];
  if (def.keywords?.length) {
    lines.push(def.keywords.map((keyword, i) => (i === 0 ? KEYWORD_NAMES[keyword] : lowerFirst(KEYWORD_NAMES[keyword]))).join(', '));
  }
  if (def.mana?.length) {
    lines.push(`{T}: Add ${def.mana.map((color) => `{${color}}`).join(' or ')}.`);
  }
  if (def.spell) {
    lines.push(sentences(def.spell.effects, def.spell.targets, def.name, 'it'));
  }
  (def.triggers ?? []).forEach((_, index) => lines.push(triggerText(def, index)));
  (def.activated ?? []).forEach((_, index) => lines.push(activatedText(def, index)));
  return lines;
}

export function triggerText(def: CardDef, index: number): string {
  const trigger = def.triggers?.[index];
  if (!trigger) return '';
  return `${TRIGGER_OPENERS[trigger.on]}, ${lowerFirst(sentences(trigger.effects, trigger.targets, 'it', 'it'))}`;
}

export function activatedText(def: CardDef, index: number): string {
  const ability = def.activated?.[index];
  if (!ability) return '';
  const cost = [ability.cost && ability.cost !== '{0}' ? ability.cost : '', ability.tap ? '{T}' : '']
    .filter(Boolean)
    .join(', ');
  return `${cost}: ${sentences(ability.effects, ability.targets, 'This creature', 'this creature')}`;
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

export function cardRef(s: GameState, id: CardId, viewer: PlayerId): string {
  const card = s.cards[id];
  if (!card) return id;
  const whose = card.controller === viewer ? 'your' : `${s.players[card.controller].name}'s`;
  return `${whose} ${getCardDef(card.def).name}`;
}

export function targetRef(s: GameState, target: Target, viewer: PlayerId): string {
  return isPlayerTarget(target) ? playerLabel(s, target.player, viewer) : cardRef(s, target.card, viewer);
}

function verb(s: GameState, player: PlayerId, viewer: PlayerId, base: string, third?: string): string {
  const subject = capitalize(playerLabel(s, player, viewer));
  return `${subject} ${player === viewer ? base : (third ?? `${base}s`)}`;
}

function targetsSuffix(s: GameState, targets: Target[], viewer: PlayerId): string {
  if (targets.length === 0) return '';
  return ` targeting ${targets.map((target) => targetRef(s, target, viewer)).join(' and ')}`;
}

export function describeEvent(s: GameState, event: GameEvent, viewer: PlayerId): string | null {
  switch (event.t) {
    case 'start':
      return `${verb(s, event.startingPlayer, viewer, 'go', 'goes')} first.`;
    case 'mulligan':
      return `${verb(s, event.player, viewer, 'take')} a mulligan (${event.count}).`;
    case 'keep':
      return `${verb(s, event.player, viewer, 'keep')} ${event.handSize} cards.`;
    case 'bottom':
      return `${verb(s, event.player, viewer, 'put')} ${event.count} card${event.count === 1 ? '' : 's'} on the bottom.`;
    case 'turn':
      return `Turn ${event.turn} — ${event.player === viewer ? 'your turn' : `${s.players[event.player].name}'s turn`}.`;
    case 'draw':
      return event.player === viewer ? `You draw ${cardName(s, event.card)}.` : `${capitalize(playerLabel(s, event.player, viewer))} draws a card.`;
    case 'drawEmpty':
      return `${capitalize(playerLabel(s, event.player, viewer))} can't draw: the library is empty.`;
    case 'land':
      return `${verb(s, event.player, viewer, 'play')} ${cardName(s, event.card)}.`;
    case 'cast':
      return `${verb(s, event.player, viewer, 'cast')} ${cardName(s, event.card)}${targetsSuffix(s, event.targets, viewer)}.`;
    case 'activate':
      return `${verb(s, event.player, viewer, 'activate')} ${cardRef(s, event.card, viewer)}${targetsSuffix(s, event.targets, viewer)}.`;
    case 'trigger':
      return `${capitalize(cardRef(s, event.card, viewer))} triggers${targetsSuffix(s, event.targets, viewer)}.`;
    case 'fizzle': {
      const source = event.item.kind === 'spell' ? event.item.card : event.item.source;
      return `${cardName(s, source)} fizzles: its targets are gone.`;
    }
    case 'counter':
      return `${capitalize(cardRef(s, event.card, viewer))} is countered.`;
    case 'bounce':
      return `${cardName(s, event.card)} returns to ${event.player === viewer ? 'your' : `${s.players[event.player].name}'s`} hand.`;
    case 'attack':
      if (event.attackers.length === 0) return null;
      return `${verb(s, event.player, viewer, 'attack')} with ${event.attackers.map((id) => cardName(s, id)).join(', ')}.`;
    case 'block':
      if (event.blocks.length === 0) return `${verb(s, event.player, viewer, "don't", "doesn't")} block.`;
      return `${verb(s, event.player, viewer, 'block')}: ${event.blocks
        .map((block) => `${cardName(s, block.blocker)} → ${cardName(s, block.attacker)}`)
        .join(', ')}.`;
    case 'damage':
      return `${capitalize(cardRef(s, event.source, viewer))} deals ${event.amount} damage to ${targetRef(s, event.target, viewer)}.`;
    case 'life':
      return event.delta > 0
        ? `${verb(s, event.player, viewer, 'gain')} ${event.delta} life (${event.life}).`
        : null;
    case 'loseLife':
      return `${verb(s, event.player, viewer, 'lose')} ${event.amount} life.`;
    case 'pump':
      return `${capitalize(cardRef(s, event.card, viewer))} gets ${formatModifier(event.power, event.toughness)} until end of turn.`;
    case 'fight':
      return `${capitalize(cardRef(s, event.a, viewer))} fights ${cardRef(s, event.b, viewer)}.`;
    case 'dies':
      return `${capitalize(cardRef(s, event.card, viewer))} dies.`;
    case 'discard':
      return `${verb(s, event.player, viewer, 'discard')} ${cardName(s, event.card)}.`;
    case 'concede':
      return `${verb(s, event.player, viewer, 'concede')}.`;
    case 'gameOver':
      if (event.winner === null) return 'The game is a draw.';
      return event.winner === viewer ? 'You win!' : `${s.players[event.winner].name} wins.`;
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
      return `${label}${targetsSuffix(s, item.targets, viewer)}`;
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
