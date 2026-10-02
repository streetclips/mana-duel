import type { CardDef } from '../types';

export const hearthfieldCleric: CardDef = {
  id: 'hearthfield_cleric',
  name: 'Clérigo del lar',
  types: ['creature'],
  subtypes: ['Clérigo', 'Humano'],
  cost: '{2}{W}',
  power: 2,
  toughness: 3,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'gainLife', amount: 3 }] }],
  flavor: 'Pan para el hambriento, luz para el perdido.',
};
