import type { CardDef } from '../types';

export const tidalInsight: CardDef = {
  id: 'tidal_insight',
  name: 'Visión de la marea',
  types: ['instant'],
  cost: '{2}{U}',
  spell: {
    targets: [],
    effects: [{ kind: 'draw', amount: 2 }],
  },
  flavor: 'Lee las corrientes y el futuro fluirá hacia ti.',
};
