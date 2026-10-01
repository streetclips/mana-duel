import type { CardDef } from '../types';

export const lastRites: CardDef = {
  id: 'last_rites',
  name: 'Last Rites',
  types: ['sorcery'],
  cost: '{2}{W}{B}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [
      { kind: 'destroy', to: 0 },
      { kind: 'gainLife', amount: 2 },
    ],
  },
  flavor: 'Every ending is a blessing to someone.',
};
