export interface AudioChoice {
  music: boolean;
  sfx: boolean;
}

const AUDIO_KEY = 'manaDuel.audio';

export const DEFAULT_AUDIO: AudioChoice = { music: true, sfx: true };

export function isAudioChoice(value: unknown): value is AudioChoice {
  if (!value || typeof value !== 'object') return false;
  const { music, sfx } = value as Record<string, unknown>;
  return typeof music === 'boolean' && typeof sfx === 'boolean';
}

export function loadAudioChoice(): AudioChoice {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? 'null');
    return isAudioChoice(stored) ? { music: stored.music, sfx: stored.sfx } : { ...DEFAULT_AUDIO };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

export function saveAudioChoice(choice: AudioChoice): void {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(choice));
  } catch {
    return;
  }
}

function flag(value: string | null, fallback: boolean): boolean {
  if (value === 'on') return true;
  if (value === 'off') return false;
  return fallback;
}

export function audioChoiceFrom(params: URLSearchParams, stored: AudioChoice): AudioChoice {
  return { music: flag(params.get('music'), stored.music), sfx: flag(params.get('sfx'), stored.sfx) };
}
