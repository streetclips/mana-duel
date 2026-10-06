import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chooseAction } from '../../src/ai';
import { DECK_LIST, applyAction, createGame, forcedAction, type PlayerId } from '../../src/engine';
import { setLocale } from '../../src/i18n';
import { DecisionError, buildPrompt, decisionFor, describeAction, describeFailure, eventLines, systemPrompt, thoughtLine } from '../../src/llm';
import { spanishIn } from '../i18n';
import { scenario } from '../helpers';

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('es'));

function mainPhase() {
  return scenario({
    activePlayer: 1,
    players: [
      { battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      {
        hand: [{ card: 'forest', id: 'f' }, { card: 'ember_snap', id: 'snap' }],
        battlefield: ['mountain', { card: 'crag_dragon', id: 'dragon' }],
      },
    ],
  });
}

describe('the LLM prompt in English', () => {
  it('explains the rules and every keyword in English, and asks for the reason in English', () => {
    const system = systemPrompt();
    expect(system).toMatch(/^You are an expert player of Mana Duel/);
    expect(system).toContain("  - Flying: Can't be blocked except by creatures with flying or reach.");
    expect(system).toContain('first a short "reason" (one or two sentences, in English)');
    expect(spanishIn(system)).toEqual([]);
  });

  it('names the cards and the decks in English', () => {
    const s = mainPhase();
    const { prompt } = buildPrompt(s, 1, decisionFor(s, 1), { decks: ['emberwild', 'duskmire'], recentEvents: ['Event.'], recentThoughts: ['Thought.'] });
    expect(prompt).toContain('## Cards in this game\n');
    expect(prompt).toContain('- Crag Dragon · {3}{R}{R} · Creature — Dragon · 4/4 · Flying {R}: This creature gets +1/+0 until end of turn.');
    expect(prompt).toContain('Your deck: "Duskmire" ("Black: deathtouch, removal, and life drain; its dead strike back."): 16 Swamp, ');
    expect(prompt).toContain('The opponent\'s deck: "Emberwild"');
    expect(prompt).toContain('## Recent events, oldest first\n- Event.');
    expect(prompt).toContain('## Your recent thoughts, oldest first\n- Thought.');
    expect(prompt).toContain('## Game state from your seat\n');
    expect(prompt).toContain('## Decision: priority\nYou have priority during your turn, step: Main phase, with an empty stack.\n\nOptions:\n- 1: Pass priority');
    expect(prompt).toContain('Answer with "choice": the id of exactly one option.');
    expect(spanishIn(prompt)).toEqual([]);
  });

  it('describes the options from the deciding seat', () => {
    const s = mainPhase();
    expect(describeAction(s, { type: 'playLand', player: 1, card: 'f' }, 1)).toBe('Play the land Forest (f)');
    expect(describeAction(s, { type: 'cast', player: 1, card: 'snap', targets: [{ card: 'elf' }] }, 1)).toBe(
      "Cast Ember Snap (snap) for {R} targeting the opponent's Grove Tender (elf)",
    );
    expect(describeAction(s, { type: 'cast', player: 1, card: 'snap', targets: [{ player: 1 }] }, 1)).toBe('Cast Ember Snap (snap) for {R} targeting you');
    expect(describeAction(s, { type: 'activate', player: 1, card: 'dragon', ability: 0, targets: [] }, 1)).toBe(
      'Activate your Crag Dragon (dragon): "{R}: This creature gets +1/+0 until end of turn."',
    );
    expect(describeAction(s, { type: 'concede', player: 1 }, 1)).toBe('Concede');
  });

  it('keeps every prompt, option and schema free of Spanish through whole games of every deck', () => {
    const leaks = new Set<string>();
    const decks = DECK_LIST.map((deck) => deck.id);
    for (let index = 0; index < decks.length; index += 2) {
      const matchup = [decks[index] as string, decks[index + 1] as string] as const;
      let s = createGame({ seed: index + 3, players: [{ deck: matchup[0] }, { deck: matchup[1] }] });
      const events: string[] = [];
      for (let step = 0; s.pending && s.pending.kind !== 'gameOver' && step < 300; step++) {
        const player = s.pending.player as PlayerId;
        if (player === 1 && !forcedAction(s)) {
          const decision = decisionFor(s, 1);
          const { system, prompt } = buildPrompt(s, 1, decision, { decks: matchup, recentEvents: events });
          const schema = JSON.stringify(decision.schema.toJSONSchema());
          for (const word of spanishIn(`${system}\n${prompt}\n${schema}`)) leaks.add(word);
        }
        s = applyAction(s, chooseAction(s, player));
        events.push(...eventLines(s, 1));
      }
    }
    expect([...leaks]).toEqual([]);
  });

  it('tells its thoughts and its failures in English', () => {
    const s = mainPhase();
    expect(thoughtLine(s, 1, 'Hold Ember Snap.')).toBe('Turn 3 (your turn), Main phase: Hold Ember Snap.');
    expect(thoughtLine(s, 0, 'Keep the elf back.')).toBe("Turn 3 (the opponent's turn), Main phase: Keep the elf back.");
    expect(describeFailure(new DecisionError('"9" is not one of the listed options'))).toBe('illegal answer: "9" is not one of the listed options');
    expect(() => decisionFor(s, 0)).toThrow("it isn't player 0's decision");
  });
});
