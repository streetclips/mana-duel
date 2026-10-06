import { messages } from '../../i18n';
import type { ReasoningEffort } from '../../llm/models';

const EFFORTS_ES: Record<ReasoningEffort, string> = { minimal: 'Mínimo', low: 'Bajo', medium: 'Medio', high: 'Alto' };

const EFFORTS_EN: Record<ReasoningEffort, string> = { minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High' };

export const commonText = messages({
  es: {
    title: 'Duelo de Maná',
    description: 'Duelo de Maná: un duelo de cartas minimalista contra una IA.',
    you: 'Tú',
    ai: 'IA',
    aiLlm: 'IA · LLM',
    random: 'Aleatorio',
    efforts: EFFORTS_ES,
    continueExpedition: 'Continuar la expedición',
    backToExpedition: 'Volver a la expedición',
    continueDraft: 'Continuar el draft',
    backToDraft: 'Volver al draft',
  },
  en: {
    title: 'Mana Duel',
    description: 'Mana Duel: a minimalist card duel against an AI.',
    you: 'You',
    ai: 'AI',
    aiLlm: 'AI · LLM',
    random: 'Random',
    efforts: EFFORTS_EN,
    continueExpedition: 'Continue the expedition',
    backToExpedition: 'Back to the expedition',
    continueDraft: 'Continue the draft',
    backToDraft: 'Back to the draft',
  },
});
