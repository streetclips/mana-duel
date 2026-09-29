import type { CardDef } from '../types';

export const elementalToken: CardDef = {
  id: 'elemental_token',
  name: 'Elemental',
  types: ['creature'],
  subtypes: ['Elemental'],
  token: true,
  colors: ['R'],
  power: 1,
  toughness: 1,
  keywords: ['haste'],
};
