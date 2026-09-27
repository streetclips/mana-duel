import { priorityActions, type GameState, type PlayerId } from '../engine';

export interface AutoPassContext {
  endTurnRequested: boolean;
}

export function autoPassReason(s: GameState, human: PlayerId, context: AutoPassContext): string | null {
  const pending = s.pending;
  if (pending?.kind !== 'priority' || pending.player !== human) return null;
  if (!priorityActions(s, human).some((action) => action.type !== 'pass')) return 'nothing to do';
  const top = s.stack.at(-1);
  if (top && top.controller === human) return 'let your own spell resolve';
  if (s.stack.length > 0) return null;
  const myTurn = s.activePlayer === human;
  if (!myTurn && (s.step === 'main1' || s.step === 'main2')) return "opponent's main phase";
  if (!myTurn && s.step === 'end') return "opponent's end step";
  if (myTurn && (s.step === 'end' || s.step === 'declareAttackers')) return 'nothing to respond to';
  if (myTurn && context.endTurnRequested) return 'ending the turn';
  return null;
}
