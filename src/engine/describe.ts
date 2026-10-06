import { getLocale, type Locale } from '../i18n/locale';
import { formatCost } from './mana';
import type { Refusal } from './refusals';
import { getCardDef, getCost } from './registry';
import { isCreatureDef } from './state';
import { en } from './text/en';
import { es } from './text/es';
import { plainText, type TextPart } from './text/parts';
import type { ColorNoun, EngineText } from './text/types';
import type { CardDef, Color, GameEvent, GameState, Keyword, PlayerId, Step, Target, TargetSpec } from './types';

export { cardName, formatModifier, plainText } from './text/parts';
export type { TextPart } from './text/parts';
export type { ColorNoun } from './text/types';

const TEXTS: Record<Locale, EngineText> = { es, en };

function text(): EngineText {
  return TEXTS[getLocale()];
}

export function defaultPlayerNames(): readonly [string, string] {
  return text().playerNames;
}

export function keywordName(keyword: Keyword): string {
  return text().keywordName(keyword);
}

export function keywordReminder(keyword: Keyword): string {
  return text().keywordReminder(keyword);
}

export function stepName(step: Step): string {
  return text().stepName(step);
}

export function colorName(color: Color, noun: ColorNoun): string {
  return text().colorName(color, noun);
}

export function typeLine(def: CardDef): string {
  return text().typeLine(def);
}

export function rulesText(def: CardDef): string[] {
  return text().rulesText(def);
}

export function triggerText(def: CardDef, index: number): string {
  return text().triggerText(def, index);
}

export function activatedText(def: CardDef, index: number): string {
  return text().activatedText(def, index);
}

export function tokenDescription(defId: string, amount = 1): string {
  return text().tokenDescription(defId, amount);
}

export function targetChoice(spec: TargetSpec): string {
  return text().targetChoice(spec);
}

export function formatPump(power: number, toughness: number, keywords: readonly Keyword[] = []): string {
  return text().formatPump(power, toughness, keywords);
}

export function countersLabel(count: number): string {
  return text().countersLabel(count);
}

export function cardSummary(defId: string): string {
  const def = getCardDef(defId);
  const parts = [def.name];
  if (def.cost) parts.push(formatCost(getCost(defId)));
  parts.push(typeLine(def));
  if (isCreatureDef(def)) parts.push(`${def.power}/${def.toughness}`);
  const lines = rulesText(def);
  if (lines.length) parts.push(lines.join(' '));
  return parts.join(' · ');
}

export function targetRef(s: GameState, target: Target, viewer: PlayerId): string {
  return plainText(text().targetRefParts(s, target, viewer));
}

export function describeEventParts(s: GameState, event: GameEvent, viewer: PlayerId): TextPart[] | null {
  return text().describeEventParts(s, event, viewer);
}

export function describeEvent(s: GameState, event: GameEvent, viewer: PlayerId): string | null {
  const parts = describeEventParts(s, event, viewer);
  return parts && plainText(parts);
}

export function describeState(s: GameState, viewer: PlayerId = 0, revealAll = false): string {
  return text().describeState(s, viewer, revealAll);
}

export function refusalText(refusal: Refusal): string {
  return text().refusal(refusal);
}
