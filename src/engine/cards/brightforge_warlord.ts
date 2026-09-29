import type { CardDef } from '../types';

export const brightforgeWarlord: CardDef = {
  id: 'brightforge_warlord',
  name: 'Brightforge Warlord',
  types: ['creature'],
  subtypes: ['Human', 'Knight'],
  cost: '{3}{R}{W}',
  power: 4,
  toughness: 4,
  triggers: [
    {
      on: 'enters',
      targets: [],
      effects: [{ kind: 'pumpTeam', power: 1, toughness: 0, keywords: ['haste'] }],
    },
  ],
  flavor: 'When the Warlord rides out, the whole forge follows, still glowing.',
};
