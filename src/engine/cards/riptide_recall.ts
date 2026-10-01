import type { CardDef } from '../types';

export const riptideRecall: CardDef = {
  id: 'riptide_recall',
  name: 'Riptide Recall',
  types: ['instant'],
  cost: '{U}',
  spell: { targets: [{ kind: 'creature', controller: 'opponent' }], effects: [{ kind: 'bounce', to: 0 }] },
  flavor: 'The tide takes what it is owed and returns it, eventually.',
};
