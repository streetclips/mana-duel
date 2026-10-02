import type { CardDef } from '../types';

export const bloomcallerDruid: CardDef = {
  id: 'bloomcaller_druid',
  name: 'Druida llamaflores',
  types: ['creature'],
  subtypes: ['Druida', 'Elfo'],
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
  flavor: 'Donde ella canta, hasta los cansados crecen.',
};
