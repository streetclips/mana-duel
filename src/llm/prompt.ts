import {
  KEYWORDS,
  keywordName,
  keywordReminder,
  opponent,
  type DeckSpec,
  type GameState,
  type PlayerId,
} from '../engine';
import type { Decision } from './decision';
import { llmText } from './text';
import { cardGlossary, deckCardDefs, deckLine, playerView, visibleCardDefs } from './view';

export interface PromptContext {
  decks?: readonly [DeckSpec, DeckSpec] | null;
  recentEvents?: readonly string[];
  recentThoughts?: readonly string[];
}

export interface Prompt {
  system: string;
  prompt: string;
}

export const MAX_RECENT_EVENTS = 30;
export const MAX_RECENT_THOUGHTS = 10;

export function systemPrompt(): string {
  return llmText().systemPrompt(
    KEYWORDS.map((keyword) => `  - ${keywordName(keyword)}: ${keywordReminder(keyword)}`).join('\n'),
  );
}

const INLINE_WIDTH = 100;

export function compactJson(value: unknown, indent = ''): string {
  const inline = JSON.stringify(value) ?? 'null';
  if (typeof value !== 'object' || value === null || indent.length + inline.length <= INLINE_WIDTH) return inline;
  const inner = `${indent}  `;
  if (Array.isArray(value))
    return `[\n${value.map((item) => `${inner}${compactJson(item, inner)}`).join(',\n')}\n${indent}]`;
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  return `{\n${entries.map(([key, item]) => `${inner}${JSON.stringify(key)}: ${compactJson(item, inner)}`).join(',\n')}\n${indent}}`;
}

function section(title: string, body: string): string {
  return `## ${title}\n${body}`;
}

export function buildPrompt(s: GameState, player: PlayerId, decision: Decision, context: PromptContext = {}): Prompt {
  const decks = context.decks ?? null;
  const defs = [...(decks ? decks.flatMap((deck) => deckCardDefs(deck)) : []), ...visibleCardDefs(s, player)];
  const text = llmText().sections;
  const sections = [
    section(
      text.cards,
      cardGlossary(defs)
        .map((line) => `- ${line}`)
        .join('\n'),
    ),
  ];
  if (decks) {
    const yours = deckLine(decks[player]);
    const theirs = deckLine(decks[opponent(player)]);
    if (yours && theirs)
      sections.push(section(text.decks, `${text.yourDeck}: ${yours}\n${text.opponentDeck}: ${theirs}`));
  }
  const events = (context.recentEvents ?? []).slice(-MAX_RECENT_EVENTS);
  if (events.length > 0) sections.push(section(text.events, events.map((line) => `- ${line}`).join('\n')));
  const thoughts = (context.recentThoughts ?? []).slice(-MAX_RECENT_THOUGHTS);
  if (thoughts.length > 0) sections.push(section(text.thoughts, thoughts.map((line) => `- ${line}`).join('\n')));
  sections.push(section(text.state, `\`\`\`json\n${compactJson(playerView(s, player))}\n\`\`\``));
  sections.push(
    section(
      text.decision(decision.kind),
      [decision.question, '', text.options, ...decision.options.map((line) => `- ${line}`), '', decision.answer].join(
        '\n',
      ),
    ),
  );
  return { system: systemPrompt(), prompt: sections.join('\n\n') };
}
