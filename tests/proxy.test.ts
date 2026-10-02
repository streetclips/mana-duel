import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { openRouterProxy } from '../scripts/openrouterProxy';

interface Forwarded {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: unknown;
}

let server: Server | null = null;

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

async function start(upstream: typeof fetch): Promise<string> {
  const handle = openRouterProxy({ apiKey: 'sk-secret', upstream: 'https://upstream.test/api/v1', fetch: upstream });
  server = createServer((req, res) => void handle(req, res));
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server?.address() as AddressInfo).port}`;
}

function recorder(): { fetch: typeof fetch; seen: Forwarded[] } {
  const seen: Forwarded[] = [];
  return {
    seen,
    fetch: async (input, init) => {
      seen.push({
        url: String(input),
        method: init?.method,
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  };
}

describe('the dev server OpenRouter proxy', () => {
  it('forwards the game’s own requests with the server’s key', async () => {
    const upstream = recorder();
    const base = await start(upstream.fetch);
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { origin: base, 'content-type': 'application/json', authorization: 'Bearer dev-proxy' },
      body: JSON.stringify({ model: 'openai/gpt-6-luna' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(upstream.seen).toEqual([
      {
        url: 'https://upstream.test/api/v1/chat/completions',
        method: 'POST',
        headers: { authorization: 'Bearer sk-secret', 'content-type': 'application/json', 'x-openrouter-title': 'Mana Duel' },
        body: { model: 'openai/gpt-6-luna' },
      },
    ]);
  });

  it('refuses requests from other sites or without an origin', async () => {
    const upstream = recorder();
    const base = await start(upstream.fetch);
    const attempts: Record<string, string>[] = [{ origin: 'https://elsewhere.example' }, {}];
    for (const headers of attempts) {
      const response = await fetch(`${base}/chat/completions`, { method: 'POST', headers, body: '{}' });
      expect(response.status).toBe(403);
    }
    expect(upstream.seen).toEqual([]);
  });

  it('answers 502 when OpenRouter cannot be reached', async () => {
    const base = await start(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    });
    const response = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { origin: base }, body: '{}' });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: 502, message: 'No se puede contactar con OpenRouter: getaddrinfo ENOTFOUND' } });
  });
});
