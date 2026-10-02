import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

export const PROXY_PATH = '/openrouter/v1';
export const OPENROUTER_UPSTREAM = 'https://openrouter.ai/api/v1';

export interface ProxyOptions {
  apiKey: string;
  upstream?: string;
  fetch?: typeof fetch;
}

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

function sameOrigin(req: IncomingMessage): boolean {
  const { origin, host } = req.headers;
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
}

function fail(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: { code: status, message } }));
}

export function openRouterProxy(options: ProxyOptions): Handler {
  const upstream = options.upstream ?? OPENROUTER_UPSTREAM;
  const send = options.fetch ?? fetch;
  return async (req, res) => {
    if (!sameOrigin(req)) return fail(res, 403, 'El proxy de OpenRouter solo responde al juego que sirve este servidor de desarrollo.');
    try {
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
      const response = await send(`${upstream}${req.url ?? ''}`, {
        method: req.method,
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          'content-type': req.headers['content-type'] ?? 'application/json',
          'x-openrouter-title': 'Mana Duel',
        },
        body,
      });
      res.statusCode = response.status;
      res.setHeader('content-type', response.headers.get('content-type') ?? 'application/json');
      res.end(await response.text());
    } catch (error) {
      fail(res, 502, `No se puede contactar con OpenRouter: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

export function openRouterProxyPlugin(apiKey: string): Plugin {
  return {
    name: 'mana-duel:openrouter-proxy',
    apply: 'serve',
    configureServer(server) {
      const handle = openRouterProxy({ apiKey });
      server.middlewares.use(PROXY_PATH, (req, res) => void handle(req, res));
    },
  };
}
