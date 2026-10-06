import type { CSSProperties } from 'preact';
import {
  COLORS,
  cardColors,
  formatModifier,
  getCardDef,
  type ActivatedAbility,
  type CardDef,
  type Color,
  type Effect,
  type Keyword,
  type TriggeredAbility,
} from '../engine';
import { cardText } from './text/card';

function isColor(symbol: string): symbol is Color {
  return COLORS.some((color) => color === symbol);
}

export function manaName(symbol: string): string {
  const text = cardText();
  if (symbol === 'T') return text.tap;
  if (/^\d+$/.test(symbol)) return text.generic(symbol);
  return isColor(symbol) ? text.manaNames[symbol] : symbol;
}

export { cardColors };

function shortKeywords(keywords: readonly Keyword[] = []): string {
  const names = cardText().shortKeywords;
  return keywords.map((keyword) => names[keyword].toLowerCase()).join(', ');
}

function pumpHint(power: number, toughness: number, keywords: readonly Keyword[] = []): string {
  if (keywords.length === 0) return formatModifier(power, toughness);
  if (power === 0 && toughness === 0) return shortKeywords(keywords);
  return `${formatModifier(power, toughness)} ${shortKeywords(keywords)}`;
}

export function manaFill(colors: readonly Color[]): string {
  if (colors.length === 0) return 'var(--mana-C)';
  if (colors.length === 1) return `var(--mana-${colors[0]})`;
  const share = 100 / colors.length;
  const stops = colors.map((color, index) => `var(--mana-${color}) 0 ${index === colors.length - 1 ? 100 : Math.round(share * (index + 1) * 10) / 10}%`);
  return `conic-gradient(${stops.join(', ')})`;
}

export function cardColorVar(def: CardDef): string {
  const colors = cardColors(def);
  if (colors.length === 1) return `var(--mana-${colors[0]})`;
  if (colors.length > 1 || def.types.includes('relic')) return 'var(--mana-M)';
  return 'var(--mana-C)';
}

export function effectHint(effect: Effect): string {
  const hints = cardText().hints;
  switch (effect.kind) {
    case 'damage':
      return hints.damage(effect.amount);
    case 'pump':
      return pumpHint(effect.power, effect.toughness, effect.keywords);
    case 'destroy':
      return hints.destroy;
    case 'bounce':
      return hints.bounce;
    case 'counter':
      return hints.counter;
    case 'draw':
      return hints.draw(effect.amount);
    case 'gainLife':
      return hints.gainLife(effect.amount);
    case 'loseLife':
      return hints.loseLife(effect.amount, effect.who === 'opponent');
    case 'fight':
      return hints.fight;
    case 'bite':
      return hints.bite;
    case 'pumpTeam':
      return hints.team(pumpHint(effect.power, effect.toughness, effect.keywords));
    case 'addCounters':
      return hints.counters(effect.amount);
    case 'addCountersTeam':
      return hints.team(hints.counters(effect.amount));
    case 'createTokens':
      return hints.tokens(effect.amount, getCardDef(effect.token).name);
    case 'discard':
      return hints.discard(effect.amount, effect.who === 'opponent');
    case 'returnToBattlefield':
      return hints.returns;
    case 'extraLands':
      return hints.extraLands(effect.amount);
    case 'searchLand':
      return hints.search(effect.battlefield + (effect.hand ?? 0), getCardDef(effect.land).name);
  }
}

export function activatedCost(ability: ActivatedAbility): string {
  const cost = ability.cost === '{0}' ? '' : ability.cost.replace(/[{}]/g, '');
  return [ability.tap ? 'T' : '', ability.sacrifice ? cardText().sacrificeShort : '', cost].filter(Boolean).join(',');
}

export function triggerHint(trigger: TriggeredAbility): string {
  const text = cardText();
  const hint = trigger.condition ? text.conditionHints[trigger.condition] : text.triggerHints[trigger.on];
  return `${hint}: ${trigger.effects.map(effectHint).join(', ')}`;
}

export function manaHint(colors: readonly Color[]): string {
  return colors.length === COLORS.length ? cardText().anyColor : colors.join('/');
}

export function landHint(def: CardDef): string | null {
  const mana = def.mana ?? [];
  if (!def.types.includes('land') || (!def.entersTapped && mana.length <= 1)) return null;
  const produces = mana.length === COLORS.length ? '{any}' : mana.map((color) => `{${color}}`).join('');
  return `${def.entersTapped ? cardText().hints.entersTapped : ''}${produces}`;
}

export function abilityHints(defId: string): string[] {
  const def = getCardDef(defId);
  const parts: string[] = [];
  if (def.mana?.length && def.types.includes('creature')) parts.push(`T: +${manaHint(def.mana)}`);
  for (const trigger of def.triggers ?? []) parts.push(triggerHint(trigger));
  for (const ability of def.activated ?? []) parts.push(`${activatedCost(ability)}: ${ability.effects.map(effectHint).join(', ')}`);
  return parts;
}

export function lastingTriggers(def: CardDef): TriggeredAbility[] {
  return (def.triggers ?? []).filter((trigger) => trigger.on !== 'enters');
}

export function cardArtUrl(defId: string): string {
  return `${import.meta.env.BASE_URL}cards/${defId}.svg`;
}

export function cssVars(vars: Record<`--${string}`, string>): CSSProperties {
  return vars as CSSProperties;
}
