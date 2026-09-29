import type { CardDef } from '../types';

export const robTheMind: CardDef = {
  id: 'rob_the_mind',
  name: 'Rob the Mind',
  types: ['sorcery'],
  cost: '{2}{B}',
  spell: {
    targets: [],
    effects: [{ kind: 'discard', amount: 2, who: 'opponent' }],
  },
  flavor: "You won't miss what you can't remember having.",
};
