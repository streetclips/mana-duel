import type { CardDef } from '../types';

export const reefScholar: CardDef = {
  id: 'reef_scholar',
  name: 'Reef Scholar',
  types: ['creature'],
  subtypes: ['Merfolk', 'Wizard'],
  cost: '{2}{U}',
  power: 1,
  toughness: 3,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'draw', amount: 1 }] }],
  flavor: 'The sea writes its secrets in currents. She reads them.',
};
