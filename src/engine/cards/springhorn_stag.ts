import type { CardDef } from '../types';

export const springhornStag: CardDef = {
  id: 'springhorn_stag',
  name: 'Ciervo del manantial',
  types: ['creature'],
  subtypes: ['Ciervo'],
  cost: '{2}{G}',
  power: 2,
  toughness: 3,
  triggers: [{ on: 'landfall', targets: [], effects: [{ kind: 'gainLife', amount: 2 }] }],
  flavor: 'Bebe allí donde brota el agua nueva.',
};
