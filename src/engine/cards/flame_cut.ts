import type { CardDef } from '../types';

export const flameCut: CardDef = {
  id: 'flame_cut',
  name: 'Corte de llama',
  types: ['instant'],
  cost: '{1}{R}',
  spell: { targets: [{ kind: 'creature' }], effects: [{ kind: 'damage', amount: 2, to: 0 }] },
  flavor: 'Un tajo limpio, cauterizado al instante.',
};
