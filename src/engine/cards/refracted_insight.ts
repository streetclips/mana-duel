import type { CardDef } from '../types';

export const refractedInsight: CardDef = {
  id: 'refracted_insight',
  name: 'Visión refractada',
  types: ['instant'],
  cost: '{2}{U}{R}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [
      { kind: 'draw', amount: 2 },
      { kind: 'damage', amount: 1, to: 0 },
    ],
  },
  flavor: 'Un rayo de pensamiento, dividido en respuestas y chispas.',
};
