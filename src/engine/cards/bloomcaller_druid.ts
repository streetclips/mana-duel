import type { CardDef } from '../types';

export const bloomcallerDruid: CardDef = {
  id: 'bloomcaller_druid',
  name: 'Bloomcaller Druid',
  types: ['creature'],
  subtypes: ['Elf', 'Druid'],
  cost: '{1}{G}',
  power: 1,
  toughness: 1,
  triggers: [
    {
      on: 'enters',
      targets: [{ kind: 'creature', controller: 'you' }],
      effects: [{ kind: 'addCounters', amount: 1, to: 0 }],
    },
  ],
  flavor: 'Where she sings, even the weary grow tall.',
};
