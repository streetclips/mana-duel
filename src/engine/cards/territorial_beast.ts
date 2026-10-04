import type { CardDef } from '../types';

export const territorialBeast: CardDef = {
  id: 'territorial_beast',
  name: 'Bestia territorial',
  types: ['creature'],
  subtypes: ['Bestia'],
  cost: '{3}{G}',
  power: 3,
  toughness: 3,
  triggers: [{ on: 'landfall', targets: [], effects: [{ kind: 'pump', power: 2, toughness: 2, to: 'self' }] }],
  flavor: 'Cada palmo de tierra nueva es suyo, y lo defiende.',
};
