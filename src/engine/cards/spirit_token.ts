import type { CardDef } from '../types';

export const spiritToken: CardDef = {
  id: 'spirit_token',
  name: 'Espíritu',
  types: ['creature'],
  subtypes: ['Espíritu'],
  token: true,
  colors: ['W', 'B'],
  power: 1,
  toughness: 1,
  keywords: ['flying'],
};
