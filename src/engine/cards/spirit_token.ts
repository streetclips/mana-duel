import type { CardDef } from '../types';

export const spiritToken: CardDef = {
  id: 'spirit_token',
  name: 'Spirit',
  types: ['creature'],
  subtypes: ['Spirit'],
  token: true,
  colors: ['W', 'B'],
  power: 1,
  toughness: 1,
  keywords: ['flying'],
};
