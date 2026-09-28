import type { OpponentSetup } from '../app/controller';
import { DEFAULT_MODEL, isModelId, isReasoningEffort, type ReasoningEffort } from '../llm/models';

export type OpponentKind = OpponentSetup['kind'];

export interface OpponentChoice {
  kind: OpponentKind;
  model: string;
  effort: ReasoningEffort | null;
}

const CHOICE_KEY = 'manaDuel.opponent';
const API_KEY_KEY = 'manaDuel.openrouterKey';

export const DEFAULT_OPPONENT: OpponentChoice = { kind: 'classic', model: DEFAULT_MODEL, effort: null };

export function isOpponentChoice(value: unknown): value is OpponentChoice {
  if (!value || typeof value !== 'object') return false;
  const { kind, model, effort } = value as Record<string, unknown>;
  return (kind === 'classic' || kind === 'llm') && typeof model === 'string' && (effort === null || isReasoningEffort(effort));
}

export function loadOpponentChoice(): OpponentChoice {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? 'null');
    return isOpponentChoice(stored) ? { kind: stored.kind, model: stored.model, effort: stored.effort } : { ...DEFAULT_OPPONENT };
  } catch {
    return { ...DEFAULT_OPPONENT };
  }
}

export function saveOpponentChoice(choice: OpponentChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(choice));
  } catch {
    return;
  }
}

export function loadApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(API_KEY_KEY, key.trim());
    else localStorage.removeItem(API_KEY_KEY);
  } catch {
    return;
  }
}

export function opponentSetup(choice: OpponentChoice): OpponentSetup {
  if (choice.kind === 'classic') return { kind: 'classic' };
  return choice.effort ? { kind: 'llm', model: choice.model.trim(), effort: choice.effort } : { kind: 'llm', model: choice.model.trim() };
}

export function llmProblem(choice: OpponentChoice, apiKey: string, proxy: boolean): string | null {
  if (choice.kind !== 'llm') return null;
  if (!isModelId(choice.model)) return `Enter an OpenRouter model id, like ${DEFAULT_MODEL}.`;
  if (!apiKey.trim() && !proxy) return 'Enter your OpenRouter API key.';
  return null;
}
