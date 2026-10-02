import type { CardDef } from '../types';

export const turnTheTide: CardDef = {
  id: 'turn_the_tide',
  name: 'Cambio de marea',
  types: ['instant'],
  cost: '{1}{U}{U}',
  spell: {
    targets: [{ kind: 'spell' }],
    effects: [{ kind: 'counter', to: 0 }],
  },
  flavor: 'El hechizo se alzó como una ola y, como una ola, rompió.',
};
