import type { CardDef } from '../types';

export const rendFlesh: CardDef = {
  id: 'rend_flesh',
  name: 'Desgarrar la carne',
  types: ['sorcery'],
  cost: '{2}{B}',
  spell: { targets: [{ kind: 'creature' }], effects: [{ kind: 'destroy', to: 0 }] },
  flavor: 'Lo que la fosa quiere, la fosa se lo lleva.',
};
