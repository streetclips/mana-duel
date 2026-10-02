import type { CardDef } from '../types';

export const vesperVow: CardDef = {
  id: 'vesper_vow',
  name: 'Voto de vísperas',
  types: ['instant'],
  cost: '{W}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'pump', power: 2, toughness: 2, to: 0, keywords: ['lifelink'] }],
  },
  flavor: 'Jurado al anochecer, cumplido con sangre.',
};
