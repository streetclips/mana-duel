import type { CardDef } from '../types';

export const bloodTithe: CardDef = {
  id: 'blood_tithe',
  name: 'Blood Tithe',
  types: ['sorcery'],
  cost: '{2}{B}',
  spell: {
    targets: [],
    effects: [
      { kind: 'loseLife', amount: 2, who: 'opponent' },
      { kind: 'gainLife', amount: 2 },
      { kind: 'draw', amount: 1 },
    ],
  },
  flavor: 'Pay what you owe, and a little more for the candles.',
};
