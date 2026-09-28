import type { ReasoningEffort } from '../llm/models';
import { openRouterModel } from '../llm/openrouter';
import { createLlmPlayer } from '../llm/player';
import type { LlmFactory } from './controller';

export const PROXY_API_KEY = 'dev-proxy';

export interface OpenRouterAccess {
  apiKey: () => string | null | undefined;
  proxyUrl?: string | null;
  fetch?: typeof fetch;
  timeoutMs?: number;
  reasoningEffort?: ReasoningEffort;
}

export function openRouterFactory(access: OpenRouterAccess): LlmFactory {
  return (setup) => {
    const key = access.apiKey()?.trim();
    const viaProxy = !key && !!access.proxyUrl;
    return createLlmPlayer({
      name: setup.model,
      timeoutMs: access.timeoutMs,
      model: openRouterModel({
        model: setup.model,
        apiKey: viaProxy ? PROXY_API_KEY : key || undefined,
        baseURL: viaProxy ? (access.proxyUrl ?? undefined) : undefined,
        fetch: access.fetch,
        reasoningEffort: setup.effort ?? access.reasoningEffort,
      }),
    });
  };
}
