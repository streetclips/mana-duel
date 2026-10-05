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
  type TriggerCondition,
  type TriggerEvent,
  type TriggeredAbility,
} from '../engine';

export const SHORT_KEYWORDS: Record<Keyword, string> = {
  flying: 'Vuela',
  reach: 'Alcance',
  haste: 'Prisa',
  vigilance: 'Vigilancia',
  trample: 'Arrolla',
  firstStrike: 'Daña 1.º',
  doubleStrike: 'Daña 2×',
  deathtouch: 'Toque mortal',
  lifelink: 'Vínculo vital',
  menace: 'Amenaza',
  defender: 'Defensor',
  flash: 'Destello',
  skulk: 'Escurridizo',
  undying: 'Resiliencia',
  hexproof: 'Antimaleficio',
  evolve: 'Evolucionar',
  prowess: 'Destreza',
};

const MANA_NAMES: Record<string, string> = { W: 'blanco', U: 'azul', B: 'negro', R: 'rojo', G: 'verde' };

export function manaName(symbol: string): string {
  if (symbol === 'T') return 'girar';
  if (/^\d+$/.test(symbol)) return `${symbol} genérico`;
  return MANA_NAMES[symbol] ?? symbol;
}

function pluralName(name: string): string {
  if (/[aeiouáéíóú]$/i.test(name)) return `${name}s`;
  return `${name.replace(/[áéíóú](?=[a-z]$)/i, (vowel) => vowel.normalize('NFD').charAt(0))}es`;
}

function lives(amount: number): string {
  return amount === 1 ? 'vida' : 'vidas';
}

export { cardColors };

function shortKeywords(keywords: readonly Keyword[] = []): string {
  return keywords.map((keyword) => SHORT_KEYWORDS[keyword].toLowerCase()).join(', ');
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
  switch (effect.kind) {
    case 'damage':
      return `${effect.amount} de daño`;
    case 'pump':
      return pumpHint(effect.power, effect.toughness, effect.keywords);
    case 'destroy':
      return 'destruir';
    case 'bounce':
      return 'a la mano';
    case 'counter':
      return 'contrarrestar';
    case 'draw':
      return `robar ${effect.amount}`;
    case 'gainLife':
      return `+${effect.amount} ${lives(effect.amount)}`;
    case 'loseLife':
      return effect.who === 'opponent' ? `rival -${effect.amount} ${lives(effect.amount)}` : `-${effect.amount} ${lives(effect.amount)}`;
    case 'fight':
      return 'luchar';
    case 'bite':
      return 'morder';
    case 'pumpTeam':
      return `todas ${pumpHint(effect.power, effect.toughness, effect.keywords)}`;
    case 'addCounters':
      return `+${effect.amount} ${effect.amount === 1 ? 'contador' : 'contadores'}`;
    case 'addCountersTeam':
      return `todas +${effect.amount} ${effect.amount === 1 ? 'contador' : 'contadores'}`;
    case 'createTokens': {
      const name = getCardDef(effect.token).name;
      return `+${effect.amount} ${effect.amount === 1 ? name : pluralName(name)}`;
    }
    case 'discard':
      return effect.who === 'opponent' ? `rival descarta ${effect.amount}` : `descartar ${effect.amount}`;
    case 'returnToBattlefield':
      return 'regresa';
    case 'extraLands':
      return `+${effect.amount} ${effect.amount === 1 ? 'tierra' : 'tierras'}`;
    case 'searchLand': {
      const total = effect.battlefield + (effect.hand ?? 0);
      const name = getCardDef(effect.land).name;
      return `busca ${total === 1 ? name : `${total} ${pluralName(name)}`}`;
    }
  }
}

const TRIGGER_HINTS: Record<TriggerEvent, string> = {
  upkeep: 'Mantenimiento',
  enters: 'Entra',
  dies: 'Muere',
  attacks: 'Ataca',
  spell: 'Hechizo',
  allyEnters: 'Otra entra',
  allyDies: 'Otra muere',
  damagesPlayer: 'Golpea',
  lifeGain: 'Ganas vidas',
  landfall: 'Aterrizaje',
};

const CONDITION_HINTS: Record<TriggerCondition, string> = {
  opponentDamaged: 'Sed de sangre',
  emptyHand: 'Mano vacía',
};

export function activatedCost(ability: ActivatedAbility): string {
  const cost = ability.cost === '{0}' ? '' : ability.cost.replace(/[{}]/g, '');
  return [ability.tap ? 'T' : '', ability.sacrifice ? 'Sacr.' : '', cost].filter(Boolean).join(',');
}

export function triggerHint(trigger: TriggeredAbility): string {
  const hint = trigger.condition ? CONDITION_HINTS[trigger.condition] : TRIGGER_HINTS[trigger.on];
  return `${hint}: ${trigger.effects.map(effectHint).join(', ')}`;
}

export function manaHint(colors: readonly Color[]): string {
  return colors.length === COLORS.length ? 'cualquier color' : colors.join('/');
}

export function landHint(def: CardDef): string | null {
  const mana = def.mana ?? [];
  if (!def.types.includes('land') || (!def.entersTapped && mana.length <= 1)) return null;
  const produces = mana.length === COLORS.length ? '{any}' : mana.map((color) => `{${color}}`).join('');
  return `${def.entersTapped ? 'Entra girada. ' : ''}${produces}`;
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
