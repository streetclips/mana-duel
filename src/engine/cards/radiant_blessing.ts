import type { CardDef } from '../types';

export const radiantBlessing: CardDef = {
  id: 'radiant_blessing',
  name: 'Radiant Blessing',
  types: ['instant'],
  cost: '{W}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [
      { kind: 'pump', power: 2, toughness: 2, to: 0 },
      { kind: 'gainLife', amount: 2 },
    ],
  },
  flavor: 'Light does not ask who deserves it.',
};
