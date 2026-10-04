import type { CardDef } from '../types';

export const wayfarerDruid: CardDef = {
  id: 'wayfarer_druid',
  name: 'Druida de los caminos',
  types: ['creature'],
  subtypes: ['Druida', 'Elfo'],
  cost: '{1}{G}',
  power: 1,
  toughness: 2,
  mana: ['W', 'U', 'B', 'R', 'G'],
  flavor: 'Conoce los cinco caminos y a qué sabe el agua de cada uno.',
};
