import type { FxBatch, FxKind } from '../app/fx';
import { getCardDef, type CardDef, type CardId, type Color, type GameState, type PendingDecision, type PlayerId } from '../engine';
import { cardColors } from '../ui/cardInfo';
import { DRAW_STAGGER_MS, IMPACT_MS } from '../ui/fx';
import { soundEvent, type SoundEvent, type SoundId } from './sounds';

export const MAX_BATCHES = 4;
export const MAX_SOUNDS = 12;
export const MAX_DRAWS = 7;
export const ENDING_AT = 0.45;
export const TURN_LEAD = 0.18;
export const REPEAT_GAP = 0.05;
export const DIES_AFTER = 0.08;
export const ENTER_AFTER = 0.06;

const IMPACT = IMPACT_MS / 1000;
const DRAW_GAP = DRAW_STAGGER_MS / 1000;
const DRAW_PITCHES = [0, 1, -1];

const REPEATS: Partial<Record<SoundId, number>> = { strike: 3, dies: 3, enter: 3, cast: 2, ability: 2 };

export interface SoundContext {
  state: GameState;
  viewer: PlayerId;
  time: number;
}

interface AddOptions {
  gain?: number;
  pitch?: number;
  pitchStep?: number;
  color?: Color | null;
}

function defOf(s: GameState, card: CardId): CardDef | null {
  const id = s.cards[card]?.def;
  return id ? getCardDef(id) : null;
}

function colorOf(s: GameState, card: CardId): Color | null {
  const def = defOf(s, card);
  return def ? (cardColors(def)[0] ?? null) : null;
}

function isLand(s: GameState, card: CardId): boolean {
  return defOf(s, card)?.types.includes('land') ?? false;
}

export function soundsOf(batch: FxBatch, context: SoundContext): SoundEvent[] {
  const { state: s, viewer, time } = context;
  const has = (kind: FxKind): boolean => batch.cues.some((cue) => cue.kind === kind);
  const impact = has('strike') ? IMPACT : 0;
  const lead = has('turn') ? TURN_LEAD : 0;
  const attackers = batch.cues.filter((cue) => cue.kind === 'attack').length;
  const events: SoundEvent[] = [];
  const counts = new Map<SoundId, number>();
  const add = (sound: SoundId, at: number, options: AddOptions = {}): void => {
    const count = counts.get(sound) ?? 0;
    if (count >= (REPEATS[sound] ?? 1)) return;
    counts.set(sound, count + 1);
    events.push(
      soundEvent(sound, {
        seq: batch.seq,
        at: (at + count * REPEAT_GAP) * time,
        gain: options.gain ?? 1,
        pitch: (options.pitch ?? 0) + count * (options.pitchStep ?? 0),
        color: options.color ?? null,
      }),
    );
  };
  let ownDraws = 0;
  let theirDraw = false;
  for (const cue of batch.cues) {
    switch (cue.kind) {
      case 'draw':
        if (cue.player === viewer) {
          if (ownDraws < MAX_DRAWS) {
            events.push(soundEvent('draw', { seq: batch.seq, at: (lead + ownDraws * DRAW_GAP) * time, pitch: DRAW_PITCHES[ownDraws % DRAW_PITCHES.length] }));
          }
          ownDraws += 1;
        } else if (!theirDraw) {
          theirDraw = true;
          events.push(soundEvent('draw', { seq: batch.seq, at: lead * time, gain: 0.5, pitch: -3 }));
        }
        break;
      case 'discard':
        add('discard', 0);
        break;
      case 'play':
        add(cue.via === 'land' ? 'land' : 'cast', 0, { color: colorOf(s, cue.card) });
        break;
      case 'ability':
        add('ability', 0);
        break;
      case 'enter':
        if (!isLand(s, cue.card)) add('enter', ENTER_AFTER, { pitchStep: 2 });
        break;
      case 'attack':
        add('attack', 0, { gain: Math.min(1, 0.7 + 0.1 * attackers) });
        break;
      case 'block':
        add('block', 0);
        break;
      case 'strike':
        add('strike', impact, { pitchStep: -2 });
        break;
      case 'damage':
        if (impact === 0) add('damage', 0);
        break;
      case 'life':
        if (cue.delta > 0) add('heal', impact);
        else add(cue.player === viewer ? 'hurt' : 'drain', impact);
        break;
      case 'pump':
        add(cue.power < 0 || cue.toughness < 0 ? 'shrink' : 'pump', 0);
        break;
      case 'dies':
        add('dies', impact + DIES_AFTER, { pitchStep: -1 });
        break;
      case 'bounce':
        add('bounce', 0);
        break;
      case 'counter':
        add('counter', 0);
        break;
      case 'fizzle':
        add('fizzle', 0);
        break;
      case 'turn':
        add('turn', 0, { pitch: cue.player === viewer ? 0 : -5 });
        break;
    }
  }
  return events;
}

export function soundsFor(batches: readonly FxBatch[], context: SoundContext): SoundEvent[] {
  return batches
    .slice(-MAX_BATCHES)
    .flatMap((batch) => soundsOf(batch, context))
    .slice(-MAX_SOUNDS);
}

export function endingSound(pending: PendingDecision | null, viewer: PlayerId, spectating: boolean): SoundId | null {
  if (pending?.kind !== 'gameOver') return null;
  if (pending.winner === null) return 'stalemate';
  if (spectating) return 'victory';
  return pending.winner === viewer ? 'victory' : 'defeat';
}
