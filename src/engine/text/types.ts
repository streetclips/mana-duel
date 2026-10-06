import type { Refusal } from '../refusals';
import type { CardDef, Color, GameEvent, GameState, Keyword, PlayerId, Step, Target, TargetSpec } from '../types';
import type { TextPart } from './parts';

export interface CardText {
  name: string;
  subtypes?: string[];
  flavor?: string;
}

export interface DeckText {
  name: string;
  description: string;
}

export type ColorNoun = 'mana' | 'card' | 'cards';

export interface EngineText {
  playerNames: readonly [string, string];
  keywordName(keyword: Keyword): string;
  keywordReminder(keyword: Keyword): string;
  stepName(step: Step): string;
  colorName(color: Color, noun: ColorNoun): string;
  typeLine(def: CardDef): string;
  rulesText(def: CardDef): string[];
  triggerText(def: CardDef, index: number): string;
  activatedText(def: CardDef, index: number): string;
  tokenDescription(defId: string, amount: number): string;
  targetChoice(spec: TargetSpec): string;
  formatPump(power: number, toughness: number, keywords: readonly Keyword[]): string;
  countersLabel(count: number): string;
  targetRefParts(s: GameState, target: Target, viewer: PlayerId): TextPart[];
  describeEventParts(s: GameState, event: GameEvent, viewer: PlayerId): TextPart[] | null;
  describeState(s: GameState, viewer: PlayerId, revealAll: boolean): string;
  refusal(refusal: Refusal): string;
}
