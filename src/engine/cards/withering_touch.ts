import type { CardDef } from '../types';

export const witheringTouch: CardDef = {
  id: 'withering_touch',
  name: 'Toque marchito',
  types: ['instant'],
  cost: '{B}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'pump', power: -2, toughness: -2, to: 0 }],
  },
  flavor: 'Flor, marchitez, polvo.',
};
