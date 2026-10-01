import type { CardDef } from '../types';

export const chantryGuard: CardDef = {
  id: 'chantry_guard',
  name: 'Chantry Guard',
  types: ['creature'],
  subtypes: ['Human', 'Soldier'],
  cost: '{1}{W}',
  power: 2,
  toughness: 1,
  keywords: ['lifelink'],
  flavor: 'She guards the doors at dusk, and the doors guard her.',
};
