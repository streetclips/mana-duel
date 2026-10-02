import type { CardDef } from '../types';

export const warrenHare: CardDef = {
  id: 'warren_hare',
  name: 'Liebre del vivar',
  types: ['creature'],
  subtypes: ['Conejo'],
  cost: '{G}',
  power: 1,
  toughness: 1,
  triggers: [
    {
      on: 'dies',
      targets: [{ kind: 'creature', controller: 'you' }],
      effects: [{ kind: 'addCounters', amount: 1, to: 0 }],
    },
  ],
  flavor: 'Cuando una cae, toda la madriguera se envalentona.',
};
