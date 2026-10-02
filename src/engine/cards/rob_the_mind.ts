import type { CardDef } from '../types';

export const robTheMind: CardDef = {
  id: 'rob_the_mind',
  name: 'Saquear la mente',
  types: ['sorcery'],
  cost: '{2}{B}',
  spell: {
    targets: [],
    effects: [{ kind: 'discard', amount: 2, who: 'opponent' }],
  },
  flavor: 'No echarás de menos lo que no recuerdas haber tenido.',
};
