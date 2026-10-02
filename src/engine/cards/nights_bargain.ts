import type { CardDef } from '../types';

export const nightsBargain: CardDef = {
  id: 'nights_bargain',
  name: 'Pacto nocturno',
  types: ['sorcery'],
  cost: '{1}{B}',
  spell: {
    targets: [],
    effects: [
      { kind: 'draw', amount: 2 },
      { kind: 'loseLife', amount: 2 },
    ],
  },
  flavor: 'El precio siempre se paga por la mañana.',
};
