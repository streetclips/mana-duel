import type { CardDef } from '../types';

export const refractedInsight: CardDef = {
  id: 'refracted_insight',
  name: 'Refracted Insight',
  types: ['instant'],
  cost: '{2}{U}{R}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [
      { kind: 'draw', amount: 2 },
      { kind: 'damage', amount: 1, to: 0 },
    ],
  },
  flavor: 'One beam of thought, split into answers and sparks.',
};
