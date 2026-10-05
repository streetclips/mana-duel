import type { CardDef } from './types';

export const bell: CardDef = {
  id: 'bell',
  name: 'Campana fúnebre',
  types: ['relic'],
  triggers: [{ on: 'upkeep', targets: [], effects: [{ kind: 'loseLife', amount: 1, who: 'opponent' }] }],
  flavor: 'Dobla una vez cada turno, y siempre por el mismo.',
};

export const grimoire: CardDef = {
  id: 'grimoire',
  name: 'Grimorio prohibido',
  types: ['relic'],
  triggers: [
    {
      on: 'upkeep',
      targets: [],
      effects: [
        { kind: 'draw', amount: 1 },
        { kind: 'loseLife', amount: 1 },
      ],
    },
  ],
  flavor: 'Cada página que lees también te lee a ti.',
};

export const censer: CardDef = {
  id: 'censer',
  name: 'Incensario de esporas',
  types: ['relic'],
  triggers: [{ on: 'spell', targets: [], effects: [{ kind: 'createTokens', token: 'saproling_token', amount: 1 }] }],
  flavor: 'Cada conjuro aviva las brasas, y de cada brasa brota algo vivo.',
};

export const urn: CardDef = {
  id: 'urn',
  name: 'Urna de almas',
  types: ['relic'],
  triggers: [{ on: 'allyDies', targets: [], effects: [{ kind: 'loseLife', amount: 1, who: 'opponent' }] }],
  flavor: 'Guarda a los caídos y cobra su deuda.',
};

export const drum: CardDef = {
  id: 'drum',
  name: 'Tambor de guerra',
  types: ['relic'],
  triggers: [{ on: 'landfall', targets: [], effects: [{ kind: 'pumpTeam', power: 1, toughness: 0 }] }],
  flavor: 'Cada paso de tu ejército hace temblar la tierra.',
};

export const chalice: CardDef = {
  id: 'chalice',
  name: 'Cáliz del peregrino',
  types: ['relic'],
  triggers: [{ on: 'allyEnters', targets: [], effects: [{ kind: 'gainLife', amount: 1 }] }],
  flavor: 'Quien bebe de él nunca camina solo.',
};

export const tome: CardDef = {
  id: 'tome',
  name: 'Libro de horas',
  types: ['relic'],
  triggers: [{ on: 'upkeep', condition: 'emptyHand', targets: [], effects: [{ kind: 'draw', amount: 1 }] }],
  flavor: 'Una oración para cada hora en que no te queda nada.',
};

export const crown: CardDef = {
  id: 'crown',
  name: 'Corona del tirano',
  types: ['relic'],
  triggers: [{ on: 'upkeep', targets: [], effects: [{ kind: 'pumpTeam', power: 1, toughness: 0 }] }],
  flavor: 'Sus soldados no le temen a la muerte. Le temen a él.',
};

export const RELIC_DEFS: readonly CardDef[] = [censer, urn, drum, chalice, tome, bell, grimoire, crown];
