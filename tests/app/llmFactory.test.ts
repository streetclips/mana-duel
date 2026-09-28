import { describe, expect, it } from 'vitest';
import { PROXY_API_KEY, openRouterFactory } from '../../src/app/llmFactory';
import type { GameState } from '../../src/engine';
import { OPENROUTER_API_URL } from '../../src/llm';
import { scenario } from '../helpers';

interface Sent {
  url: string;
  authorization: string | null;
  body: { model: string; reasoning?: unknown };
}

function fakeOpenRouter(): { fetch: typeof fetch; sent: Sent[] } {
  const sent: Sent[] = [];
  return {
    sent,
    fetch: async (input, init) => {
      const body = JSON.parse(String(init?.body)) as Sent['body'];
      sent.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization'), body });
      const answer = { reason: 'Pass.', choice: '1' };
      return new Response(
        JSON.stringify({
          id: 'gen',
          object: 'chat.completion',
          created: 0,
          model: body.model,
          choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(answer) } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  };
}

function aChoice(): GameState {
  return scenario({ activePlayer: 1, players: [{}, { hand: ['forest', 'forest'] }] });
}

describe('the OpenRouter factory', () => {
  it('sends the typed key straight to OpenRouter, with the model and effort of the setup', async () => {
    const api = fakeOpenRouter();
    const factory = openRouterFactory({ apiKey: () => ' sk-or-typed ', proxyUrl: 'http://localhost:5173/openrouter/v1', fetch: api.fetch });
    const player = factory({ kind: 'llm', model: 'google/gemini-3.8-flash', effort: 'low' });
    expect(player.model).toBe('google/gemini-3.8-flash');
    await player.decide(aChoice(), 1);
    expect(api.sent).toEqual([
      {
        url: `${OPENROUTER_API_URL}/chat/completions`,
        authorization: 'Bearer sk-or-typed',
        body: expect.objectContaining({ model: 'google/gemini-3.8-flash', reasoning: { effort: 'low' } }),
      },
    ]);
  });

  it('goes through the dev server proxy when no key is typed', async () => {
    const api = fakeOpenRouter();
    const factory = openRouterFactory({ apiKey: () => '', proxyUrl: 'http://localhost:5173/openrouter/v1', fetch: api.fetch });
    await factory({ kind: 'llm', model: 'openai/gpt-6-luna' }).decide(aChoice(), 1);
    expect(api.sent[0]).toMatchObject({ url: 'http://localhost:5173/openrouter/v1/chat/completions', authorization: `Bearer ${PROXY_API_KEY}` });
    expect(api.sent[0]?.body.reasoning).toBeUndefined();
  });
});
