import type { CardDef } from '../types';

export const blisteringHellion: CardDef = {
  id: 'blistering_hellion',
  name: 'Infernal abrasador',
  types: ['creature'],
  subtypes: ['Infernal'],
  cost: '{2}{R}',
  power: 3,
  toughness: 2,
  triggers: [
    {
      on: 'enters',
      condition: 'opponentDamaged',
      targets: [],
      effects: [{ kind: 'addCounters', amount: 2, to: 'self' }],
    },
  ],
  flavor: 'El olor de la sangre lo hace arder con más fuerza.',
};
