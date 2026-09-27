import type { CardDef } from '../types';

export const turnTheTide: CardDef = {
  id: 'turn_the_tide',
  name: 'Turn the Tide',
  types: ['instant'],
  cost: '{1}{U}{U}',
  spell: {
    targets: [{ kind: 'spell' }],
    effects: [{ kind: 'counter', to: 0 }],
  },
  flavor: 'The spell rose like a wave, and like a wave it broke.',
};
