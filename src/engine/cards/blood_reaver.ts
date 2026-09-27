import type { CardDef } from '../types';

export const bloodReaver: CardDef = {
  id: 'blood_reaver',
  name: 'Blood Reaver',
  types: ['creature'],
  subtypes: ['Vampire'],
  cost: '{2}{B}{B}',
  power: 3,
  toughness: 2,
  keywords: ['lifelink'],
  flavor: 'It harvests the living to stay among them.',
};
