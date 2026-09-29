import type { CardDef } from '../types';

export const nightshadeTonic: CardDef = {
  id: 'nightshade_tonic',
  name: 'Nightshade Tonic',
  types: ['instant'],
  cost: '{1}{G}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'pump', power: 1, toughness: 1, to: 0, keywords: ['deathtouch'] }],
  },
  flavor: 'A drop to strengthen, a drop to kill. Never mix them up.',
};
