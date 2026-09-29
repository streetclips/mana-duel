import type { CSSProperties } from 'preact';
import {
  costColors,
  formatModifier,
  getCardDef,
  getCost,
  type ActivatedAbility,
  type CardDef,
  type Color,
  type Effect,
  type Keyword,
  type TriggerEvent,
} from '../engine';

export const SHORT_KEYWORDS: Record<Keyword, string> = {
  flying: 'Flying',
  reach: 'Reach',
  haste: 'Haste',
  vigilance: 'Vigilance',
  trample: 'Trample',
  firstStrike: '1st strike',
  doubleStrike: '2× strike',
  deathtouch: 'Deathtouch',
  lifelink: 'Lifelink',
  menace: 'Menace',
  defender: 'Defender',
  flash: 'Flash',
  skulk: 'Skulk',
  undying: 'Undying',
};

export function cardColors(def: CardDef): Color[] {
  if (def.types.includes('land')) return def.mana ?? [];
  if (def.token) return def.colors ?? [];
  return costColors(getCost(def.id));
}

function shortKeywords(keywords: readonly Keyword[] = []): string {
  return keywords.map((keyword) => SHORT_KEYWORDS[keyword].toLowerCase()).join(', ');
}

function pumpHint(power: number, toughness: number, keywords: readonly Keyword[] = []): string {
  if (keywords.length === 0) return formatModifier(power, toughness);
  if (power === 0 && toughness === 0) return shortKeywords(keywords);
  return `${formatModifier(power, toughness)} ${shortKeywords(keywords)}`;
}

export function cardColorVar(def: CardDef): string {
  const colors = cardColors(def);
  if (colors.length === 1) return `var(--mana-${colors[0]})`;
  if (colors.length > 1) return 'var(--mana-M)';
  return 'var(--mana-C)';
}

export function effectHint(effect: Effect): string {
  switch (effect.kind) {
    case 'damage':
      return `${effect.amount} dmg`;
    case 'pump':
      return pumpHint(effect.power, effect.toughness, effect.keywords);
    case 'destroy':
      return 'destroy';
    case 'bounce':
      return 'bounce';
    case 'counter':
      return 'counter';
    case 'draw':
      return `draw ${effect.amount}`;
    case 'gainLife':
      return `+${effect.amount} life`;
    case 'loseLife':
      return effect.who === 'opponent' ? `opp -${effect.amount} life` : `-${effect.amount} life`;
    case 'fight':
      return 'fight';
    case 'pumpTeam':
      return `team ${pumpHint(effect.power, effect.toughness, effect.keywords)}`;
    case 'addCounters':
      return `+${effect.amount} counter${effect.amount === 1 ? '' : 's'}`;
    case 'addCountersTeam':
      return `team +${effect.amount} counter${effect.amount === 1 ? '' : 's'}`;
    case 'createTokens':
      return `+${effect.amount} ${getCardDef(effect.token).name}${effect.amount === 1 ? '' : 's'}`;
    case 'discard':
      return effect.who === 'opponent' ? `opp discards ${effect.amount}` : `discard ${effect.amount}`;
    case 'returnToBattlefield':
      return 'returns';
  }
}

const TRIGGER_HINTS: Record<TriggerEvent, string> = {
  enters: 'Enters',
  dies: 'Dies',
  attacks: 'Attacks',
  spell: 'Spell',
  allyEnters: 'Ally enters',
  allyDies: 'Ally dies',
  damagesPlayer: 'Hits',
};

export function activatedCost(ability: ActivatedAbility): string {
  const cost = ability.cost === '{0}' ? '' : ability.cost.replace(/[{}]/g, '');
  return [ability.tap ? 'T' : '', ability.sacrifice ? 'Sac' : '', cost].filter(Boolean).join(',');
}

export function shortText(defId: string): string {
  const def = getCardDef(defId);
  const parts: string[] = (def.keywords ?? []).map((keyword) => SHORT_KEYWORDS[keyword]);
  if (def.mana?.length && def.types.includes('creature')) parts.push(`T: +${def.mana.join('/')}`);
  for (const trigger of def.triggers ?? []) parts.push(`${TRIGGER_HINTS[trigger.on]}: ${trigger.effects.map(effectHint).join(', ')}`);
  for (const ability of def.activated ?? []) parts.push(`${activatedCost(ability)}: ${ability.effects.map(effectHint).join(', ')}`);
  return parts.join(' · ');
}

export function cardArtUrl(defId: string): string {
  return `${import.meta.env.BASE_URL}cards/${defId}.svg`;
}

export function cssVars(vars: Record<`--${string}`, string>): CSSProperties {
  return vars as CSSProperties;
}

export function hasLongWord(name: string): boolean {
  return name.split(' ').some((word) => word.length >= 10);
}
