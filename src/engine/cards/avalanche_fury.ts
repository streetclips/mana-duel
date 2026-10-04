import type { CardDef } from '../types';

export const avalancheFury: CardDef = {
  id: 'avalanche_fury',
  name: 'Furia del alud',
  types: ['sorcery'],
  cost: '{2}{G}',
  spell: {
    targets: [
      { kind: 'creature', controller: 'you' },
      { kind: 'creature', controller: 'opponent' },
    ],
    effects: [
      { kind: 'pump', power: 2, toughness: 2, to: 0 },
      { kind: 'fight', a: 0, b: 1 },
    ],
  },
  flavor: 'La montaña baja con ella, y no se detiene a pedir permiso.',
};
