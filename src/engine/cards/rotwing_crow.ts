import type { CardDef } from '../types';

export const rotwingCrow: CardDef = {
  id: 'rotwing_crow',
  name: 'Cuervo alapodrida',
  types: ['creature'],
  subtypes: ['Ave'],
  cost: '{1}{B}',
  power: 1,
  toughness: 1,
  keywords: ['flying'],
  triggers: [{ on: 'allyDies', targets: [], effects: [{ kind: 'loseLife', amount: 1, who: 'opponent' }] }],
  flavor: 'Grazna una vez por cada cadáver, y alguien siempre paga la canción.',
};
