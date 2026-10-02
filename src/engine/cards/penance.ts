import type { CardDef } from '../types';

export const penance: CardDef = {
  id: 'penance',
  name: 'Penitencia',
  types: ['instant'],
  cost: '{W}{B}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [
      { kind: 'pump', power: -2, toughness: -2, to: 0 },
      { kind: 'gainLife', amount: 2 },
    ],
  },
  flavor: 'El templo perdona. El templo también cobra.',
};
