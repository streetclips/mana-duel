import type { CardDef } from '../types';

export const bonewoodStalker: CardDef = {
  id: 'bonewood_stalker',
  name: 'Acosador óseo',
  types: ['creature'],
  subtypes: ['Bestia', 'Zombie'],
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
  flavor: 'Se deshará con gusto si te lleva consigo.',
};
