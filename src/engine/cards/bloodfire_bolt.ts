import type { CardDef } from '../types';

export const bloodfireBolt: CardDef = {
  id: 'bloodfire_bolt',
  name: 'Bloodfire Bolt',
  types: ['instant'],
  cost: '{B}{R}',
  spell: { targets: [{ kind: 'any' }], effects: [{ kind: 'damage', amount: 3, to: 0 }] },
  flavor: 'Black blood, red fire, one wound.',
};
