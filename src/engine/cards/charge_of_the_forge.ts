import type { CardDef } from '../types';

export const chargeOfTheForge: CardDef = {
  id: 'charge_of_the_forge',
  name: 'Charge of the Forge',
  types: ['instant'],
  cost: '{R}{W}',
  spell: {
    targets: [],
    effects: [{ kind: 'pumpTeam', power: 1, toughness: 0, keywords: ['firstStrike'] }],
  },
  flavor: 'Hammers up, shields forward, and nobody strikes second.',
};
