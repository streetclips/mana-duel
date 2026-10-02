import type { CardDef } from '../types';

export const bloodTithe: CardDef = {
  id: 'blood_tithe',
  name: 'Diezmo de sangre',
  types: ['sorcery'],
  cost: '{2}{B}',
  spell: {
    targets: [],
    effects: [
      { kind: 'loseLife', amount: 2, who: 'opponent' },
      { kind: 'gainLife', amount: 2 },
      { kind: 'draw', amount: 1 },
    ],
  },
  flavor: 'Paga lo que debes, y un poco más para las velas.',
};
