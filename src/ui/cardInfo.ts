import type { CSSProperties } from 'preact';
import {
  costColors,
  formatModifier,
  getCardDef,
  getCost,
  type CardDef,
  type Color,
  type Effect,
  type Keyword,
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
};

export function cardColors(def: CardDef): Color[] {
  if (def.types.includes('land')) return def.mana ?? [];
  return costColors(getCost(def.id));
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
      return formatModifier(effect.power, effect.toughness);
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
      return `-${effect.amount} life`;
    case 'fight':
      return 'fight';
  }
}

export function shortText(defId: string): string {
  const def = getCardDef(defId);
  const parts: string[] = (def.keywords ?? []).map((keyword) => SHORT_KEYWORDS[keyword]);
  if (def.mana?.length && def.types.includes('creature')) parts.push(`T: +${def.mana.join('/')}`);
  const openers = { enters: 'Enters', dies: 'Dies', attacks: 'Attacks' } as const;
  for (const trigger of def.triggers ?? []) parts.push(`${openers[trigger.on]}: ${trigger.effects.map(effectHint).join(', ')}`);
  for (const ability of def.activated ?? []) {
    const cost = ability.cost.replace(/[{}]/g, '');
    parts.push(`${ability.tap ? 'T,' : ''}${cost}: ${ability.effects.map(effectHint).join(', ')}`);
  }
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
