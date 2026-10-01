import type { CardDef } from '../types';

export const sanguineChorister: CardDef = {
  id: 'sanguine_chorister',
  name: 'Sanguine Chorister',
  types: ['creature'],
  subtypes: ['Vampire', 'Cleric'],
  cost: '{1}{W}{B}',
  power: 2,
  toughness: 2,
  triggers: [{ on: 'lifeGain', targets: [], effects: [{ kind: 'loseLife', amount: 1, who: 'opponent' }] }],
  flavor: 'Her hymn is sweet to the faithful and ruinous to everyone else.',
};
