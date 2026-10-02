import type { CardDef } from '../types';

export const vesperNovice: CardDef = {
  id: 'vesper_novice',
  name: 'Novicia vesperal',
  types: ['creature'],
  subtypes: ['Clérigo', 'Humano'],
  cost: '{1}{W}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'lifeGain', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'Cada plegaria atendida la hace un poco más fuerte.',
};
