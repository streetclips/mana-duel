import type { CardDef } from '../types';

export const bonewoodStalker: CardDef = {
  id: 'bonewood_stalker',
  name: 'Bonewood Stalker',
  types: ['creature'],
  subtypes: ['Zombie', 'Beast'],
  cost: '{2}{B}',
  power: 2,
  toughness: 2,
  activated: [
    {
      cost: '{0}',
      sacrifice: true,
      targets: [{ kind: 'creature' }],
      effects: [{ kind: 'pump', power: -2, toughness: -2, to: 0 }],
    },
  ],
  flavor: 'It will gladly fall apart if it takes you with it.',
};
