import type { CardDef } from '../types';

export const rootgnawBoar: CardDef = {
  id: 'rootgnaw_boar',
  name: 'Rootgnaw Boar',
  types: ['creature'],
  subtypes: ['Boar'],
  cost: '{1}{G}',
  power: 1,
  toughness: 2,
  triggers: [{ on: 'allyDies', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'It grows fat on what the forest buries.',
};
