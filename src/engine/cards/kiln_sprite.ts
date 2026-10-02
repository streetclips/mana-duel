import type { CardDef } from '../types';

export const kilnSprite: CardDef = {
  id: 'kiln_sprite',
  name: 'Duende del horno',
  types: ['creature'],
  subtypes: ['Elemental'],
  cost: '{R}',
  power: 1,
  toughness: 1,
  keywords: ['haste'],
  triggers: [{ on: 'spell', targets: [], effects: [{ kind: 'pump', power: 1, toughness: 1, to: 'self' }] }],
  flavor: 'Nació en el fuego del vidriero y nunca aprendió a estarse quieto.',
};
