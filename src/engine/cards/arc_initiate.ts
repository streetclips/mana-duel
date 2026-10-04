import type { CardDef } from '../types';

export const arcInitiate: CardDef = {
  id: 'arc_initiate',
  name: 'Iniciada del arco',
  types: ['creature'],
  subtypes: ['Monje', 'Humano'],
  cost: '{1}{R}',
  power: 2,
  toughness: 2,
  keywords: ['prowess'],
  flavor: 'Cada hechizo que lanzan sus maestros aún le zumba en los nudillos.',
};
