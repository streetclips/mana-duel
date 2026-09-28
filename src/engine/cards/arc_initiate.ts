import type { CardDef } from '../types';

export const arcInitiate: CardDef = {
  id: 'arc_initiate',
  name: 'Arc Initiate',
  types: ['creature'],
  subtypes: ['Human', 'Monk'],
  cost: '{1}{R}',
  power: 2,
  toughness: 2,
  triggers: [{ on: 'spell', targets: [], effects: [{ kind: 'pump', power: 1, toughness: 1, to: 'self' }] }],
  flavor: 'Every spell her masters cast still hums in her knuckles.',
};
