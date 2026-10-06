import type { CardDef } from '../types';

export const bloodsporeThrall: CardDef = {
  id: 'bloodspore_thrall',
  name: 'Siervo de esporas',
  types: ['creature'],
  subtypes: ['Zombie', 'Hongo'],
  cost: '{1}{B}',
  power: 1,
  toughness: 1,
  keywords: ['undying'],
  activated: [
    { cost: '{0}', sacrifice: true, targets: [], effects: [{ kind: 'loseLife', amount: 1, who: 'opponent' }] },
  ],
  flavor: 'Revienta, se esparce y vuelve a levantarse.',
};
