import type { CardDef } from '../types';

export const mistgraveRevenant: CardDef = {
  id: 'mistgrave_revenant',
  name: 'Ahogado brumoso',
  types: ['creature'],
  subtypes: ['Horror', 'Zombie'],
  cost: '{3}{U}{B}',
  power: 4,
  toughness: 4,
  keywords: ['skulk'],
  triggers: [
    {
      on: 'damagesPlayer',
      targets: [],
      effects: [
        { kind: 'draw', amount: 1 },
        { kind: 'discard', amount: 1, who: 'opponent' },
      ],
    },
  ],
  flavor: 'Los ahogados nunca olvidan. Solo te hacen olvidar.',
};
