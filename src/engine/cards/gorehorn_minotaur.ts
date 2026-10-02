import type { CardDef } from '../types';

export const gorehornMinotaur: CardDef = {
  id: 'gorehorn_minotaur',
  name: 'Minotauro sangriento',
  types: ['creature'],
  subtypes: ['Berserker', 'Minotauro'],
  cost: '{2}{B}{R}',
  power: 3,
  toughness: 3,
  keywords: ['menace'],
  triggers: [
    {
      on: 'enters',
      condition: 'opponentDamaged',
      targets: [],
      effects: [{ kind: 'addCounters', amount: 1, to: 'self' }],
    },
  ],
  flavor: 'Sigue los gritos hasta la pelea.',
};
