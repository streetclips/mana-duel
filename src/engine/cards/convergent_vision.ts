import type { CardDef } from '../types';

export const convergentVision: CardDef = {
  id: 'convergent_vision',
  name: 'Visión del cruce',
  types: ['instant'],
  cost: '{1}{G}{U}',
  spell: { targets: [], effects: [{ kind: 'draw', amount: 2 }] },
  flavor: 'Lo que la marea esconde, la raíz lo recuerda.',
};
