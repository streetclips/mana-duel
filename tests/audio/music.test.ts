import { describe, expect, it } from 'vitest';
import {
  FORM_BARS,
  MOODS,
  NEUTRAL_THEME,
  STEPS_PER_BAR,
  TITLE_THEME,
  allThemes,
  chordAt,
  deckTheme,
  findTheme,
  keyName,
  musicMood,
  nextMood,
  notesAt,
  stepSeconds,
  themeFor,
  type Mood,
  type Note,
  type Theme,
  type Voice,
} from '../../src/audio/music';
import { DECK_LIST, applyAction, getDeck } from '../../src/engine';
import { attack, scenario } from '../helpers';

function steps(theme: Theme, mood: Mood, bars: number): Note[][] {
  return Array.from({ length: bars * STEPS_PER_BAR }, (_, step) => notesAt(theme, mood, step));
}

function voicesOf(theme: Theme, mood: Mood): Set<Voice> {
  return new Set(steps(theme, mood, 1).flatMap((notes) => notes.map((note) => note.voice)));
}

function hitsOf(theme: Theme, mood: Mood, voice: Voice): number[] {
  return steps(theme, mood, 1).flatMap((notes, step) => (notes.some((note) => note.voice === voice) ? [step] : []));
}

describe('music themes', () => {
  it('give every deck a theme made from its colors, a different one for each combination of colors', () => {
    const themes = DECK_LIST.map(deckTheme);
    expect(themes.map((theme) => theme.id)).toEqual(DECK_LIST.map((deck) => deck.id));
    const combinations = new Set(DECK_LIST.map((deck) => deck.colors.join('')));
    expect(new Set(themes.map((theme) => `${keyName(theme)} ${theme.tempo} ${theme.lead}`)).size).toBe(combinations.size);
    expect(deckTheme(getDeck('emberwild'))).toMatchObject({ colors: ['R', 'G'], tempo: 108, lead: 'pluck' });
    expect(keyName(deckTheme(getDeck('emberwild')))).toBe('A Aeolian');
    expect(keyName(deckTheme(getDeck('duskmire')))).toBe('E Phrygian');
    expect(keyName(deckTheme(getDeck('dawntide')))).toBe('C Ionian');
  });

  it('keep a steady tempo and can be found by id', () => {
    expect(allThemes().map((theme) => theme.id)).toEqual(['title', 'neutral', ...DECK_LIST.map((deck) => deck.id)]);
    for (const theme of allThemes()) {
      expect(theme.tempo).toBeGreaterThanOrEqual(70);
      expect(theme.tempo).toBeLessThanOrEqual(120);
      expect(stepSeconds(theme)).toBeCloseTo(15 / theme.tempo);
      expect(findTheme(theme.id)).toEqual(theme);
    }
    expect(findTheme('nope')).toBeNull();
  });

  it('play the deck of the seat they are asked for, and the colorless theme without decks', () => {
    expect(themeFor(['dawntide', 'duskmire'], 0).id).toBe('dawntide');
    expect(themeFor(['dawntide', 'duskmire'], 1).id).toBe('duskmire');
    expect(themeFor(null, 0)).toBe(NEUTRAL_THEME);
    expect(themeFor(['nope', 'nope'], 0)).toBe(NEUTRAL_THEME);
  });
});

describe('the score', () => {
  it('keeps every pitched note in the key of its theme, in every mood', () => {
    for (const theme of allThemes()) {
      const scale = new Set(theme.mode.steps.map((step) => (theme.root + step) % 12));
      for (const mood of MOODS) {
        const pitched = steps(theme, mood, FORM_BARS)
          .flat()
          .filter((note) => note.voice === 'pad' || note.voice === 'bass' || note.voice === 'lead');
        expect(pitched.length).toBeGreaterThan(0);
        for (const note of pitched) expect(scale.has(note.midi % 12)).toBe(true);
      }
    }
  });

  it('opens every bar with its chord on the pad and the chord root in the bass', () => {
    const theme = deckTheme(getDeck('dawntide'));
    expect([0, 1, 2, 3].map((bar) => chordAt(theme, bar))).toEqual([
      [60, 64, 67],
      [55, 59, 62],
      [57, 60, 64],
      [65, 69, 72],
    ]);
    for (let bar = 0; bar < 4; bar++) {
      const notes = notesAt(theme, 'calm', bar * STEPS_PER_BAR);
      const chord = chordAt(theme, bar);
      expect(notes.filter((note) => note.voice === 'pad').map((note) => note.midi)).toEqual(chord);
      expect(notes.find((note) => note.voice === 'bass')?.midi).toBe((chord[0] ?? 0) - 12);
    }
  });

  it('loops every eight bars and plays the second half of the loop backwards', () => {
    const theme = TITLE_THEME;
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      expect(notesAt(theme, 'calm', step)).toEqual(notesAt(theme, 'calm', FORM_BARS * STEPS_PER_BAR + step));
    }
    const lead = (bar: number): (number | null)[] =>
      Array.from(
        { length: STEPS_PER_BAR },
        (_, beat) => notesAt(theme, 'combat', bar * STEPS_PER_BAR + beat).find((note) => note.voice === 'lead')?.midi ?? null,
      );
    expect(lead(4)).toEqual([...lead(0)].reverse());
  });

  it('brings in the drums of the theme for combat and a heartbeat for danger', () => {
    const emberwild = deckTheme(getDeck('emberwild'));
    expect(voicesOf(emberwild, 'calm')).toEqual(new Set(['pad', 'bass', 'lead']));
    expect(voicesOf(emberwild, 'combat')).toEqual(new Set(['pad', 'bass', 'lead', 'kick', 'snare', 'hat']));
    expect(voicesOf(emberwild, 'danger')).toEqual(new Set(['pad', 'bass', 'lead', 'kick']));
    expect(hitsOf(emberwild, 'combat', 'kick')).toEqual([0, 4, 8, 12]);
    expect(hitsOf(deckTheme(getDeck('duskmire')), 'combat', 'kick')).toEqual([0, 6, 8]);
    expect(hitsOf(emberwild, 'danger', 'kick')).toEqual([0, 2, 8, 10]);
  });

  it('plays busier and brighter in combat than at rest', () => {
    for (const theme of allThemes()) {
      const count = (mood: Mood): number => steps(theme, mood, 4).flat().length;
      expect(count('combat')).toBeGreaterThan(count('calm'));
      const bright = (mood: Mood): number => notesAt(theme, mood, 0)[0]?.bright ?? 0;
      expect(bright('combat')).toBeGreaterThan(bright('calm'));
      expect(bright('danger')).toBeLessThan(bright('calm'));
    }
  });

  it('ends a game on a quiet chord of the tonic, every second bar', () => {
    const theme = deckTheme(getDeck('gloamwood'));
    const over = steps(theme, 'over', 4);
    expect(over.flatMap((notes, step) => (notes.length > 0 ? [step] : []))).toEqual([0, 2 * STEPS_PER_BAR]);
    expect(over[0]?.map((note) => [note.voice, note.midi])).toEqual(chordAt(theme, 0).map((midi) => ['pad', midi]));
  });
});

describe('the mood of the music', () => {
  it('follows the game: calm, combat once attackers are declared, danger at 5 life or less, over at the end', () => {
    const quiet = scenario({ players: [{ battlefield: [{ card: 'ember_hound', id: 'hound' }] }, {}] });
    expect(musicMood(quiet)).toBe('calm');
    expect(musicMood(scenario({ players: [{ life: 5 }, {}] }))).toBe('danger');
    expect(musicMood(scenario({ players: [{}, { life: 3 }] }))).toBe('danger');
    const fighting = attack(quiet, ['hound']);
    expect(musicMood(fighting)).toBe('combat');
    expect(musicMood(applyAction(fighting, { type: 'concede', player: 1 }))).toBe('over');
  });

  it('grows on the next beat, calms down on the next bar line and ends at once', () => {
    expect(nextMood('calm', 'combat', 5)).toBe('calm');
    expect(nextMood('calm', 'combat', 8)).toBe('combat');
    expect(nextMood('calm', 'danger', 4)).toBe('danger');
    expect(nextMood('combat', 'calm', 8)).toBe('combat');
    expect(nextMood('combat', 'calm', 16)).toBe('calm');
    expect(nextMood('combat', 'over', 3)).toBe('over');
    expect(nextMood('danger', 'danger', 3)).toBe('danger');
  });
});
