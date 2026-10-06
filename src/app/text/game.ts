import { messages } from '../../i18n';

export const noteText = messages({
  es: {
    opponentThinks: (reason: string) => `El rival piensa: ${reason}`,
    llmUnavailable: (reason: string) =>
      `El LLM no está disponible (${reason}): la IA clásica juega el resto de la partida.`,
    llmFailed: (reason: string) => `El LLM no pudo decidir (${reason}): la IA clásica hizo esta jugada.`,
    unknownError: 'error desconocido',
  },
  en: {
    opponentThinks: (reason: string) => `The opponent thinks: ${reason}`,
    llmUnavailable: (reason: string) =>
      `The LLM is unavailable (${reason}): the classic AI plays the rest of the game.`,
    llmFailed: (reason: string) => `The LLM couldn't decide (${reason}): the classic AI made this play.`,
    unknownError: 'unknown error',
  },
});

export const autoPassText = messages({
  es: {
    nothingToDo: 'no hay nada que hacer',
    relicAbility: 'habilidad de una reliquia',
    endingTurn: 'terminando el turno',
    ownSpell: 'deja que se resuelva tu propio hechizo',
    upkeep: 'mantenimiento',
    opponentMainPhase: 'fase principal del rival',
    opponentEndStep: 'paso final del rival',
    nothingToAnswer: 'no hay nada a lo que responder',
  },
  en: {
    nothingToDo: 'nothing to do',
    relicAbility: "a relic's ability",
    endingTurn: 'ending the turn',
    ownSpell: 'lets your own spell resolve',
    upkeep: 'upkeep',
    opponentMainPhase: "the opponent's main phase",
    opponentEndStep: "the opponent's end step",
    nothingToAnswer: 'nothing to respond to',
  },
});
