import { describe, expect, it } from 'vitest';
import { getLegalActions, type GameState } from '../../src/engine';
import {
  DEFAULT_MODEL,
  OPENROUTER_API_URL,
  createLlmPlayer,
  fetchModels,
  isModelId,
  openRouterModel,
} from '../../src/llm';
import { scenario } from '../helpers';

interface ChatRequest {
  model: string;
  messages: { role: string; content: string | { type: string; text?: string }[] }[];
  response_format?: {
    type: string;
    json_schema?: { name: string; strict: boolean; schema: { properties: { choice?: { enum: string[] } } } };
  };
  provider?: unknown;
  reasoning?: unknown;
  temperature?: unknown;
}

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: ChatRequest;
}

type Reply = ((body: ChatRequest) => unknown) | { status: number; message: string };

function fakeOpenRouter(reply: Reply): { fetch: typeof fetch; sent: Sent[] } {
  const sent: Sent[] = [];
  const fake: typeof fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body)) as ChatRequest;
    sent.push({ url: String(input), headers: Object.fromEntries(new Headers(init?.headers).entries()), body });
    if (typeof reply !== 'function') {
      return new Response(JSON.stringify({ error: { code: reply.status, message: reply.message } }), {
        status: reply.status,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({
        id: 'gen-1',
        object: 'chat.completion',
        created: 0,
        model: body.model,
        provider: 'Test',
        choices: [
          { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(reply(body)) } },
        ],
        usage: { prompt_tokens: 1500, completion_tokens: 40, total_tokens: 1540, cost: 0.00031 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  return { fetch: fake, sent };
}

function userText(body: ChatRequest): string {
  const user = body.messages.find((message) => message.role === 'user');
  if (!user) return '';
  return typeof user.content === 'string' ? user.content : user.content.map((part) => part.text ?? '').join('');
}

function pickLand(body: ChatRequest): { reason: string; choice: string } {
  const line = userText(body)
    .split('\n')
    .find((candidate) => candidate.includes('Jugar la tierra'));
  const id = /^- (\d+):/.exec(line ?? '')?.[1];
  if (!id) throw new Error('no land option in the prompt');
  return { reason: 'Land drop.', choice: id };
}

function mainPhase(): GameState {
  return scenario({
    activePlayer: 1,
    players: [{}, { hand: [{ card: 'forest', id: 'f' }, 'ember_snap'], battlefield: ['mountain'] }],
  });
}

describe('the OpenRouter model', () => {
  it('asks for one chat completion with the decision schema, routed only to providers that honor it', async () => {
    const api = fakeOpenRouter(pickLand);
    const player = createLlmPlayer({
      model: openRouterModel({ model: 'openai/gpt-6-luna', apiKey: 'sk-test', fetch: api.fetch }),
    });
    const decision = await player.decide(mainPhase(), 1);
    expect(decision).toMatchObject({
      action: { type: 'playLand', player: 1, card: 'f' },
      source: 'model',
      model: 'openai/gpt-6-luna',
      reason: 'Land drop.',
      usage: { inputTokens: 1500, outputTokens: 40, cost: 0.00031 },
    });
    expect(api.sent).toHaveLength(1);
    const [request] = api.sent;
    expect(request?.url).toBe(`${OPENROUTER_API_URL}/chat/completions`);
    expect(request?.headers.authorization).toBe('Bearer sk-test');
    expect(request?.headers['x-openrouter-title']).toBe('Mana Duel');
    expect(request?.body.model).toBe('openai/gpt-6-luna');
    expect(request?.body.provider).toEqual({ require_parameters: true });
    expect(request?.body.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'decision', strict: true },
    });
    const ids = getLegalActions(mainPhase()).map((_, index) => String(index + 1));
    expect(request?.body.response_format?.json_schema?.schema.properties.choice?.enum).toEqual(ids);
    expect(request?.body.messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(request?.body.temperature).toBeUndefined();
    expect(request?.body.reasoning).toBeUndefined();
  });

  it('asks for a reasoning effort only when one is set', async () => {
    const api = fakeOpenRouter(pickLand);
    const model = openRouterModel({ model: 'x/y', apiKey: 'k', fetch: api.fetch, reasoningEffort: 'low' });
    await createLlmPlayer({ model }).decide(mainPhase(), 1);
    expect(api.sent[0]?.body.reasoning).toEqual({ effort: 'low' });
  });

  it('can go through a proxy that adds the key itself', async () => {
    const api = fakeOpenRouter(pickLand);
    const model = openRouterModel({
      model: 'x/y',
      apiKey: 'proxy',
      baseURL: 'http://localhost:5173/openrouter/api/v1',
      fetch: api.fetch,
    });
    await createLlmPlayer({ model }).decide(mainPhase(), 1);
    expect(api.sent[0]?.url).toBe('http://localhost:5173/openrouter/api/v1/chat/completions');
  });

  it('reports a rejected key and stops asking', async () => {
    const api = fakeOpenRouter({ status: 401, message: 'No auth credentials found' });
    const player = createLlmPlayer({
      model: openRouterModel({ model: DEFAULT_MODEL, apiKey: 'bad', fetch: api.fetch }),
    });
    expect(await player.decide(mainPhase(), 1)).toMatchObject({
      source: 'fallback',
      error: 'OpenRouter 401: No auth credentials found',
    });
    await player.decide(mainPhase(), 1);
    expect(api.sent).toHaveLength(1);
    expect(player.unavailable).toBe('OpenRouter 401: No auth credentials found');
  });

  it('reports a model that cannot answer with a schema', async () => {
    const api = fakeOpenRouter({
      status: 404,
      message: 'No endpoints found that can handle the requested parameters. To learn more…',
    });
    const player = createLlmPlayer({
      model: openRouterModel({ model: 'some/old-model', apiKey: 'k', fetch: api.fetch }),
    });
    await player.decide(mainPhase(), 1);
    expect(player.unavailable).toBe(
      'OpenRouter 404: ningún proveedor de este modelo acepta el esquema JSON (o el esfuerzo de razonamiento)',
    );
    expect(api.sent).toHaveLength(1);
  });
});

describe('the OpenRouter catalog', () => {
  it('lists the models that support structured outputs, with prices per million tokens', async () => {
    const catalog = {
      data: [
        {
          id: 'b/fast',
          name: 'Fast',
          supported_parameters: ['structured_outputs', 'tools'],
          pricing: { prompt: '0.0000001', completion: '0.0000005' },
        },
        { id: 'c/plain', name: 'Plain', supported_parameters: ['tools'], pricing: { prompt: '0', completion: '0' } },
        { id: 'a/smart', name: 'Smart', supported_parameters: ['structured_outputs'] },
      ],
    };
    const urls: string[] = [];
    const fake: typeof fetch = async (input) => {
      urls.push(String(input));
      return new Response(JSON.stringify(catalog), { status: 200 });
    };
    expect(await fetchModels({ fetch: fake })).toEqual([
      { id: 'a/smart', name: 'Smart', promptPrice: null, completionPrice: null },
      { id: 'b/fast', name: 'Fast', promptPrice: 0.1, completionPrice: 0.5 },
    ]);
    expect(urls).toEqual([`${OPENROUTER_API_URL}/models`]);
    await expect(fetchModels({ fetch: async () => new Response('nope', { status: 503 }) })).rejects.toThrow(
      'OpenRouter 503',
    );
  });

  it('recognizes model ids', () => {
    for (const id of ['openai/gpt-6-luna', 'qwen/qwen3.8-27b:free', 'meta-llama/llama-4@latest'])
      expect(isModelId(id)).toBe(true);
    for (const id of ['', 'gpt', 'a b/c', 'openai/']) expect(isModelId(id)).toBe(false);
  });
});
