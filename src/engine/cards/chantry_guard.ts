import type { CardDef } from '../types';

export const chantryGuard: CardDef = {
  id: 'chantry_guard',
  name: 'Guardia de capilla',
  types: ['creature'],
  subtypes: ['Soldado', 'Humano'],
  cost: '{1}{W}',
  power: 2,
  toughness: 1,
  keywords: ['lifelink'],
  flavor: 'Guarda las puertas al anochecer, y las puertas la guardan a ella.',
};
