import type { CardDef } from '../types';

export const shellOfTheDeep: CardDef = {
  id: 'shell_of_the_deep',
  name: 'Concha abisal',
  types: ['instant'],
  cost: '{G}',
  spell: {
    targets: [{ kind: 'creature', controller: 'you' }],
    effects: [{ kind: 'pump', power: 1, toughness: 1, to: 0, keywords: ['hexproof'] }],
  },
  flavor: 'El arrecife se cierra en torno a sus hijos.',
};
