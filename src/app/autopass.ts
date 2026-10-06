import { priorityActions, type GameState, type PlayerId } from '../engine';
import { autoPassText } from './text/game';

export interface AutoPassContext {
  endTurnRequested: boolean;
  autoPass: boolean;
}

export function autoPassReason(s: GameState, human: PlayerId, context: AutoPassContext): string | null {
  const pending = s.pending;
  if (pending?.kind !== 'priority' || pending.player !== human) return null;
  const text = autoPassText();
  if (!priorityActions(s, human).some((action) => action.type !== 'pass')) return text.nothingToDo;
  const top = s.stack.at(-1);
  if (context.autoPass && top?.kind === 'trigger' && s.cards[top.source]?.zone === 'command') return text.relicAbility;
  if (top && top.controller !== human) return null;
  const myTurn = s.activePlayer === human;
  if (myTurn && context.endTurnRequested) return text.endingTurn;
  if (!context.autoPass) return null;
  if (top) return text.ownSpell;
  if (s.step === 'upkeep') return text.upkeep;
  if (!myTurn && (s.step === 'main1' || s.step === 'main2')) return text.opponentMainPhase;
  if (!myTurn && s.step === 'end') return text.opponentEndStep;
  if (myTurn && (s.step === 'end' || s.step === 'declareAttackers')) return text.nothingToAnswer;
  return null;
}
