import type { CardDef } from '../types';

export const brimstoneSkirmisher: CardDef = {
  id: 'brimstone_skirmisher',
  name: 'Brimstone Skirmisher',
  types: ['creature'],
  subtypes: ['Goblin', 'Warrior'],
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
  flavor: 'Its war cry is a thrown coal.',
};
