import type { CardDef } from '../types';

export const nightsBargain: CardDef = {
  id: 'nights_bargain',
  name: "Night's Bargain",
  types: ['sorcery'],
  cost: '{1}{B}',
  spell: {
    targets: [],
    effects: [
      { kind: 'draw', amount: 2 },
      { kind: 'loseLife', amount: 2 },
    ],
  },
  flavor: 'The price is always paid in the morning.',
};
