import type { CardDef } from '../types';

export const bloodFrenzy: CardDef = {
  id: 'blood_frenzy',
  name: 'Frenesí de sangre',
  types: ['instant'],
  cost: '{R}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'pump', power: 2, toughness: 0, to: 0, keywords: ['firstStrike'] }],
  },
  flavor: 'Durante un instante rojo, nada puede tocarlo.',
};
