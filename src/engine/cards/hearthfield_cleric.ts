import type { CardDef } from '../types';

export const hearthfieldCleric: CardDef = {
  id: 'hearthfield_cleric',
  name: 'Hearthfield Cleric',
  types: ['creature'],
  subtypes: ['Human', 'Cleric'],
  cost: '{2}{W}',
  power: 2,
  toughness: 3,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'gainLife', amount: 3 }] }],
  flavor: 'Bread for the hungry, light for the lost.',
};
