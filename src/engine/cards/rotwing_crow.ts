import type { CardDef } from '../types';

export const rotwingCrow: CardDef = {
  id: 'rotwing_crow',
  name: 'Rotwing Crow',
  types: ['creature'],
  subtypes: ['Bird'],
  cost: '{1}{B}',
  power: 1,
  toughness: 1,
  keywords: ['flying'],
  triggers: [{ on: 'allyDies', targets: [], effects: [{ kind: 'loseLife', amount: 1, who: 'opponent' }] }],
  flavor: 'It caws once for every corpse, and someone always pays for the song.',
};
