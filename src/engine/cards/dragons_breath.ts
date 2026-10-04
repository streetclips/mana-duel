import type { CardDef } from '../types';

export const dragonsBreath: CardDef = {
  id: 'dragons_breath',
  name: 'Aliento del dragón',
  types: ['instant'],
  cost: '{2}{R}',
  spell: { targets: [{ kind: 'any' }], effects: [{ kind: 'damage', amount: 3, to: 0 }] },
  flavor: 'Los monjes lo llaman el sermón más breve del templo.',
};
