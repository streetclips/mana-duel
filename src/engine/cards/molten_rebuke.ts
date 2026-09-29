import type { CardDef } from '../types';

export const moltenRebuke: CardDef = {
  id: 'molten_rebuke',
  name: 'Molten Rebuke',
  types: ['instant'],
  cost: '{1}{R}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'damage', amount: 3, to: 0 }],
  },
  flavor: 'The smiths answer insults the way they answer everything: with heat.',
};
