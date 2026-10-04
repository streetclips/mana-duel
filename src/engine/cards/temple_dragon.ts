import type { CardDef } from '../types';

export const templeDragon: CardDef = {
  id: 'temple_dragon',
  name: 'Dragón del templo',
  types: ['creature'],
  subtypes: ['Dragón'],
  cost: '{3}{R}{R}',
  power: 4,
  toughness: 4,
  keywords: ['flying', 'prowess'],
  flavor: 'Los monjes no lo veneran: entrenan con él.',
};
