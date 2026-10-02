import type { CardDef } from '../types';

export const hushwingBat: CardDef = {
  id: 'hushwing_bat',
  name: 'Murciélago silente',
  types: ['creature'],
  subtypes: ['Murciélago'],
  cost: '{1}{B}',
  power: 1,
  toughness: 1,
  keywords: ['flying'],
  triggers: [{ on: 'damagesPlayer', targets: [], effects: [{ kind: 'discard', amount: 1, who: 'opponent' }] }],
  flavor: 'Su susurro te roba las palabras de la cabeza.',
};
