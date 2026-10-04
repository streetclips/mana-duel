import type { CardDef } from '../types';

export const palmStrike: CardDef = {
  id: 'palm_strike',
  name: 'Golpe de palma',
  types: ['instant'],
  cost: '{R}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [
      { kind: 'pump', power: 1, toughness: 0, to: 0 },
      { kind: 'draw', amount: 1 },
    ],
  },
  flavor: 'La palma abierta golpea más fuerte que el puño cerrado.',
};
