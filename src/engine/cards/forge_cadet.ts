import type { CardDef } from '../types';

export const forgeCadet: CardDef = {
  id: 'forge_cadet',
  name: 'Cadete de la forja',
  types: ['creature'],
  subtypes: ['Soldado', 'Humano'],
  cost: '{1}{W}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'allyEnters', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'Fue la primera en cruzar la puerta de la forja y cuenta a cada soldado que la sigue.',
};
