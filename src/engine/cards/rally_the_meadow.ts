import type { CardDef } from '../types';

export const rallyTheMeadow: CardDef = {
  id: 'rally_the_meadow',
  name: 'Arenga del prado',
  types: ['instant'],
  cost: '{1}{W}',
  spell: {
    targets: [],
    effects: [{ kind: 'pumpTeam', power: 1, toughness: 1 }],
  },
  flavor: 'Granjeros, pastores, escuderos: hoy, todos son soldados.',
};
