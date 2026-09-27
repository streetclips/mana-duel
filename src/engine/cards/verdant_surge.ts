import type { CardDef } from '../types';

export const verdantSurge: CardDef = {
  id: 'verdant_surge',
  name: 'Verdant Surge',
  types: ['instant'],
  cost: '{G}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'pump', power: 3, toughness: 3, to: 0 }],
  },
  flavor: 'Growth is just violence with patience. Usually.',
};
