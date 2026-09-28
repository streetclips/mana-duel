import type { CardDef } from '../types';

export const stormglassDrake: CardDef = {
  id: 'stormglass_drake',
  name: 'Stormglass Drake',
  types: ['creature'],
  subtypes: ['Drake'],
  cost: '{2}{U}{R}',
  power: 2,
  toughness: 3,
  keywords: ['flying'],
  triggers: [{ on: 'spell', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'Every storm leaves a little more lightning inside its glass.',
};
