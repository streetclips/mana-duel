import { messages } from '../../i18n';

export const loadingText = messages({
  es: {
    codeFailed: (message: string) => `el código del LLM no se cargó (${message})`,
    modelList: (status: string) => `OpenRouter ${status}: la lista de modelos no está disponible`,
  },
  en: {
    codeFailed: (message: string) => `the LLM code failed to load (${message})`,
    modelList: (status: string) => `OpenRouter ${status}: the model list is unavailable`,
  },
});
