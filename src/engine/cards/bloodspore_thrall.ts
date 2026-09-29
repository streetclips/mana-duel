import type { CardDef } from '../types';

export const bloodsporeThrall: CardDef = {
  id: 'bloodspore_thrall',
  name: 'Bloodspore Thrall',
  types: ['creature'],
  subtypes: ['Fungus', 'Zombie'],
  cost: '{1}{B}',
  power: 1,
  toughness: 1,
  keywords: ['undying'],
  activated: [{ cost: '{0}', sacrifice: true, targets: [], effects: [{ kind: 'loseLife', amount: 1, who: 'opponent' }] }],
  flavor: 'It bursts, it spreads, it stands up again.',
};
