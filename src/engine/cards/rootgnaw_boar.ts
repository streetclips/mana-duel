import type { CardDef } from '../types';

export const rootgnawBoar: CardDef = {
  id: 'rootgnaw_boar',
  name: 'Jabalí roerraíces',
  types: ['creature'],
  subtypes: ['Jabalí'],
  cost: '{1}{G}',
  power: 1,
  toughness: 2,
  triggers: [{ on: 'allyDies', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'Engorda con lo que el bosque entierra.',
};
