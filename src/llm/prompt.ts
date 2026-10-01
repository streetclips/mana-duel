import { KEYWORDS, KEYWORD_NAMES, KEYWORD_REMINDERS, opponent, type GameState, type PlayerId } from '../engine';
import type { Decision } from './decision';
import { cardGlossary, deckCardDefs, deckLine, playerView, visibleCardDefs } from './view';

export interface PromptContext {
  decks?: readonly [string, string] | null;
  recentEvents?: readonly string[];
  recentThoughts?: readonly string[];
}

export interface Prompt {
  system: string;
  prompt: string;
}

export const MAX_RECENT_EVENTS = 30;
export const MAX_RECENT_THOUGHTS = 10;

const KEYWORD_LINES = KEYWORDS.map((keyword) => `  - ${KEYWORD_NAMES[keyword]}: ${KEYWORD_REMINDERS[keyword]}`).join('\n');

export const SYSTEM_PROMPT = `You are an expert player of Mana Duel, a two-player card game played on the core rules of Magic: The Gathering. You play the seat called "you"; the other seat is "opponent". You win when the opponent's life drops to 0 or they must draw from an empty library.

Rules:
- Both players start at 20 life with a 40-card deck and a 7-card hand. You may play one land per turn, in your main phase, while the stack is empty.
- Lands and some creatures tap for mana. Paying is automatic: the game taps your untapped sources for you. "availableMana" lists the untapped sources, one mana each ("R/G" means either color).
- Creatures, lands and sorceries: only in your own main phases with an empty stack. Instants, creatures with Flash and activated abilities: whenever you have priority, even in response to a spell.
- A turn goes untap, upkeep, draw, main phase, combat (declare attackers, declare blockers, damage), second main phase, end step, cleanup. At cleanup you discard down to 7 cards, and damage and "until end of turn" effects wear off. +1/+1 counters ("plusOneCounters") stay on a creature until it leaves the battlefield.
- A creature can't attack or pay {T} costs until it has been under its controller's control since the start of their turn ("summoningSick"), unless it has Haste; it can still block. Attacking taps a creature unless it has Vigilance. Tapped creatures can't block.
- Each blocker blocks one attacker; several creatures may block the same attacker. Combat damage is dealt at the same time; an attacker's damage is split automatically among its blockers. Unblocked attackers damage the defending player.
- A creature dies once the damage marked on it reaches its toughness.
- Spells and abilities go on the stack and resolve last in, first out, once both players pass priority in a row. A spell whose targets are all gone does nothing.
- Tokens ("token": true) are creatures that effects create. A token that leaves the battlefield ceases to exist.
- "damagedThisTurn": true marks a player who was dealt damage this turn, which some cards check. Losing life is not damage. It clears when the next turn begins.
- When an effect makes a player discard, that player chooses the cards. An ability that sacrifices its creature as a cost puts it into the graveyard at once, as a death.
- Keywords:
${KEYWORD_LINES}

You see your hand, both battlefields, both graveyards, the stack, recent events and the reasons you gave for your last decisions. The opponent's hand and both libraries are hidden: you only know how many cards they hold. Both deck lists are public.

Each message ends with the one decision the game waits for, with its legal options. Answer only with the JSON object the schema describes: first a short "reason" (one or two sentences), then your decision. Choose only among the listed options.

Playing well: play a land every turn and spend your mana; attack when the exchange favors you or the opponent can't block well; keep enough blockers back when the opponent threatens lethal damage; aim removal at the biggest threat; don't lose creatures in bad blocks unless the damage would kill you; save instants for the moment they matter most; keep to the plan of your recent thoughts while it still fits the game.`;

const INLINE_WIDTH = 100;

export function compactJson(value: unknown, indent = ''): string {
  const inline = JSON.stringify(value) ?? 'null';
  if (typeof value !== 'object' || value === null || indent.length + inline.length <= INLINE_WIDTH) return inline;
  const inner = `${indent}  `;
  if (Array.isArray(value)) return `[\n${value.map((item) => `${inner}${compactJson(item, inner)}`).join(',\n')}\n${indent}]`;
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  return `{\n${entries.map(([key, item]) => `${inner}${JSON.stringify(key)}: ${compactJson(item, inner)}`).join(',\n')}\n${indent}}`;
}

function section(title: string, body: string): string {
  return `## ${title}\n${body}`;
}

export function buildPrompt(s: GameState, player: PlayerId, decision: Decision, context: PromptContext = {}): Prompt {
  const decks = context.decks ?? null;
  const defs = [...(decks ? decks.flatMap((deck) => deckCardDefs(deck)) : []), ...visibleCardDefs(s, player)];
  const sections = [section('Cards in this game', cardGlossary(defs).map((line) => `- ${line}`).join('\n'))];
  if (decks) {
    const yours = deckLine(decks[player]);
    const theirs = deckLine(decks[opponent(player)]);
    if (yours && theirs) sections.push(section('Decks', `Your deck: ${yours}\nOpponent's deck: ${theirs}`));
  }
  const events = (context.recentEvents ?? []).slice(-MAX_RECENT_EVENTS);
  if (events.length > 0) sections.push(section('Recent events, oldest first', events.map((line) => `- ${line}`).join('\n')));
  const thoughts = (context.recentThoughts ?? []).slice(-MAX_RECENT_THOUGHTS);
  if (thoughts.length > 0) sections.push(section('Your recent thoughts, oldest first', thoughts.map((line) => `- ${line}`).join('\n')));
  sections.push(section('Game state from your seat', `\`\`\`json\n${compactJson(playerView(s, player))}\n\`\`\``));
  sections.push(
    section(`Decision: ${decision.kind}`, [decision.question, '', 'Options:', ...decision.options.map((line) => `- ${line}`), '', decision.answer].join('\n')),
  );
  return { system: SYSTEM_PROMPT, prompt: sections.join('\n\n') };
}
