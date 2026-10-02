import type { CardDef } from '../types';

export const chargeOfTheForge: CardDef = {
  id: 'charge_of_the_forge',
  name: 'Carga de la forja',
  types: ['instant'],
  cost: '{R}{W}',
  spell: {
    targets: [],
    effects: [{ kind: 'pumpTeam', power: 1, toughness: 0, keywords: ['firstStrike'] }],
  },
  flavor: 'Martillos en alto, escudos al frente y nadie golpea el segundo.',
};
