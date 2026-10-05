import { priorityActions, type GameState, type PlayerId } from '../engine';

export interface AutoPassContext {
  endTurnRequested: boolean;
  autoPass: boolean;
}

export function autoPassReason(s: GameState, human: PlayerId, context: AutoPassContext): string | null {
  const pending = s.pending;
  if (pending?.kind !== 'priority' || pending.player !== human) return null;
  if (!priorityActions(s, human).some((action) => action.type !== 'pass')) return 'no hay nada que hacer';
  const top = s.stack.at(-1);
  if (context.autoPass && top?.kind === 'trigger' && s.cards[top.source]?.zone === 'command') return 'habilidad de una reliquia';
  if (top && top.controller !== human) return null;
  const myTurn = s.activePlayer === human;
  if (myTurn && context.endTurnRequested) return 'terminando el turno';
  if (!context.autoPass) return null;
  if (top) return 'deja que se resuelva tu propio hechizo';
  if (s.step === 'upkeep') return 'mantenimiento';
  if (!myTurn && (s.step === 'main1' || s.step === 'main2')) return 'fase principal del rival';
  if (!myTurn && s.step === 'end') return 'paso final del rival';
  if (myTurn && (s.step === 'end' || s.step === 'declareAttackers')) return 'no hay nada a lo que responder';
  return null;
}
