import type { CardDef } from '../types';

export const veilbornSpecter: CardDef = {
  id: 'veilborn_specter',
  name: 'Veilborn Specter',
  types: ['creature'],
  subtypes: ['Specter'],
  cost: '{2}{U}{B}',
  power: 2,
  toughness: 3,
  keywords: ['flying'],
  triggers: [{ on: 'damagesPlayer', targets: [], effects: [{ kind: 'draw', amount: 1 }] }],
  flavor: "It doesn't haunt places. It haunts memories.",
};
