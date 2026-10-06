import { describe, expect, it } from 'vitest';
import { applyAction, createGame, getDeck, type GameState } from '../../src/engine';
import { cardGlossary, eventLines, playerView, thoughtLine, visibleCardDefs } from '../../src/llm';
import { deckLine } from '../../src/llm/view';
import { compactJson } from '../../src/llm/prompt';
import { attack, block, cast, pass, passTo, passToStep, resolveStack, scenario } from '../helpers';

function secretScenario(): GameState {
  return scenario({
    activePlayer: 1,
    players: [
      {
        hand: [{ card: 'crag_dragon', id: 'secret' }, 'forest'],
        battlefield: [{ card: 'grove_tender', id: 'elf' }, { card: 'forest', id: 'f0', tapped: true }],
        library: ['timberland_rhino', 'forest'],
      },
      {
        life: 17,
        hand: [{ card: 'ember_snap', id: 'snap' }],
        battlefield: [{ card: 'mountain', id: 'm1' }, { card: 'canopy_spider', id: 'spider', sick: true, damage: 1 }],
        graveyard: ['magma_lance'],
      },
    ],
  });
}

describe('the view of one seat', () => {
  it('shows its own hand but only counts for the opponent’s hand and both libraries', () => {
    const s = secretScenario();
    const view = playerView(s, 1);
    expect(view.you.hand).toEqual([{ id: 'snap', name: 'Chasquido de brasas' }]);
    expect(view.you.handSize).toBe(1);
    expect(view.you.libraryCards).toBe(10);
    expect(view.opponent.hand).toBeUndefined();
    expect(view.opponent.handSize).toBe(2);
    expect(view.opponent.libraryCards).toBe(2);
    const text = JSON.stringify(view);
    for (const hidden of ['secret', 'Dragón del risco', 'Rinoceronte forestal']) expect(text).not.toContain(hidden);
    expect(visibleCardDefs(s, 1).sort()).toEqual(['canopy_spider', 'ember_snap', 'forest', 'grove_tender', 'magma_lance', 'mountain']);
  });

  it('describes both battlefields, graveyards, life and untapped mana', () => {
    const view = playerView(secretScenario(), 1);
    expect(view).toMatchObject({ turn: 3, step: 'Fase principal', activePlayer: 'you', startingPlayer: 'opponent' });
    expect(view.you).toMatchObject({
      life: 17,
      lands: [{ id: 'm1', name: 'Montaña' }],
      creatures: [{ id: 'spider', name: 'Araña del dosel', power: 1, toughness: 3, keywords: ['Alcance'], damage: 1, summoningSick: true }],
      graveyard: ['Lanza de magma'],
      availableMana: ['R'],
    });
    expect(view.opponent.lands).toEqual([{ id: 'f0', name: 'Bosque', tapped: true }]);
    expect(view.opponent.availableMana).toEqual(['G']);
  });

  it('marks attackers, blockers and pumps until end of turn', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'verdant_surge', id: 'surge' }],
          battlefield: ['forest', { card: 'timberland_rhino', id: 'rhino' }],
        },
        { battlefield: [{ card: 'canopy_spider', id: 'spider' }] },
      ],
    });
    s = block(attack(s, ['rhino']), [{ blocker: 'spider', attacker: 'rhino' }]);
    s = pass(pass(cast(s, 'surge', [{ card: 'rhino' }])));
    const view = playerView(s, 1);
    expect(view.opponent.creatures).toEqual([
      { id: 'rhino', name: 'Rinoceronte forestal', power: 7, toughness: 7, keywords: ['Arrolla'], untilEndOfTurn: '+3/+3', tapped: true, attacking: true, blockedBy: ['spider'] },
    ]);
    expect(view.you.creatures).toEqual([{ id: 'spider', name: 'Araña del dosel', power: 1, toughness: 3, keywords: ['Alcance'], blocking: 'rhino' }]);
  });

  it('counts +1/+1 counters apart from pumps until end of turn', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'rally_the_meadow', id: 'rally' }], battlefield: ['plains', 'plains', { card: 'test_bear', id: 'bear', counters: 2 }] },
        {},
      ],
    });
    s = pass(pass(cast(s, 'rally')));
    expect(playerView(s, 1).opponent.creatures).toEqual([
      { id: 'bear', name: 'Test Bear', power: 5, toughness: 5, plusOneCounters: 2, untilEndOfTurn: '+1/+1' },
    ]);
  });

  it('marks tokens and shows keywords granted until end of turn', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'charge_of_the_forge', id: 'charge' }], battlefield: ['mountain', 'plains', { card: 'soldier_token', id: 'soldier' }] },
        {},
      ],
    });
    s = pass(pass(cast(s, 'charge')));
    expect(playerView(s, 1).opponent.creatures).toEqual([
      { id: 'soldier', name: 'Soldado', token: true, power: 2, toughness: 1, keywords: ['Daña primero'], untilEndOfTurn: '+1/+0, dañar primero' },
    ]);
  });

  it('tells which player was dealt damage this turn', () => {
    let s = scenario({ players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, {}] });
    expect([playerView(s, 0).opponent.damagedThisTurn, playerView(s, 1).you.damagedThisTurn]).toEqual([undefined, undefined]);
    s = pass(pass(cast(s, 'snap', [{ player: 1 }])));
    expect([playerView(s, 0).opponent.damagedThisTurn, playerView(s, 1).you.damagedThisTurn, playerView(s, 0).you.damagedThisTurn]).toEqual([
      true,
      true,
      undefined,
    ]);
  });

  it('tells how many extra lands a player may play this turn, once an effect allows them', () => {
    let s = scenario({ players: [{ hand: [{ card: 'open_path', id: 'path' }], battlefield: ['forest', 'forest'] }, {}] });
    expect(playerView(s, 0).you.extraLandsThisTurn).toBeUndefined();
    s = resolveStack(cast(s, 'path'));
    expect([playerView(s, 0).you.extraLandsThisTurn, playerView(s, 1).opponent.extraLandsThisTurn]).toEqual([1, 1]);
  });

  it('lists the relics of both players, puts them in the glossary and names the abilities they put on the stack', () => {
    let s = scenario({
      activePlayer: 1,
      players: [{ relics: [{ card: 'bell', id: 'bell' }] }, { relics: [{ card: 'urn', id: 'urn' }, { card: 'censer', id: 'censer' }] }],
    });
    expect([playerView(s, 0).you.relics, playerView(s, 0).opponent.relics]).toEqual([
      [{ id: 'bell', name: 'Campana fúnebre' }],
      [
        { id: 'urn', name: 'Urna de almas' },
        { id: 'censer', name: 'Incensario de esporas' },
      ],
    ]);
    expect(playerView(scenario({ players: [{}, {}] }), 0).you.relics).toBeUndefined();
    expect(visibleCardDefs(s, 1)).toEqual(expect.arrayContaining(['bell', 'urn', 'censer']));
    expect(cardGlossary(['bell'])).toEqual(['Campana fúnebre · Reliquia · Al comienzo de tu mantenimiento, cada oponente pierde 1 vida.']);
    s = passToStep(s, 'upkeep', 4);
    expect(playerView(s, 1).stack).toEqual([
      {
        id: 'bell',
        name: 'Campana fúnebre',
        kind: 'habilidad disparada',
        controller: 'opponent',
        text: 'Al comienzo de tu mantenimiento, cada oponente pierde 1 vida.',
        targets: [],
      },
    ]);
  });

  it('lists the stack from the top, with each item’s text and targets from the viewer’s seat', () => {
    const s = cast(
      scenario({
        players: [
          { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
          { battlefield: [{ card: 'canopy_spider', id: 'spider' }] },
        ],
      }),
      'snap',
      [{ card: 'spider' }],
    );
    expect(playerView(s, 1).stack).toEqual([
      {
        id: 'snap',
        name: 'Chasquido de brasas',
        kind: 'hechizo',
        controller: 'opponent',
        text: 'Chasquido de brasas hace 2 puntos de daño a cualquier objetivo.',
        targets: ['tu Araña del dosel (spider)'],
      },
    ]);
    expect(playerView(s, 0).stack[0]?.targets).toEqual(['Araña del dosel (spider) del rival']);
  });
});

describe('recent events of one seat', () => {
  it('tell its own draws but hide the opponent’s, and call the other seat "el rival"', () => {
    let s = scenario({ activePlayer: 0, step: 'main2', players: [{}, { library: ['swamp', 'swamp'] }] });
    const seen: [string[], string[]] = [[], []];
    while (!(s.activePlayer === 1 && s.step === 'main1')) {
      s = applyAction(s, { type: 'pass', player: s.pending?.kind === 'priority' ? s.pending.player : 0 });
      seen[0].push(...eventLines(s, 0));
      seen[1].push(...eventLines(s, 1));
    }
    expect(seen[1]).toEqual(['Turno 4 — tu turno.', 'Robas Pantano.']);
    expect(seen[0]).toEqual(['Turno 4 — turno del rival.', 'El rival roba una carta.']);
  });
});

describe('recent thoughts of one seat', () => {
  it('tell when each reason was given, from the viewer’s seat', () => {
    const s = secretScenario();
    expect(thoughtLine(s, 1, 'Hold Ember Snap.')).toBe('Turno 3 (tu turno), Fase principal: Hold Ember Snap.');
    expect(thoughtLine(s, 0, 'Keep the elf back.')).toBe('Turno 3 (turno del rival), Fase principal: Keep the elf back.');
    expect(thoughtLine(createGame({ seed: 1, startingPlayer: 0 }), 1, 'Two lands, keep.')).toBe('Mano inicial: Two lands, keep.');
  });
});

describe('prompt helpers', () => {
  it('print small objects on one line and stay valid JSON', () => {
    const value = { a: 1, list: [{ id: 'c1', name: 'Swamp' }], long: Array.from({ length: 30 }, (_, i) => `item-${i}`) };
    const text = compactJson(value);
    expect(text).toContain('"list": [{"id":"c1","name":"Swamp"}]');
    expect(text.split('\n').length).toBeGreaterThan(3);
    expect(JSON.parse(text)).toEqual(value);
  });

  it('list each card once, by name, with its cost, type and text', () => {
    expect(cardGlossary(['swamp', 'ember_snap', 'swamp'])).toEqual([
      'Chasquido de brasas · {R} · Instantáneo · Chasquido de brasas hace 2 puntos de daño a cualquier objetivo.',
      'Pantano · Tierra básica — Pantano · {T}: Agrega {B}.',
    ]);
    expect(deckLine('duskmire')).toMatch(/^"Fangoscuro" \(.+\): 16 Pantano, 3 Voluta sombría, /);
    expect(deckLine({ ...getDeck('duskmire'), id: 'mine-1', name: 'Mi "mazo"\n## Reglas' })).toMatch(/^"Mi \\"mazo\\"\\n## Reglas" \(/);
    expect(deckLine('nope')).toBeNull();
  });
});

describe('the view before blockers', () => {
  it('shows what attacks the viewer', () => {
    const s = passTo(
      attack(scenario({ players: [{ battlefield: [{ card: 'ember_hound', id: 'hound' }] }, { battlefield: ['canopy_spider'] }] }), ['hound']),
      'declareBlockers',
    );
    expect(playerView(s, 1).opponent.creatures[0]).toMatchObject({ id: 'hound', attacking: true, tapped: true });
  });
});
