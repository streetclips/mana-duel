import { describe, expect, it } from 'vitest';
import { chooseAction } from '../../src/ai';
import { applyAction, checkInvariants, createGame, forcedAction, tryApplyAction, type GameState } from '../../src/engine';
import { createLlmPlayer, eventLines, thoughtLine, type DecisionSource } from '../../src/llm';
import { lcg } from '../helpers';
import { mockModel, schemaOf, type ModelCall } from './model';

interface JsonSchema {
  type?: string;
  enum?: string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
}

function anyAnswer(schema: JsonSchema, rand: () => number): unknown {
  const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)] as T;
  if (schema.enum) return pick(schema.enum);
  if (schema.type === 'boolean') return rand() < 0.5;
  if (schema.type === 'string') return 'Any reason.';
  if (schema.type === 'array') {
    const count = Number(/Exactly (\d+)/.exec(schema.description ?? '')?.[1] ?? 1) + (rand() < 0.2 ? 1 : 0);
    return Array.from({ length: count }, () => anyAnswer(schema.items ?? {}, rand));
  }
  return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, value]) => [key, anyAnswer(value, rand)]));
}

describe('an LLM that answers anything its schema allows', () => {
  it('plays whole games in every seat without one illegal action', async () => {
    const sources: Record<DecisionSource, number> = { model: 0, forced: 0, fallback: 0 };
    const matchups: [string, string][] = [
      ['emberwild', 'dawntide'],
      ['duskmire', 'emberwild'],
      ['dawntide', 'duskmire'],
    ];
    for (const [index, decks] of matchups.entries()) {
      const rand = lcg(index + 3);
      const player = createLlmPlayer({ model: mockModel((call: ModelCall) => anyAnswer(schemaOf(call) as JsonSchema, rand)) });
      let s: GameState = createGame({ seed: index + 3, players: [{ deck: decks[0] }, { deck: decks[1] }] });
      const events: string[] = [];
      const thoughts: string[] = [];
      for (let step = 0; step < 3000 && s.pending && s.pending.kind !== 'gameOver'; step++) {
        const seat = s.pending.player;
        let action = seat === 0 ? chooseAction(s, 0) : forcedAction(s);
        if (!action) {
          const decision = await player.decide(s, 1, { decks, recentEvents: events, recentThoughts: thoughts });
          sources[decision.source] += 1;
          if (decision.reason) thoughts.push(thoughtLine(s, 1, decision.reason));
          action = decision.action;
        }
        const result = tryApplyAction(s, action);
        expect(result.ok ? null : result.error).toBeNull();
        s = applyAction(s, action);
        expect(checkInvariants(s)).toEqual([]);
        events.push(...eventLines(s, 1));
      }
      expect(s.pending?.kind).toBe('gameOver');
    }
    expect(sources.model).toBeGreaterThan(50);
    expect(sources.fallback).toBeLessThan(sources.model);
  }, 60_000);
});
