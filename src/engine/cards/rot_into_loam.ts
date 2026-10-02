import type { CardDef } from '../types';

export const rotIntoLoam: CardDef = {
  id: 'rot_into_loam',
  name: 'Volver al mantillo',
  types: ['instant'],
  cost: '{B}{G}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [
      { kind: 'pump', power: -2, toughness: -2, to: 0 },
      { kind: 'createTokens', token: 'saproling_token', amount: 1 },
    ],
  },
  flavor: 'En la selva nada se desperdicia. Y tú, menos que nada.',
};
