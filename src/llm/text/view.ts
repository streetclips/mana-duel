import { messages } from '../../i18n';

export const viewText = messages({
  es: {
    goneCard: 'una carta que ya no está en juego',
    yourSpell: (name: string, id: string) => `tu hechizo ${name} (${id})`,
    opponentSpell: (name: string, id: string) => `el hechizo ${name} (${id}) del rival`,
    yours: (name: string, id: string) => `tu ${name} (${id})`,
    opponents: (name: string, id: string) => `${name} (${id}) del rival`,
    you: 'tú',
    opponent: 'el rival',
    stackKinds: { spell: 'hechizo', trigger: 'habilidad disparada', activated: 'habilidad activada' },
    thought: (turn: number, yourTurn: boolean, step: string, reason: string) =>
      `Turno ${turn} (${yourTurn ? 'tu turno' : 'turno del rival'}), ${step}: ${reason}`,
  },
  en: {
    goneCard: 'a card that is no longer in play',
    yourSpell: (name: string, id: string) => `your spell ${name} (${id})`,
    opponentSpell: (name: string, id: string) => `the opponent's spell ${name} (${id})`,
    yours: (name: string, id: string) => `your ${name} (${id})`,
    opponents: (name: string, id: string) => `the opponent's ${name} (${id})`,
    you: 'you',
    opponent: 'the opponent',
    stackKinds: { spell: 'spell', trigger: 'triggered ability', activated: 'activated ability' },
    thought: (turn: number, yourTurn: boolean, step: string, reason: string) =>
      `Turn ${turn} (${yourTurn ? 'your turn' : "the opponent's turn"}), ${step}: ${reason}`,
  },
});
