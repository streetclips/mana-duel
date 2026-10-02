import { APICallError, LoadAPIKeyError, NoObjectGeneratedError, Output, RetryError, generateText, type LanguageModel } from 'ai';
import { chooseAction } from '../ai';
import { forcedAction, tryApplyAction, type Action, type GameState, type PlayerId } from '../engine';
import { DecisionError, decisionFor } from './decision';
import { buildPrompt, type PromptContext } from './prompt';

export type DecisionSource = 'model' | 'forced' | 'fallback';

export interface LlmUsage {
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
}

export interface LlmDecision {
  action: Action;
  source: DecisionSource;
  model: string;
  attempts: number;
  ms: number;
  reason?: string;
  error?: string;
  usage?: LlmUsage;
}

export interface DecideOptions extends PromptContext {
  signal?: AbortSignal;
}

export interface LlmPlayer {
  readonly model: string;
  readonly unavailable: string | null;
  decide(s: GameState, player: PlayerId, options?: DecideOptions): Promise<LlmDecision>;
}

export interface LlmPlayerOptions {
  model: LanguageModel;
  name?: string;
  attempts?: number;
  timeoutMs?: number;
  maxRetries?: number;
  temperature?: number;
  fallback?: (s: GameState, player: PlayerId) => Action;
  clock?: () => number;
}

export const DEFAULT_ATTEMPTS = 2;
export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_RETRIES = 1;

const FATAL_STATUS = new Set([400, 401, 402, 403, 404]);
const MAX_ERROR_LENGTH = 240;

function apiErrorOf(error: unknown): APICallError | null {
  if (APICallError.isInstance(error)) return error;
  if (RetryError.isInstance(error) && APICallError.isInstance(error.lastError)) return error.lastError;
  return null;
}

function isFatal(error: unknown): boolean {
  if (LoadAPIKeyError.isInstance(error)) return true;
  const status = apiErrorOf(error)?.statusCode;
  return status !== undefined && FATAL_STATUS.has(status);
}

function isAnswerFailure(error: unknown): boolean {
  return error instanceof DecisionError || NoObjectGeneratedError.isInstance(error);
}

function clip(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > MAX_ERROR_LENGTH ? `${line.slice(0, MAX_ERROR_LENGTH - 1)}…` : line;
}

export function describeFailure(error: unknown): string {
  const api = apiErrorOf(error);
  if (api?.statusCode === 404 && /no endpoints found/i.test(api.message)) {
    return 'OpenRouter 404: ningún proveedor de este modelo acepta el esquema JSON (o el esfuerzo de razonamiento)';
  }
  if (api) return clip(`OpenRouter ${api.statusCode ?? 'error'}: ${api.message}`);
  if (NoObjectGeneratedError.isInstance(error)) {
    const cause = error.cause instanceof Error ? `: ${error.cause.message}` : '';
    return clip(`la respuesta no cumplía el esquema${cause}`);
  }
  if (error instanceof DecisionError) return clip(`respuesta ilegal: ${error.message}`);
  return clip(error instanceof Error ? error.message : String(error));
}

function reasonOf(answer: unknown): string | undefined {
  if (!answer || typeof answer !== 'object') return undefined;
  const reason = (answer as Record<string, unknown>).reason;
  return typeof reason === 'string' && reason.trim() ? clip(reason) : undefined;
}

function costOf(metadata: unknown): number | undefined {
  const usage = (metadata as { openrouter?: { usage?: { cost?: unknown } } } | undefined)?.openrouter?.usage;
  return typeof usage?.cost === 'number' ? usage.cost : undefined;
}

function durationText(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${Math.round(ms / 1000)} s`;
}

interface Deadline {
  signal: AbortSignal;
  expired: () => boolean;
  clear: () => void;
}

function deadline(ms: number, parent?: AbortSignal): Deadline {
  const controller = new AbortController();
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    controller.abort(new Error(`sin respuesta en ${durationText(ms)}`));
  }, ms);
  const forward = (): void => controller.abort(parent?.reason);
  if (parent?.aborted) forward();
  else parent?.addEventListener('abort', forward, { once: true });
  return {
    signal: controller.signal,
    expired: () => expired,
    clear: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', forward);
    },
  };
}

function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  if (reason instanceof Error) return reason;
  const error = new Error('se canceló la decisión');
  error.name = 'AbortError';
  return error;
}

export function createLlmPlayer(options: LlmPlayerOptions): LlmPlayer {
  const model = options.model;
  const name = options.name ?? (typeof model === 'string' ? model : model.modelId);
  const attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const fallback = options.fallback ?? chooseAction;
  const clock = options.clock ?? (() => Date.now());
  let unavailable: string | null = null;

  return {
    model: name,
    get unavailable() {
      return unavailable;
    },
    async decide(s, player, decideOptions = {}) {
      const started = clock();
      const finish = (decision: Omit<LlmDecision, 'model' | 'ms'>): LlmDecision => ({ model: name, ms: clock() - started, ...decision });
      const decision = decisionFor(s, player);
      const forced = forcedAction(s);
      if (forced) return finish({ action: forced, source: 'forced', attempts: 0 });
      if (unavailable) return finish({ action: fallback(s, player), source: 'fallback', attempts: 0, error: unavailable });

      const prompt = buildPrompt(s, player, decision, decideOptions);
      const limit = deadline(timeoutMs, decideOptions.signal);
      let feedback = '';
      let error = '';
      let tries = 0;
      try {
        while (tries < attempts) {
          if (decideOptions.signal?.aborted) throw abortError(decideOptions.signal);
          tries += 1;
          try {
            const result = await generateText({
              model,
              output: Output.object({
                schema: decision.schema,
                name: 'decision',
                description: `Tu respuesta a la decisión "${decision.kind}".`,
              }),
              system: prompt.system,
              prompt: prompt.prompt + feedback,
              abortSignal: limit.signal,
              maxRetries,
              temperature: options.temperature,
            });
            const answer: unknown = result.output;
            const action = decision.toAction(answer);
            const check = tryApplyAction(s, action);
            if (!check.ok) throw new DecisionError(check.error);
            return finish({
              action,
              source: 'model',
              attempts: tries,
              reason: reasonOf(answer),
              usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cost: costOf(result.finalStep.providerMetadata) },
            });
          } catch (failure) {
            if (decideOptions.signal?.aborted) throw abortError(decideOptions.signal);
            if (limit.expired()) {
              error = `sin respuesta en ${durationText(timeoutMs)}`;
              break;
            }
            error = describeFailure(failure);
            if (isFatal(failure)) {
              unavailable = error;
              break;
            }
            if (isAnswerFailure(failure)) {
              feedback = `\n\nTu respuesta anterior fue rechazada (${error}). Responde otra vez y elige solo entre las opciones de la lista.`;
            }
          }
        }
      } finally {
        limit.clear();
      }
      return finish({ action: fallback(s, player), source: 'fallback', attempts: tries, error });
    },
  };
}
