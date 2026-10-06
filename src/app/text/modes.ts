import { messages } from '../../i18n';

export interface RelicText {
  name: string;
  text: string;
}

export const modesText = messages({
  es: {
    relics: {
      vigor: (life: number): RelicText => ({ name: 'Amuleto de vigor', text: `Empiezas cada duelo con ${life} vidas más.` }),
      foresight: (): RelicText => ({ name: 'Ojo del augur', text: 'Tu mano inicial tiene una carta más.' }),
      banner: (token: string): RelicText => ({ name: 'Estandarte del alba', text: `Empiezas cada duelo con una ${token}.` }),
      cartographer: (): RelicText => ({
        name: 'Mapa del cartógrafo',
        text: 'Empiezas cada duelo con una tierra más en el campo de batalla, la que más copias tiene tu mazo, y una carta menos en la mano inicial.',
      }),
      hourglass: (): RelicText => ({ name: 'Reloj de arena', text: 'Empiezas tú cada duelo, y robas también en tu primer turno.' }),
      mask: (): RelicText => ({ name: 'Máscara del silencio', text: 'Tu rival empieza cada duelo con una carta menos en la mano inicial.' }),
      phoenix: (): RelicText => ({
        name: 'Pluma de fénix',
        text: 'La primera vez que pierdas un duelo, la pluma arde y lo repites en lugar de terminar la expedición.',
      }),
    },
    changes: (count: number) => {
      if (count === 0) return 'sin cambios';
      return count === 1 ? 'con 1 carta nueva' : `con ${count} cartas nuevas`;
    },
    runDeckDescription: (deck: string, changes: string) => `Tu mazo de la expedición: ${deck} ${changes}.`,
    defaultDraftName: 'Mi draft',
    aiDraftDeckName: 'Draft de la IA',
    aiDraftDeckDescription: 'El mazo que la IA se construyó con sus cartas.',
  },
  en: {
    relics: {
      vigor: (life: number): RelicText => ({ name: 'Amulet of Vigor', text: `You start each duel with ${life} more life.` }),
      foresight: (): RelicText => ({ name: "Augur's Eye", text: 'Your opening hand has one more card.' }),
      banner: (token: string): RelicText => ({ name: 'Dawn Banner', text: `You start each duel with a ${token}.` }),
      cartographer: (): RelicText => ({
        name: "Cartographer's Map",
        text: 'You start each duel with one more land on the battlefield, the one your deck has the most copies of, and one card fewer in your opening hand.',
      }),
      hourglass: (): RelicText => ({ name: 'Hourglass', text: 'You go first in every duel, and you also draw on your first turn.' }),
      mask: (): RelicText => ({ name: 'Mask of Silence', text: 'Your opponent starts each duel with one card fewer in their opening hand.' }),
      phoenix: (): RelicText => ({
        name: 'Phoenix Feather',
        text: 'The first time you lose a duel, the feather burns and you replay it instead of ending the expedition.',
      }),
    },
    changes: (count: number) => {
      if (count === 0) return 'unchanged';
      return count === 1 ? 'with 1 new card' : `with ${count} new cards`;
    },
    runDeckDescription: (deck: string, changes: string) => `Your expedition deck: ${deck}, ${changes}.`,
    defaultDraftName: 'My draft',
    aiDraftDeckName: "The AI's draft",
    aiDraftDeckDescription: 'The deck the AI built from its cards.',
  },
});
