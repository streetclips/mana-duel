import type { CardDef } from '../types';

export const dawnsVerdict: CardDef = {
  id: 'dawns_verdict',
  name: "Dawn's Verdict",
  types: ['instant'],
  cost: '{2}{W}',
  spell: {
    targets: [{ kind: 'creature', tapped: true }],
    effects: [{ kind: 'destroy', to: 0 }],
  },
  flavor: 'Those who strike in the night are judged at dawn.',
};
