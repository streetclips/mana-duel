import { getCardDef } from '../registry';
import type { CardId, GameState } from '../types';

export interface CardMention {
  card: CardId;
  name: string;
}

export type TextPart = string | CardMention;

type TextPiece = TextPart | TextPart[] | number;

export function plainText(parts: readonly TextPart[]): string {
  return parts.map((part) => (typeof part === 'string' ? part : part.name)).join('');
}

export function line(literals: TemplateStringsArray, ...pieces: TextPiece[]): TextPart[] {
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

export function joined(items: (TextPart | TextPart[])[], separator: string): TextPart[] {
  return items.flatMap((item, index) => [
    ...(index === 0 ? [] : [separator]),
    ...(Array.isArray(item) ? item : [item]),
  ]);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function capitalizeParts(parts: TextPart[]): TextPart[] {
  const [first, ...rest] = parts;
  return typeof first === 'string' ? [capitalize(first), ...rest] : parts;
}

export function mention(s: GameState, id: CardId): TextPart {
  const card = s.cards[id];
  return card ? { card: id, name: getCardDef(card.def).name } : id;
}

export function cardName(s: GameState, id: CardId): string {
  const card = s.cards[id];
  return card ? getCardDef(card.def).name : id;
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

export function formatModifier(power: number, toughness: number): string {
  return `${signed(power)}/${signed(toughness)}`;
}
