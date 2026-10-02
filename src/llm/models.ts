export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_MODEL = 'openai/gpt-6-luna';
export const SUGGESTED_MODELS: readonly string[] = [
  DEFAULT_MODEL,
  'google/gemini-3.8-flash',
  'deepseek/deepseek-v4.1-flash',
  'qwen/qwen3.8-flash',
  'anthropic/claude-sonnet-5',
  'x-ai/grok-4.7',
];

export const REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high'] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const EFFORT_LABELS: Record<ReasoningEffort, string> = { minimal: 'Mínimo', low: 'Bajo', medium: 'Medio', high: 'Alto' };

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return REASONING_EFFORTS.some((effort) => effort === value);
}

export function isModelId(value: string): boolean {
  return /^[\w.-]+\/[\w.:@-]+$/.test(value.trim());
}

export interface ModelInfo {
  id: string;
  name: string;
  promptPrice: number | null;
  completionPrice: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function perMillion(price: unknown): number | null {
  const value = typeof price === 'string' ? Number(price) : Number.NaN;
  return Number.isFinite(value) ? Math.round(value * 1e6 * 1000) / 1000 : null;
}

function modelInfo(model: unknown): ModelInfo[] {
  if (!isRecord(model) || typeof model.id !== 'string') return [];
  const parameters = Array.isArray(model.supported_parameters) ? model.supported_parameters : [];
  if (!parameters.includes('structured_outputs')) return [];
  const pricing = isRecord(model.pricing) ? model.pricing : {};
  return [
    {
      id: model.id,
      name: typeof model.name === 'string' ? model.name : model.id,
      promptPrice: perMillion(pricing.prompt),
      completionPrice: perMillion(pricing.completion),
    },
  ];
}

export async function fetchModels(options: { fetch?: typeof fetch; signal?: AbortSignal } = {}): Promise<ModelInfo[]> {
  const response = await (options.fetch ?? fetch)(`${OPENROUTER_API_URL}/models`, { signal: options.signal });
  if (!response.ok) throw new Error(`OpenRouter ${response.status}: la lista de modelos no está disponible`);
  const catalog: unknown = await response.json();
  const data = isRecord(catalog) && Array.isArray(catalog.data) ? catalog.data : [];
  return data.flatMap(modelInfo).sort((a, b) => a.id.localeCompare(b.id));
}
