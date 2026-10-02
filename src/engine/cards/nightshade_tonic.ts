import type { CardDef } from '../types';

export const nightshadeTonic: CardDef = {
  id: 'nightshade_tonic',
  name: 'Tónico de belladona',
  types: ['instant'],
  cost: '{1}{G}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'pump', power: 1, toughness: 1, to: 0, keywords: ['deathtouch'] }],
  },
  flavor: 'Una gota para fortalecer, otra para matar. Nunca las confundas.',
};
