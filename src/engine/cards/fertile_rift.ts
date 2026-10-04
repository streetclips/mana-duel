import type { CardDef } from '../types';

export const fertileRift: CardDef = {
  id: 'fertile_rift',
  name: 'Grieta fértil',
  types: ['instant'],
  cost: '{1}{G}',
  spell: { targets: [], effects: [{ kind: 'searchLand', land: 'forest', battlefield: 1, tapped: true }] },
  flavor: 'La tierra se abre y, por la herida, brota el bosque.',
};
