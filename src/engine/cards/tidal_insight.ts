import type { CardDef } from '../types';

export const tidalInsight: CardDef = {
  id: 'tidal_insight',
  name: 'Tidal Insight',
  types: ['instant'],
  cost: '{2}{U}',
  spell: {
    targets: [],
    effects: [{ kind: 'draw', amount: 2 }],
  },
  flavor: 'Read the currents, and the future flows toward you.',
};
