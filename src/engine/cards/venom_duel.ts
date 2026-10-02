import type { CardDef } from '../types';

export const venomDuel: CardDef = {
  id: 'venom_duel',
  name: 'Duelo de veneno',
  types: ['sorcery'],
  cost: '{1}{B}{G}',
  spell: {
    targets: [
      { kind: 'creature', controller: 'you' },
      { kind: 'creature', controller: 'opponent' },
    ],
    effects: [
      { kind: 'pump', power: 0, toughness: 0, to: 0, keywords: ['deathtouch'] },
      { kind: 'fight', a: 0, b: 1 },
    ],
  },
  flavor: 'En la penumbra, hasta el mordisco más pequeño es definitivo.',
};
