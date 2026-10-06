import { messages } from '../../i18n';
import { en } from './en';
import { es } from './es';
import type { LlmText } from './types';

export const llmText = messages<LlmText>({ es, en });
