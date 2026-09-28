import type { CardDef } from '../types';

export const rallyTheMeadow: CardDef = {
  id: 'rally_the_meadow',
  name: 'Rally the Meadow',
  types: ['instant'],
  cost: '{1}{W}',
  spell: {
    targets: [],
    effects: [{ kind: 'pumpTeam', power: 1, toughness: 1 }],
  },
  flavor: 'Farmers, shepherds, squires: today, all of them are soldiers.',
};
