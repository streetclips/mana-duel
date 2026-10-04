import type { CardDef } from '../types';

export const flamecrestMentor: CardDef = {
  id: 'flamecrest_mentor',
  name: 'Maestra de la llama',
  types: ['creature'],
  subtypes: ['Monje', 'Humano'],
  cost: '{2}{R}',
  power: 2,
  toughness: 2,
  keywords: ['prowess'],
  triggers: [{ on: 'spell', targets: [], effects: [{ kind: 'createTokens', token: 'monk_token', amount: 1 }] }],
  flavor: 'Cada lección suya enciende a un discípulo nuevo.',
};
