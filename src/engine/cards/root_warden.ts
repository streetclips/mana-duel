import type { CardDef } from '../types';

export const rootWarden: CardDef = {
  id: 'root_warden',
  name: 'Guardián de raíces',
  types: ['creature'],
  subtypes: ['Guerrero', 'Elfo'],
  cost: '{G}{W}',
  power: 2,
  toughness: 3,
  keywords: ['vigilance'],
  flavor: 'Sus raíces llegan hasta los cinco caminos.',
};
