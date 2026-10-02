import type { CardDef } from '../types';

export const soldierToken: CardDef = {
  id: 'soldier_token',
  name: 'Soldado',
  types: ['creature'],
  subtypes: ['Soldado'],
  token: true,
  colors: ['W'],
  power: 1,
  toughness: 1,
};
