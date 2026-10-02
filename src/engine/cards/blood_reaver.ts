import type { CardDef } from '../types';

export const bloodReaver: CardDef = {
  id: 'blood_reaver',
  name: 'Segador de sangre',
  types: ['creature'],
  subtypes: ['Vampiro'],
  cost: '{2}{B}{B}',
  power: 3,
  toughness: 2,
  keywords: ['lifelink'],
  flavor: 'Siega a los vivos para seguir entre ellos.',
};
