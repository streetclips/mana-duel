import { DECK_LIST, getDeck, hasDeck, type Color, type DeckDef, type GameState, type PlayerId } from '../engine';

export const MOODS = ['calm', 'danger', 'combat', 'over'] as const;
export type Mood = (typeof MOODS)[number];

export const TIMBRES = ['bell', 'glass', 'reed', 'pulse', 'pluck'] as const;
export type Timbre = (typeof TIMBRES)[number];

export const VOICES = ['pad', 'bass', 'lead', 'kick', 'snare', 'hat'] as const;
export type Voice = (typeof VOICES)[number];

export const STEPS_PER_BEAT = 4;
export const STEPS_PER_BAR = 16;
export const FORM_BARS = 8;
export const DANGER_LIFE = 5;

export interface Mode {
  name: string;
  steps: readonly number[];
}

const IONIAN: Mode = { name: 'Ionian', steps: [0, 2, 4, 5, 7, 9, 11] };
const DORIAN: Mode = { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] };
const PHRYGIAN: Mode = { name: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10] };
const LYDIAN: Mode = { name: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11] };
const MIXOLYDIAN: Mode = { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10] };
const AEOLIAN: Mode = { name: 'Aeolian', steps: [0, 2, 3, 5, 7, 8, 10] };

export interface DrumKit {
  kick: readonly number[];
  snare: readonly number[];
  hat: readonly number[];
}

export interface Theme {
  id: string;
  name: string;
  colors: readonly Color[];
  tempo: number;
  root: number;
  mode: Mode;
  progression: readonly number[];
  arp: readonly number[];
  lead: Timbre;
  drums: DrumKit;
}

export interface Note {
  voice: Voice;
  midi: number;
  velocity: number;
  steps: number;
  bright: number;
  timbre?: Timbre;
}

type ColorMusic = Omit<Theme, 'id' | 'name' | 'colors'>;

const COLOR_MUSIC: Record<Color, ColorMusic> = {
  W: {
    tempo: 92,
    root: 60,
    mode: IONIAN,
    progression: [0, 4, 5, 3],
    arp: [0, -1, 1, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 2, -1],
    lead: 'bell',
    drums: { kick: [0, 8], snare: [4, 12, 15], hat: [2, 6, 10, 14] },
  },
  U: {
    tempo: 84,
    root: 62,
    mode: DORIAN,
    progression: [0, 6, 3, 4],
    arp: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1],
    lead: 'glass',
    drums: { kick: [0, 10], snare: [8], hat: [0, 3, 6, 8, 11, 14] },
  },
  B: {
    tempo: 76,
    root: 52,
    mode: PHRYGIAN,
    progression: [0, 1, 6, 0],
    arp: [0, -1, -1, 1, -1, -1, 2, -1, -1, 1, -1, -1, 0, -1, -1, -1],
    lead: 'reed',
    drums: { kick: [0, 6, 8], snare: [12], hat: [4, 12] },
  },
  R: {
    tempo: 116,
    root: 57,
    mode: AEOLIAN,
    progression: [0, 5, 6, 0],
    arp: [0, 0, 2, 0, 3, 0, 2, 0, 0, 0, 2, 0, 3, 2, 1, 0],
    lead: 'pulse',
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] },
  },
  G: {
    tempo: 100,
    root: 55,
    mode: MIXOLYDIAN,
    progression: [0, 6, 3, 0],
    arp: [0, -1, 2, 1, -1, 2, -1, 3, 0, -1, 2, 1, -1, 2, 3, -1],
    lead: 'pluck',
    drums: { kick: [0, 3, 6, 10], snare: [12], hat: [2, 8, 14] },
  },
};

export const TITLE_THEME: Theme = {
  id: 'title',
  name: 'Mana Duel',
  colors: [],
  tempo: 80,
  root: 53,
  mode: LYDIAN,
  progression: [0, 1, 5, 4],
  arp: [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, 1, -1, 2, -1, -1, -1],
  lead: 'glass',
  drums: COLOR_MUSIC.U.drums,
};

export const NEUTRAL_THEME: Theme = {
  id: 'neutral',
  name: 'Colorless',
  colors: [],
  tempo: 90,
  root: 57,
  mode: DORIAN,
  progression: [0, 3, 0, 4],
  arp: [0, -1, 1, 2, -1, 1, 3, -1, 0, -1, 1, 2, -1, 2, 1, -1],
  lead: 'bell',
  drums: COLOR_MUSIC.W.drums,
};

export function deckTheme(deck: DeckDef): Theme {
  const [first, second] = deck.colors;
  if (!first) return { ...NEUTRAL_THEME, id: deck.id, name: deck.name };
  const harmony = COLOR_MUSIC[first];
  const texture = COLOR_MUSIC[second ?? first];
  return {
    id: deck.id,
    name: deck.name,
    colors: [...deck.colors],
    tempo: Math.round((harmony.tempo + texture.tempo) / 2),
    root: harmony.root,
    mode: harmony.mode,
    progression: harmony.progression,
    drums: harmony.drums,
    arp: texture.arp,
    lead: texture.lead,
  };
}

export function themeFor(decks: readonly string[] | null, seat: PlayerId): Theme {
  const id = decks?.[seat];
  return id && hasDeck(id) ? deckTheme(getDeck(id)) : NEUTRAL_THEME;
}

export function allThemes(): Theme[] {
  return [TITLE_THEME, NEUTRAL_THEME, ...DECK_LIST.map(deckTheme)];
}

export function findTheme(id: string): Theme | null {
  return allThemes().find((theme) => theme.id === id) ?? null;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function keyName(theme: Theme): string {
  return `${NOTE_NAMES[theme.root % 12]} ${theme.mode.name}`;
}

export function stepSeconds(theme: Theme): number {
  return 60 / theme.tempo / STEPS_PER_BEAT;
}

export function degreeMidi(theme: Theme, degree: number): number {
  const steps = theme.mode.steps;
  const octave = Math.floor(degree / steps.length);
  return theme.root + (steps[degree - octave * steps.length] ?? 0) + 12 * octave;
}

export function chordAt(theme: Theme, bar: number): number[] {
  const progression = theme.progression;
  const degree = progression[((bar % progression.length) + progression.length) % progression.length] ?? 0;
  const tones = [degree, degree + 2, degree + 4].map((d) => degreeMidi(theme, d));
  const shift = (tones[0] ?? theme.root) - theme.root > 6 ? -12 : 0;
  return tones.map((midi) => midi + shift);
}

export function musicMood(s: GameState): Mood {
  if (s.pending?.kind === 'gameOver') return 'over';
  if ((s.combat?.attackers.length ?? 0) > 0) return 'combat';
  if (s.players.some((player) => player.life <= DANGER_LIFE)) return 'danger';
  return 'calm';
}

export function nextMood(current: Mood, wanted: Mood, step: number): Mood {
  if (current === wanted) return current;
  if (wanted === 'over') return wanted;
  if (MOODS.indexOf(wanted) > MOODS.indexOf(current)) return step % STEPS_PER_BEAT === 0 ? wanted : current;
  return step % STEPS_PER_BAR === 0 ? wanted : current;
}

interface MoodShape {
  pad: number;
  bright: number;
  bass: readonly number[];
  bassVelocity: number;
  bassSteps: number;
  lead: number;
  leadEvery: number;
  drums: 'theme' | 'heartbeat' | null;
}

const MOOD_SHAPES: Record<Mood, MoodShape> = {
  calm: {
    pad: 0.7,
    bright: 0.4,
    bass: [1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
    bassVelocity: 0.55,
    bassSteps: 6,
    lead: 0.5,
    leadEvery: 2,
    drums: null,
  },
  danger: {
    pad: 0.75,
    bright: 0.25,
    bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    bassVelocity: 0.65,
    bassSteps: 2,
    lead: 0.4,
    leadEvery: 4,
    drums: 'heartbeat',
  },
  combat: {
    pad: 0.6,
    bright: 0.85,
    bass: [1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0],
    bassVelocity: 0.75,
    bassSteps: 2,
    lead: 0.7,
    leadEvery: 1,
    drums: 'theme',
  },
  over: {
    pad: 0.5,
    bright: 0.2,
    bass: [],
    bassVelocity: 0,
    bassSteps: 0,
    lead: 0,
    leadEvery: 0,
    drums: null,
  },
};

const HEARTBEAT: DrumKit = { kick: [0, 2, 8, 10], snare: [], hat: [] };
const KICK = 36;
const SNARE = 38;
const HAT = 42;

function leadMidi(chord: readonly number[], index: number): number {
  const root = chord[0] ?? 0;
  return index >= chord.length ? root + 24 : (chord[index] ?? root) + 12;
}

function accent(beat: number): number {
  return beat % STEPS_PER_BEAT === 0 ? 1 : 0.8;
}

export function notesAt(theme: Theme, mood: Mood, step: number): Note[] {
  const bar = Math.floor(step / STEPS_PER_BAR);
  const beat = step - bar * STEPS_PER_BAR;
  const shape = MOOD_SHAPES[mood];
  if (mood === 'over') {
    if (beat !== 0 || bar % 2 !== 0) return [];
    return chordAt(theme, 0).map((midi) => ({ voice: 'pad', midi, velocity: shape.pad, steps: 2 * STEPS_PER_BAR, bright: shape.bright }));
  }
  const chord = chordAt(theme, bar);
  const notes: Note[] = [];
  if (beat === 0) {
    for (const midi of chord) notes.push({ voice: 'pad', midi, velocity: shape.pad, steps: STEPS_PER_BAR, bright: shape.bright });
  }
  const bass = shape.bass[beat] ?? 0;
  if (bass > 0) {
    const midi = (bass === 2 ? (chord[2] ?? 0) : (chord[0] ?? 0)) - 12;
    notes.push({ voice: 'bass', midi, velocity: shape.bassVelocity * accent(beat), steps: shape.bassSteps, bright: shape.bright });
  }
  if (shape.lead > 0 && beat % shape.leadEvery === 0) {
    const second = bar % FORM_BARS >= FORM_BARS / 2;
    const index = theme.arp[second ? STEPS_PER_BAR - 1 - beat : beat] ?? -1;
    if (index >= 0) {
      notes.push({ voice: 'lead', midi: leadMidi(chord, index), velocity: shape.lead * accent(beat), steps: 2, bright: shape.bright, timbre: theme.lead });
    }
  }
  const kit = shape.drums === 'theme' ? theme.drums : shape.drums === 'heartbeat' ? HEARTBEAT : null;
  if (kit) {
    if (kit.kick.includes(beat)) notes.push({ voice: 'kick', midi: KICK, velocity: 0.9 * accent(beat), steps: 1, bright: shape.bright });
    if (kit.snare.includes(beat)) notes.push({ voice: 'snare', midi: SNARE, velocity: 0.7 * accent(beat), steps: 1, bright: shape.bright });
    if (kit.hat.includes(beat)) notes.push({ voice: 'hat', midi: HAT, velocity: beat % 4 === 2 ? 0.55 : 0.4, steps: 1, bright: shape.bright });
  }
  return notes;
}
