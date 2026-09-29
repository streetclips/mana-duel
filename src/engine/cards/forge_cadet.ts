import type { CardDef } from '../types';

export const forgeCadet: CardDef = {
  id: 'forge_cadet',
  name: 'Forge Cadet',
  types: ['creature'],
  subtypes: ['Human', 'Soldier'],
  cost: '{1}{W}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'allyEnters', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'She was the first through the forge gate, and she counts every soldier who follows.',
};
