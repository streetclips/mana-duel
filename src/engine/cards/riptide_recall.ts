import type { CardDef } from '../types';

export const riptideRecall: CardDef = {
  id: 'riptide_recall',
  name: 'Retorno de la resaca',
  types: ['instant'],
  cost: '{U}',
  spell: { targets: [{ kind: 'creature', controller: 'opponent' }], effects: [{ kind: 'bounce', to: 0 }] },
  flavor: 'La marea se cobra lo que se le debe y lo devuelve, tarde o temprano.',
};
