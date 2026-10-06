import type { Color } from '../engine';

export const SOUNDS = [
  'draw',
  'discard',
  'land',
  'cast',
  'ability',
  'enter',
  'attack',
  'block',
  'strike',
  'damage',
  'hurt',
  'drain',
  'heal',
  'pump',
  'shrink',
  'dies',
  'bounce',
  'counter',
  'fizzle',
  'turn',
  'victory',
  'defeat',
  'stalemate',
] as const;

export type SoundId = (typeof SOUNDS)[number];

export const JINGLES: ReadonlySet<SoundId> = new Set<SoundId>(['victory', 'defeat', 'stalemate']);

export interface SoundEvent {
  sound: SoundId;
  seq: number;
  at: number;
  gain: number;
  pitch: number;
  color: Color | null;
}

export function isSoundId(value: unknown): value is SoundId {
  return typeof value === 'string' && (SOUNDS as readonly string[]).includes(value);
}

export function soundEvent(sound: SoundId, options: Partial<Omit<SoundEvent, 'sound'>> = {}): SoundEvent {
  return {
    sound,
    seq: options.seq ?? 0,
    at: options.at ?? 0,
    gain: options.gain ?? 1,
    pitch: options.pitch ?? 0,
    color: options.color ?? null,
  };
}
