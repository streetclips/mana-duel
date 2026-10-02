import type { CardDef } from '../types';

export const dawnsVerdict: CardDef = {
  id: 'dawns_verdict',
  name: 'Veredicto del alba',
  types: ['instant'],
  cost: '{2}{W}',
  spell: {
    targets: [{ kind: 'creature', tapped: true }],
    effects: [{ kind: 'destroy', to: 0 }],
  },
  flavor: 'Quien ataca de noche es juzgado al alba.',
};
