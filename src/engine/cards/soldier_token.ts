import type { CardDef } from '../types';

export const soldierToken: CardDef = {
  id: 'soldier_token',
  name: 'Soldier',
  types: ['creature'],
  subtypes: ['Soldier'],
  token: true,
  colors: ['W'],
  power: 1,
  toughness: 1,
};
