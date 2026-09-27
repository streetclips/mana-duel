import type { CardDef } from '../types';

export const graveSentence: CardDef = {
  id: 'grave_sentence',
  name: 'Grave Sentence',
  types: ['instant'],
  cost: '{2}{B}{B}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'destroy', to: 0 }],
  },
  flavor: 'No appeal. No reprieve.',
};
