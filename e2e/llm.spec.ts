import { expect, test, type Page, type Route } from '@playwright/test';

interface Schema {
  type?: string;
  enum?: string[];
  description?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
}

interface ChatBody {
  model: string;
  messages: { role: string; content: string | { type: string; text?: string }[] }[];
  response_format?: { type: string; json_schema?: { name: string; strict: boolean; schema: Schema } };
}

interface Sent {
  headers: Record<string, string>;
  body: ChatBody;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

function cautious(schema: Schema): unknown {
  if (schema.enum) return schema.enum[0];
  if (schema.type === 'boolean') return false;
  if (schema.type === 'string') return 'Playing it safe.';
  if (schema.type === 'array') {
    const count = Number(/Exactly (\d+)/.exec(schema.description ?? '')?.[1] ?? 0);
    return (schema.items?.enum ?? []).slice(0, count);
  }
  return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, value]) => [key, cautious(value)]));
}

function textOf(body: ChatBody, role: string): string {
  const message = body.messages.find((candidate) => candidate.role === role);
  if (!message) return '';
  return typeof message.content === 'string' ? message.content : message.content.map((part) => part.text ?? '').join('');
}

async function mockOpenRouter(page: Page, status = 200): Promise<Sent[]> {
  const sent: Sent[] = [];
  const preflight = async (route: Route): Promise<boolean> => {
    if (route.request().method() !== 'OPTIONS') return false;
    await route.fulfill({ status: 204, headers: CORS });
    return true;
  };
  await page.route('https://openrouter.ai/api/v1/models', async (route) => {
    if (await preflight(route)) return;
    await route.fulfill({
      headers: CORS,
      json: { data: [{ id: 'mock/model', name: 'Mock', supported_parameters: ['structured_outputs'], pricing: { prompt: '0', completion: '0' } }] },
    });
  });
  await page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
    if (await preflight(route)) return;
    const body = route.request().postDataJSON() as ChatBody;
    sent.push({ headers: route.request().headers(), body });
    if (status !== 200) {
      await route.fulfill({ status, headers: CORS, json: { error: { code: status, message: 'No auth credentials found' } } });
      return;
    }
    const answer = cautious(body.response_format?.json_schema?.schema ?? {});
    await route.fulfill({
      headers: CORS,
      json: {
        id: `gen-${sent.length}`,
        object: 'chat.completion',
        created: 0,
        model: body.model,
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(answer) } }],
        usage: { prompt_tokens: 1800, completion_tokens: 20, total_tokens: 1820, cost: 0.0002 },
      },
    });
  });
  return sent;
}

function collectErrors(page: Page, allowed: RegExp[] = []): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !allowed.some((pattern) => pattern.test(message.text()))) errors.push(message.text());
  });
  return errors;
}

test('an LLM from OpenRouter plays the AI seat, seeing only what the AI may see', async ({ page }) => {
  const errors = collectErrors(page);
  const sent = await mockOpenRouter(page);
  await page.goto('/');
  await page.getByTestId('ai-llm').click();
  await expect(page.getByTestId('btn-play')).toBeDisabled();
  await page.getByTestId('llm-model').fill('mock/model');
  await page.getByTestId('llm-key').fill('sk-or-e2e');
  await expect(page.getByTestId('llm-models').locator('option[value="mock/model"]')).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('player-tag-1')).toHaveText('LLM');
  expect(await page.evaluate(() => window.manaDuel.opponent())).toEqual({ kind: 'llm', model: 'mock/model' });

  await page.evaluate(() => window.manaDuel.setAiDelay(0));
  if ((await page.evaluate(() => window.manaDuel.pending()))?.kind !== 'mulligan') await page.evaluate(() => window.manaDuel.idle());
  await page.evaluate(() => window.manaDuel.dispatch({ type: 'keep', player: 0 }));
  await page.evaluate(() => window.manaDuel.idle());
  await expect.poll(() => sent.length).toBeGreaterThan(0);

  const [first] = sent;
  if (!first) throw new Error('no request reached OpenRouter');
  expect(first.headers.authorization).toBe('Bearer sk-or-e2e');
  expect(first.body.model).toBe('mock/model');
  expect(first.body.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'decision', strict: true } });
  expect(textOf(first.body, 'system')).toContain('You play the seat called "you"');
  const hand = await page.evaluate(() => window.manaDuel.state().players[0].hand);
  for (const request of sent) {
    const prompt = textOf(request.body, 'user');
    expect(prompt).toContain('## Game state from your seat');
    for (const id of hand) expect(prompt).not.toMatch(new RegExp(`\\b${id}\\b`));
  }

  const decisions = await page.evaluate(() => window.manaDuel.llmDecisions());
  expect(decisions.length).toBeGreaterThan(0);
  expect(decisions[0]).toMatchObject({ source: 'model', model: 'mock/model', reason: 'Playing it safe.', usage: { cost: 0.0002 } });
  await page.getByTestId('btn-menu').click();
  await page.getByTestId('menu-log').click();
  await expect(page.getByTestId('log-panel').locator('li.note').first()).toHaveText('AI thinks: Playing it safe.');
  expect(errors).toEqual([]);
});

test('the classic AI takes over when OpenRouter refuses the key', async ({ page }) => {
  const errors = collectErrors(page, [/status of 401/]);
  const sent = await mockOpenRouter(page, 401);
  await page.addInitScript(() => localStorage.setItem('manaDuel.openrouterKey', 'sk-or-revoked'));
  await page.goto('/?ai=llm&model=mock/model&seed=4&first=ai&aiDelay=0');
  await expect(page.getByTestId('llm-notice-text')).toHaveText(
    'LLM unavailable: OpenRouter 401: No auth credentials found. The classic AI is playing.',
  );
  await expect(page.getByTestId('game')).toHaveAttribute('data-llm', 'unavailable');
  await expect(page.getByTestId('prompt')).toHaveText('Keep your opening hand?');
  await page.getByTestId('llm-notice-hide').click();
  await expect(page.getByTestId('llm-notice')).toHaveCount(0);
  await page.getByTestId('btn-keep').click();
  expect((await page.evaluate(() => window.manaDuel.idle()))?.kind).not.toBe('mulligan');
  expect(sent).toHaveLength(1);
  expect(errors).toEqual([]);
});
