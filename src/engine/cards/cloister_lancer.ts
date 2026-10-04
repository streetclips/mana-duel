import type { CardDef } from '../types';

export const cloisterLancer: CardDef = {
  id: 'cloister_lancer',
  name: 'Lancera del claustro',
  types: ['creature'],
  subtypes: ['Monje', 'Humano'],
  cost: '{R}',
  power: 1,
  toughness: 2,
  keywords: ['haste', 'prowess'],
  flavor: 'Corre hacia la batalla antes de que termine el primer rezo.',
};
