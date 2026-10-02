import type { CardDef } from '../types';

export const hopefulSquire: CardDef = {
  id: 'hopeful_squire',
  name: 'Escudera soñadora',
  types: ['creature'],
  subtypes: ['Soldado', 'Humano'],
  cost: '{1}{W}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'attacks', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'Cada batalla la hace un poco más caballera.',
};
