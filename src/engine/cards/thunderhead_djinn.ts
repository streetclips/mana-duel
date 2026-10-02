import type { CardDef } from '../types';

export const thunderheadDjinn: CardDef = {
  id: 'thunderhead_djinn',
  name: 'Djinn del nubarrón',
  types: ['creature'],
  subtypes: ['Djinn'],
  cost: '{3}{U}{R}',
  power: 4,
  toughness: 4,
  keywords: ['flying'],
  triggers: [{ on: 'enters', targets: [{ kind: 'any' }], effects: [{ kind: 'damage', amount: 2, to: 0 }] }],
};
