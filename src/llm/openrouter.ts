import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import { OPENROUTER_API_URL, type ReasoningEffort } from './models';

export interface OpenRouterOptions {
  model: string;
  apiKey?: string;
  baseURL?: string;
  fetch?: typeof fetch;
  reasoningEffort?: ReasoningEffort;
}

export function openRouterModel(options: OpenRouterOptions): LanguageModel {
  const provider = createOpenRouter({
    apiKey: options.apiKey,
    baseURL: options.baseURL ?? OPENROUTER_API_URL,
    fetch: options.fetch,
    compatibility: 'strict',
    appName: 'Mana Duel',
  });
  return provider.chat(options.model, {
    provider: { require_parameters: true },
    usage: { include: true },
    ...(options.reasoningEffort ? { reasoning: { effort: options.reasoningEffort } } : {}),
  });
}
