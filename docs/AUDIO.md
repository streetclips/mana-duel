# Music and sound effects

Everything you hear is synthesized with the Web Audio API while the game runs: there are no audio files. The music
is a generative score in the colors of your deck that follows the game, and every sound effect answers an fx cue, the
same cues that drive the animations.

```
GameController ── fx batches, state ──► SoundDirector ──► AudioEngine ──► speakers
 (src/app)                               src/audio/director   src/audio/engine
                                          │ cues.ts: cue → sound      │ one AudioContext, unlocked by a tap
                                          │ music.ts: deck → theme,   │ music scheduler, sound gate, log, level
                                          │           state → mood    ▼
                                          └──────────────────────► synth.ts: every note and sound is data
                                                                    (layers of tones and noise), played by
                                                                    one renderer, live or offline (render.ts)
```

`src/audio/index.ts` wires them together as `GameAudio`, which `src/main.tsx` attaches to the controller and the
UI receives as a prop.

## When it plays

- Browsers allow sound only after a user gesture. No `AudioContext` exists until the first `pointerdown`,
  `pointerup`, `touchend`, `keydown` or `click` on the page (`UNLOCK_EVENTS`); that tap creates it and starts the
  music. Before it, `data-audio` is `none` and nothing is logged.
- The start screen plays the title theme; a game plays the theme of your deck (`themeFor`, seat 0), and a loaded
  scenario, which has no decks, the colorless one. Every new game, scenario or replay starts the music over.
- A hidden page suspends the context (`visibilitychange`) and the music picks up where it was. With music and sound
  effects both off the context is suspended too.
- Without Web Audio, or if the context fails to start, `data-audio` is `unsupported` and the game runs silent.

## Music

A theme is a key, a mode, a tempo, a four-chord progression, an arpeggio pattern, a lead timbre and a drum kit. Each
color has its own (`COLOR_MUSIC` in `src/audio/music.ts`):

| Color | Key | Tempo | Progression | Lead | Drums |
| --- | --- | --- | --- | --- | --- |
| White | C Ionian | 92 | I – V – vi – IV | bell | march |
| Blue | D Dorian | 84 | i – VII – IV – v | glass | brushes |
| Black | E Phrygian | 76 | i – II – vii – i | reed | slow pulse |
| Red | A Aeolian | 116 | i – VI – VII – i | sawtooth pulse | four on the floor |
| Green | G Mixolydian | 100 | I – VII – IV – I | pluck | tribal |

A deck's theme takes its harmony (key, mode, progression, drums) from its first color and its texture (lead timbre
and arpeggio) from its last (the second of a two-color deck), at the average tempo of all its colors, so every
combination of colors sounds different, five colors included, and a new deck gets a theme on its own. The title theme is F Lydian, the colorless one A Dorian.

The score (`notesAt(theme, mood, step)`) runs in sixteenth-note steps: a pad holds each bar's chord, the bass plays
its root and fifth, the lead arpeggiates its tones an octave up, and the eight-bar loop plays the arpeggio backwards
in its second half. Every pitched note stays in the key; chords are folded to lie within a tritone of the tonic.

The **mood** comes from the game (`musicMood`):

| Mood | When | What changes |
| --- | --- | --- |
| `calm` | otherwise | pad, bass on the first and third beats, the arpeggio in eighth notes |
| `danger` | a player at 5 life or less | darker, a pulsing bass, a sparse lead and a heartbeat |
| `combat` | attackers are declared, until combat ends | brighter, eighth-note bass, the whole arpeggio and the theme's drums |
| `over` | the game is over | a quiet tonic chord every second bar |

A more intense mood starts on the next beat, a calmer one on the next bar line, `over` at once (`nextMood`).
`state().music.mood` is what the game asks for, `heard` what is playing.

The engine schedules notes 0.3 s ahead of the audio clock on a 60 ms timer (`LOOKAHEAD_SECONDS`, `TICK_MS`). When
timers stall, as in a background window, it skips ahead instead of playing the missed notes at once.

## Sound effects

`soundsOf` turns the cues of one action into sound events, timed like their animation:

| Cue | Sound | Timing and variations |
| --- | --- | --- |
| `draw` | `draw` | your cards one after another (`DRAW_STAGGER_MS`), the opponent's as one quieter sound; after a turn's bell by `TURN_LEAD` |
| `discard` | `discard` | |
| `play` | `land` or `cast` | in the color of the card: a thump and a colored tone for a land, an arpeggio and a color flourish for a spell |
| `ability` | `ability` | |
| `enter` | `enter` | creatures and tokens; a land played is heard as its `land`, and so is a land an effect puts onto the battlefield |
| `attack` / `block` | `attack` / `block` | once per declaration; more attackers sound louder |
| `strike` | `strike` | when the lunge lands (`IMPACT_MS`), up to three, each lower |
| `damage` | `damage` | only without a strike to cover it: burn, abilities |
| `life` | `hurt`, `drain` or `heal` | you lose life, the opponent loses life, anyone gains life; at the impact in combat |
| `pump` | `pump` or `shrink` | |
| `dies` | `dies` | `DIES_AFTER` the impact, up to three |
| `bounce`, `counter`, `fizzle` | same names | |
| `turn` | `turn` | a bell, lower for the opponent's turn |
| game over | `victory`, `defeat` or `stalemate` | `ENDING_AT` after the last action; watching AI vs AI ends on `victory` unless drawn |

- Slow motion (`?fx=slow`) stretches the timings as it stretches the animations; with `?fx=off` they keep their
  natural spacing.
- After a burst of actions (`settle()`, `aiDelay=0`) only the latest `MAX_BATCHES` actions are heard, at most
  `MAX_SOUNDS` sounds. The `SoundGate` then lets one of each sound through per 45 ms and 10 sounds per 250 ms;
  jingles always pass. `state().sfx.dropped` counts what it held back.

## Mix

Music and effects have their own buses into a master gain, a compressor and an analyser before the speakers, with a
shared synthesized reverb (`createMix` in `src/audio/synth.ts`). The music sits under the effects (`MUSIC_LEVEL`,
`SFX_LEVEL`); turning either off fades its bus out. Impacts carry a mid-range body as well as their low thump, so they
read on phone speakers.

## Testing and driving it

- `manaDuel.audio`: `state()` (context, theme, mood, heard, bar, notes scheduled, sounds played and dropped),
  `played(since?)` (sounds started, oldest first, each with the fx `seq` it answers and its `at` on the audio clock),
  `level()` (RMS and peak of the output now), `await render(sound | { sound, color } | { theme, mood, bars })`
  (renders offline with the live mix: `seconds`, `peak`, `rms`, `tail`, `finite`), `setMusic(on)`, `setSfx(on)`,
  `setVolume(0..1)`, `await unlock()` (what a tap does), `sounds()`, `themes()`.
- An `evaluate` is no tap: click something, or call `manaDuel.audio.unlock()`. Read `manaDuel.fxSeq()` before acting,
  then `manaDuel.audio.played(seq)` lists the sounds of that action.
- `<html>` mirrors the state for assertions that wait: `data-audio` (`none`, `running`, `suspended`, `closed`,
  `interrupted`, `unsupported`), `data-music` (the theme id, or `off`), `data-mood`.
- `?music=on|off` and `?sfx=on|off` override the choice saved by the toggles (`manaDuel.audio` in `localStorage`):
  `menu-music` and `menu-sfx` (`aria-checked`) in the game menu, `btn-music` and `btn-sfx` (`aria-pressed`) in the
  settings of the start screen, behind its gear.
- Unit tests run against `tests/audio/fakeAudio.ts`, a strict fake `AudioContext` that throws where the real one does
  (non-finite values, exponential ramps to zero, a source started twice). `e2e/audio.spec.ts` plays in Chromium and
  renders every sound and every theme in every mood offline: each must be finite, audible, under full scale and fade
  out. Coverage is listed in `docs/VERIFICATION.md` › Audio.

## Extending

- A new cue kind gets a case in `soundsOf` (`src/audio/cues.ts`); `tests/audio/cues.test.ts` lists one cue of every
  kind and fails to typecheck until it has the new one.
- A new sound is an id in `SOUNDS` (`src/audio/sounds.ts`) and a recipe in `RECIPES` (`src/audio/synth.ts`): a list of
  tone and noise layers, each with a gain, an envelope and optional glides, filters, vibrato or tremolo. The synth and
  render tests pick it up from `SOUNDS`.
- A new timbre or drum pattern belongs to `src/audio/synth.ts` (`leadLayers`, `noteLayers`) and `src/audio/music.ts`.
- After changing levels or recipes, run `npx playwright test e2e/audio.spec.ts`: the render test reports any sound or
  theme that clips, goes silent or rings on.
