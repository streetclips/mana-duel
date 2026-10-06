import { describe, expect, it } from 'vitest';
import { chooseAction } from '../../src/ai';
import {
  RELIC_DEFS,
  applyAction,
  cardSummary,
  checkInvariants,
  createGame,
  describeEvent,
  describeState,
  getLegalActions,
  getPower,
  registerCard,
  rulesText,
  tryApplyAction,
  typeLine,
  type CardDef,
  type GameEvent,
  type GameState,
  type TriggeredAbility,
} from '../../src/engine';
import { cast, expectSound, life, passToStep, playLand, resolveStack, scenario, zoneOf } from '../helpers';

function saprolings(s: GameState): string[] {
  return s.players[0].battlefield.filter((id) => s.cards[id]?.def === 'saproling_token');
}

describe('relics', () => {
  it('start the game beside their player, in no other zone, and trigger nothing yet', () => {
    const s = createGame({ seed: 4, startingPlayer: 0, players: [{ relics: ['bell', 'chalice'] }, { relics: ['urn'] }] });
    expectSound(s);
    expect(s.players.map((ps) => ps.command.map((id) => s.cards[id]?.def))).toEqual([['bell', 'chalice'], ['urn']]);
    expect(s.players[0].command.map((id) => s.cards[id]?.zone)).toEqual(['command', 'command']);
    expect(s.players.map((ps) => ps.battlefield)).toEqual([[], []]);
    expect(s.triggers).toEqual([]);
    expect(Object.keys(s.cards)).toHaveLength(83);
  });

  it('are refused unless they are relics, and relics go nowhere else', () => {
    expect(() => createGame({ players: [{ relics: ['forest'] }, {}] })).toThrow('"forest" is not a relic');
    expect(() => createGame({ players: [{ relics: ['soldier_token'] }, {}] })).toThrow('"soldier_token" is not a relic');
    expect(() => createGame({ players: [{ relics: ['nope'] }, {}] })).toThrow('Unknown card definition "nope"');
    expect(() => createGame({ players: [{ battlefield: ['bell'] }, {}] })).toThrow('"bell" is not a permanent');
    expect(() => scenario({ players: [{ relics: ['forest'] }, {}] })).toThrow('"forest" is not a relic');
    expect(() => scenario({ players: [{ hand: ['bell'] }, {}] })).toThrow(`The relic "bell" can only be among a player's relics`);
  });

  it('Campana fúnebre: the opponent loses 1 life at the beginning of each of its owner’s upkeeps, through the stack', () => {
    let s = scenario({ activePlayer: 1, players: [{ relics: [{ card: 'bell', id: 'bell' }] }, {}] });
    s = passToStep(s, 'upkeep', 4);
    expect(s.activePlayer).toBe(0);
    expect(s.stack).toEqual([expect.objectContaining({ kind: 'trigger', controller: 0, source: 'bell', ability: 0 })]);
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    const triggered: GameEvent = { t: 'trigger', player: 0, card: 'bell', ability: 0, targets: [] };
    expect([describeEvent(s, triggered, 0), describeEvent(s, triggered, 1)]).toEqual(['Se dispara tu Campana fúnebre.', 'Se dispara Campana fúnebre del rival.']);
    s = resolveStack(s);
    expect([life(s, 0), life(s, 1), s.step]).toEqual([20, 19, 'upkeep']);
    s = passToStep(s, 'main1', 5);
    expect(life(s, 1)).toBe(19);
    s = passToStep(s, 'main1', 6);
    expect(life(s, 1)).toBe(18);
  });

  it('Grimorio prohibido: its owner draws a card and loses 1 life at each upkeep, before the draw step', () => {
    let s = scenario({ activePlayer: 1, players: [{ relics: [{ card: 'grimoire', id: 'grimoire' }] }, {}] });
    s = resolveStack(passToStep(s, 'upkeep', 4));
    expect([s.players[0].hand.length, life(s, 0), life(s, 1)]).toEqual([1, 19, 20]);
    s = passToStep(s, 'main1', 4);
    expect(s.players[0].hand.length).toBe(2);
  });

  it('Incensario de esporas: a Saproling for each instant or sorcery its owner casts, ahead of the spell, and none for a creature', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'ember_snap', id: 'snap' }, { card: 'ember_hound', id: 'hound' }],
          battlefield: ['mountain', 'mountain', 'mountain'],
          relics: [{ card: 'censer', id: 'censer' }],
        },
        {},
      ],
    });
    s = cast(s, 'snap', [{ player: 1 }]);
    expect(s.stack.map((item) => (item.kind === 'trigger' ? item.source : item.kind))).toEqual(['spell', 'censer']);
    s = resolveStack(s);
    expect([saprolings(s).length, life(s, 1)]).toEqual([1, 18]);
    s = resolveStack(cast(s, 'hound'));
    expect([zoneOf(s, 'hound'), saprolings(s).length]).toEqual(['battlefield', 1]);
  });

  it('Urna de almas: the opponent loses 1 life for each creature of its owner that dies, tokens included, and none for the opponent’s', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'ember_snap', id: 'snap1' }, { card: 'ember_snap', id: 'snap2' }],
          battlefield: ['mountain', 'mountain', { card: 'soldier_token', id: 'soldier' }],
          relics: [{ card: 'urn', id: 'urn' }],
        },
        { battlefield: [{ card: 'grove_tender', id: 'theirs' }] },
      ],
    });
    s = resolveStack(cast(s, 'snap1', [{ card: 'theirs' }]));
    expect([zoneOf(s, 'theirs'), life(s, 1)]).toEqual(['graveyard', 20]);
    s = resolveStack(cast(s, 'snap2', [{ card: 'soldier' }]));
    expect([zoneOf(s, 'soldier'), life(s, 1)]).toEqual(['gone', 19]);
  });

  it('Tambor de guerra: its owner’s creatures get +1/+0 until end of turn whenever a land of theirs enters', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'forest', id: 'land' }], battlefield: [{ card: 'grove_tender', id: 'elf' }], relics: [{ card: 'drum', id: 'drum' }] },
        { battlefield: [{ card: 'grove_tender', id: 'theirs' }] },
      ],
    });
    s = playLand(s, 'land');
    expect(s.stack).toEqual([expect.objectContaining({ kind: 'trigger', source: 'drum' })]);
    s = resolveStack(s);
    expect([getPower(s, 'elf'), getPower(s, 'theirs')]).toEqual([2, 1]);
    s = passToStep(s, 'main1', s.turn + 1);
    expect([getPower(s, 'elf'), s.stack]).toEqual([1, []]);
  });

  it('Cáliz del peregrino: its owner gains 1 life for each creature that enters under their control, tokens included', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'ember_hound', id: 'hound' }, { card: 'ember_snap', id: 'snap' }],
          battlefield: ['mountain', 'mountain', 'mountain'],
          relics: ['chalice', 'censer'],
        },
        { hand: ['grove_tender'] },
      ],
    });
    s = resolveStack(cast(s, 'hound'));
    expect(life(s, 0)).toBe(21);
    s = resolveStack(cast(s, 'snap', [{ player: 1 }]));
    expect([saprolings(s).length, life(s, 0)]).toEqual([1, 22]);
  });

  it('Libro de horas: its owner draws a card at an upkeep that finds their hand empty, and only then', () => {
    let s = scenario({ activePlayer: 1, players: [{ hand: ['mountain'], relics: [{ card: 'tome', id: 'tome' }] }, {}] });
    s = passToStep(s, 'main1', 4);
    expect(s.players[0].hand.length).toBe(2);
    s = scenario({ activePlayer: 1, players: [{ relics: [{ card: 'tome', id: 'tome' }] }, {}] });
    s = passToStep(s, 'upkeep', 4);
    expect(s.stack).toEqual([expect.objectContaining({ kind: 'trigger', source: 'tome' })]);
    s = passToStep(resolveStack(s), 'main1', 4);
    expect(s.players[0].hand.length).toBe(2);
  });

  it('Corona del tirano: its owner’s creatures get +1/+0 until end of turn at each of their upkeeps', () => {
    let s = scenario({
      activePlayer: 1,
      players: [{ battlefield: [{ card: 'grove_tender', id: 'elf' }], relics: [{ card: 'crown', id: 'crown' }] }, { battlefield: [{ card: 'grove_tender', id: 'theirs' }] }],
    });
    s = resolveStack(passToStep(s, 'upkeep', 4));
    expect([getPower(s, 'elf'), getPower(s, 'theirs')]).toEqual([2, 1]);
    s = passToStep(s, 'main1', 5);
    expect(getPower(s, 'elf')).toBe(1);
  });

  it('can never be targeted', () => {
    const s = scenario({
      players: [
        { hand: [{ card: 'grave_sentence', id: 'kill' }], battlefield: ['swamp', 'swamp', 'swamp', 'swamp'], relics: ['bell'] },
        { battlefield: [{ card: 'grove_tender', id: 'elf' }], relics: [{ card: 'urn', id: 'urn' }] },
      ],
    });
    const targets = getLegalActions(s).flatMap((action) => (action.type === 'cast' ? action.targets : []));
    expect(targets).toEqual([{ card: 'elf' }]);
    expect(tryApplyAction(s, { type: 'cast', player: 0, card: 'kill', targets: [{ card: 'urn' }] })).toEqual({
      ok: false,
      error: 'el objetivo 0 (urn) no es legal',
      refusal: { code: 'illegalTarget', index: 0, target: 'urn' },
    });
  });

  it('read like a permanent’s abilities, under the type «Reliquia»', () => {
    expect(RELIC_DEFS.map((def) => [def.id, typeLine(def), rulesText(def)])).toEqual([
      ['censer', 'Reliquia', ['Siempre que lances un hechizo de instantáneo o de conjuro, crea una ficha de criatura Saprolín verde 1/1.']],
      ['urn', 'Reliquia', ['Siempre que una criatura que controlas muera, cada oponente pierde 1 vida.']],
      ['drum', 'Reliquia', ['Aterrizaje — Siempre que una tierra que controlas entre, las criaturas que controlas obtienen +1/+0 hasta el final del turno.']],
      ['chalice', 'Reliquia', ['Siempre que una criatura que controlas entre, ganas 1 vida.']],
      ['tome', 'Reliquia', ['Al comienzo de tu mantenimiento, si no tienes cartas en la mano, roba una carta.']],
      ['bell', 'Reliquia', ['Al comienzo de tu mantenimiento, cada oponente pierde 1 vida.']],
      ['grimoire', 'Reliquia', ['Al comienzo de tu mantenimiento, roba una carta. Pierdes 1 vida.']],
      ['crown', 'Reliquia', ['Al comienzo de tu mantenimiento, las criaturas que controlas obtienen +1/+0 hasta el final del turno.']],
    ]);
    expect(cardSummary('bell')).toBe('Campana fúnebre · Reliquia · Al comienzo de tu mantenimiento, cada oponente pierde 1 vida.');
    const s = scenario({ players: [{ relics: [{ card: 'bell', id: 'bell' }] }, {}] });
    expect(describeState(s, 0)).toContain('  reliquias: Campana fúnebre(bell)');
  });

  it('refuse relics with anything but untargeted abilities that trigger on what a relic can see', () => {
    const upkeep: TriggeredAbility = { on: 'upkeep', targets: [], effects: [{ kind: 'gainLife', amount: 1 }] };
    const relic = (extra: Partial<CardDef>): CardDef => ({ id: 'bad_relic', name: 'Bad', types: ['relic'], triggers: [upkeep], ...extra });
    expect(() => registerCard(relic({ triggers: [] }))).toThrow(/needs a triggered ability/);
    expect(() => registerCard(relic({ cost: '{1}' }))).toThrow(/nothing but triggered abilities/);
    expect(() => registerCard(relic({ keywords: ['flying'] }))).toThrow(/nothing but triggered abilities/);
    expect(() => registerCard(relic({ types: ['relic', 'creature'], power: 1, toughness: 1 }))).toThrow(/no other type/);
    expect(() => registerCard(relic({ triggers: [{ ...upkeep, on: 'enters' }] }))).toThrow(/cannot trigger on "enters"/);
    expect(() =>
      registerCard(relic({ triggers: [{ on: 'upkeep', targets: [{ kind: 'any' }], effects: [{ kind: 'damage', amount: 1, to: 0 }] }] })),
    ).toThrow(/no targets/);
  });

  it('are kept beside their player by the invariants', () => {
    const s = scenario({ players: [{ relics: [{ card: 'bell', id: 'bell' }], battlefield: [{ card: 'forest', id: 'land' }] }, {}] });
    const moved = structuredClone(s);
    moved.players[0].command = [];
    moved.players[0].battlefield.push('bell');
    if (moved.cards.bell) moved.cards.bell.zone = 'battlefield';
    expect(checkInvariants(moved)).toContain('relic bell is outside the command zone');
    const crowded = structuredClone(s);
    crowded.players[0].battlefield = [];
    crowded.players[0].command.push('land');
    if (crowded.cards.land) crowded.cards.land.zone = 'command';
    expect(checkInvariants(crowded)).toContain('land is in p0.command but is not a relic');
  });

  it('play through whole AI games on both sides', () => {
    for (const seed of [1, 2, 3]) {
      let s = createGame({
        seed,
        players: [
          { deck: 'stormglass', relics: ['censer', 'chalice', 'drum', 'tome'] },
          { deck: 'gloamwood', relics: ['bell', 'grimoire', 'urn', 'crown'] },
        ],
      });
      for (let guard = 0; guard < 5000 && s.pending && s.pending.kind !== 'gameOver'; guard++) {
        s = applyAction(s, chooseAction(s, s.pending.player));
        expect(checkInvariants(s)).toEqual([]);
      }
      expect(s.pending?.kind).toBe('gameOver');
    }
  });
});
