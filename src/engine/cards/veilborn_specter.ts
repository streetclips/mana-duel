import type { CardDef } from '../types';

export const veilbornSpecter: CardDef = {
  id: 'veilborn_specter',
  name: 'Espectro del velo',
  types: ['creature'],
  subtypes: ['Espectro'],
  cost: '{2}{U}{B}',
  power: 2,
  toughness: 3,
  keywords: ['flying'],
  triggers: [{ on: 'damagesPlayer', targets: [], effects: [{ kind: 'draw', amount: 1 }] }],
  flavor: 'No ronda lugares. Ronda recuerdos.',
};
