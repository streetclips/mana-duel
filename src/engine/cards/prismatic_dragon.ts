import type { CardDef } from '../types';

export const prismaticDragon: CardDef = {
  id: 'prismatic_dragon',
  name: 'Dragón prismático',
  types: ['creature'],
  subtypes: ['Dragón'],
  cost: '{W}{U}{B}{R}{G}',
  power: 5,
  toughness: 5,
  keywords: ['flying', 'lifelink'],
  flavor: 'Donde se cruzan los cinco caminos, él los vigila todos.',
};
