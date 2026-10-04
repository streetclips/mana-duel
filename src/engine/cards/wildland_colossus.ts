import type { CardDef } from '../types';

export const wildlandColossus: CardDef = {
  id: 'wildland_colossus',
  name: 'Coloso de Tierrabrava',
  types: ['creature'],
  subtypes: ['Bestia', 'Elemental'],
  cost: '{4}{G}{G}',
  power: 5,
  toughness: 5,
  keywords: ['trample'],
  triggers: [{ on: 'landfall', targets: [], effects: [{ kind: 'createTokens', token: 'beast_token', amount: 1 }] }],
  flavor: 'Cuando se levanta, el valle entero se levanta con él.',
};
