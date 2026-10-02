import type { CardDef } from '../types';

export const moltenRebuke: CardDef = {
  id: 'molten_rebuke',
  name: 'Reprimenda fundida',
  types: ['instant'],
  cost: '{1}{R}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'damage', amount: 3, to: 0 }],
  },
  flavor: 'Los herreros responden a los insultos como a todo: con calor.',
};
