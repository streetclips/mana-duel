import type { CardDef } from '../types';

export const gloomWisp: CardDef = {
  id: 'gloom_wisp',
  name: 'Voluta sombría',
  types: ['creature'],
  subtypes: ['Espíritu'],
  cost: '{B}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'dies', targets: [], effects: [{ kind: 'draw', amount: 1 }] }],
  flavor: 'Apágala y su último parpadeo te revelará un secreto.',
};
