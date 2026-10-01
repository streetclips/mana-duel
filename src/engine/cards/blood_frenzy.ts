import type { CardDef } from '../types';

export const bloodFrenzy: CardDef = {
  id: 'blood_frenzy',
  name: 'Blood Frenzy',
  types: ['instant'],
  cost: '{R}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'pump', power: 2, toughness: 0, to: 0, keywords: ['firstStrike'] }],
  },
  flavor: 'For one red moment, nothing can touch it.',
};
