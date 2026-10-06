import type { CardId, PendingDecision, PlayerId } from './types';

export type Refusal =
  | { code: 'malformedAction' }
  | { code: 'unknownAction'; type: string }
  | { code: 'unknownPlayer' }
  | { code: 'noDecision' }
  | { code: 'gameOver' }
  | { code: 'notWaitingFor'; kind: PendingDecision['kind'] }
  | { code: 'notTheirDecision'; player: PlayerId }
  | { code: 'otherSeat' }
  | { code: 'notYourDecision' }
  | { code: 'noMoreMulligans' }
  | { code: 'cardsNotList' }
  | { code: 'chooseExactly'; count: number }
  | { code: 'chosenNotInHand'; card: string }
  | { code: 'chosenTwice'; card: CardId }
  | { code: 'notInHand' }
  | { code: 'notALand' }
  | { code: 'landTiming' }
  | { code: 'landPlayed' }
  | { code: 'allLandsPlayed' }
  | { code: 'landsAreNotCast' }
  | { code: 'noPriority' }
  | { code: 'sorceryTiming' }
  | { code: 'notEnoughMana' }
  | { code: 'notYourPermanent' }
  | { code: 'noSuchAbility' }
  | { code: 'tapped' }
  | { code: 'summoningSick' }
  | { code: 'triggerGone' }
  | { code: 'targetsNotList' }
  | { code: 'targetCount'; given: number; expected: number }
  | { code: 'targetMalformed'; index: number }
  | { code: 'illegalTarget'; index: number; target: string }
  | { code: 'sameTargetTwice' }
  | { code: 'attackersNotList' }
  | { code: 'attackersNotIds' }
  | { code: 'attackerTwice'; card: CardId }
  | { code: 'cannotAttack'; card: CardId }
  | { code: 'blocksNotList' }
  | { code: 'noCombat' }
  | { code: 'malformedBlock' }
  | { code: 'blockerTwice'; card: CardId }
  | { code: 'cannotBlock'; blocker: CardId; attacker: CardId }
  | { code: 'menace'; attacker: CardId };
