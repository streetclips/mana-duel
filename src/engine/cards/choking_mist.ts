import type { CardDef } from '../types';

export const chokingMist: CardDef = {
  id: 'choking_mist',
  name: 'Niebla asfixiante',
  types: ['instant'],
  cost: '{1}{B}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'pump', power: -3, toughness: -3, to: 0 }],
  },
  flavor: 'Respira hondo. Ese fue tu error.',
};
