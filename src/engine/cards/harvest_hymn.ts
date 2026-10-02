import type { CardDef } from '../types';

export const harvestHymn: CardDef = {
  id: 'harvest_hymn',
  name: 'Himno de la cosecha',
  types: ['sorcery'],
  cost: '{2}{G}{W}',
  spell: {
    targets: [],
    effects: [
      { kind: 'addCountersTeam', amount: 1 },
      { kind: 'gainLife', amount: 2 },
    ],
  },
  flavor: 'Canta a los campos y los campos te devolverán el canto.',
};
