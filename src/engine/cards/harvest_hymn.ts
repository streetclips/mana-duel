import type { CardDef } from '../types';

export const harvestHymn: CardDef = {
  id: 'harvest_hymn',
  name: 'Harvest Hymn',
  types: ['sorcery'],
  cost: '{2}{G}{W}',
  spell: {
    targets: [],
    effects: [
      { kind: 'addCountersTeam', amount: 1 },
      { kind: 'gainLife', amount: 2 },
    ],
  },
  flavor: 'Sing to the fields, and the fields sing back.',
};
