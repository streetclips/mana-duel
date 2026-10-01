import type { CardDef } from '../types';

export const rendFlesh: CardDef = {
  id: 'rend_flesh',
  name: 'Rend Flesh',
  types: ['sorcery'],
  cost: '{2}{B}',
  spell: { targets: [{ kind: 'creature' }], effects: [{ kind: 'destroy', to: 0 }] },
  flavor: 'What the pit wants, the pit takes.',
};
