import type { CardDef } from '../types';

export const brimstoneSkirmisher: CardDef = {
  id: 'brimstone_skirmisher',
  name: 'Hostigador de azufre',
  types: ['creature'],
  subtypes: ['Guerrero', 'Trasgo'],
  cost: '{1}{R}',
  power: 2,
  toughness: 1,
  triggers: [
    {
      on: 'attacks',
      targets: [{ kind: 'player', controller: 'opponent' }],
      effects: [{ kind: 'damage', amount: 1, to: 0 }],
    },
  ],
  flavor: 'Su grito de guerra es una brasa al vuelo.',
};
