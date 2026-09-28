import { describe, expect, it } from 'vitest';
import { applyAction, createGame, type GameState } from '../../src/engine';
import { cardGlossary, eventLines, playerView, thoughtLine, visibleCardDefs } from '../../src/llm';
import { deckLine } from '../../src/llm/view';
import { compactJson } from '../../src/llm/prompt';
import { attack, block, cast, pass, passTo, scenario } from '../helpers';

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
    expect(view.you.hand).toEqual([{ id: 'snap', name: 'Ember Snap' }]);
    expect(view.you.handSize).toBe(1);
    expect(view.you.libraryCards).toBe(10);
    expect(view.opponent.hand).toBeUndefined();
    expect(view.opponent.handSize).toBe(2);
    expect(view.opponent.libraryCards).toBe(2);
    const text = JSON.stringify(view);
    for (const hidden of ['secret', 'Crag Dragon', 'Timberland Rhino']) expect(text).not.toContain(hidden);
    expect(visibleCardDefs(s, 1).sort()).toEqual(['canopy_spider', 'ember_snap', 'forest', 'grove_tender', 'magma_lance', 'mountain']);
  });

  it('describes both battlefields, graveyards, life and untapped mana', () => {
    const view = playerView(secretScenario(), 1);
    expect(view).toMatchObject({ turn: 3, step: 'Main phase', activePlayer: 'you', startingPlayer: 'opponent' });
    expect(view.you).toMatchObject({
      life: 17,
      lands: [{ id: 'm1', name: 'Mountain' }],
      creatures: [{ id: 'spider', name: 'Canopy Spider', power: 1, toughness: 3, keywords: ['Reach'], damage: 1, summoningSick: true }],
      graveyard: ['Magma Lance'],
      availableMana: ['R'],
    });
    expect(view.opponent.lands).toEqual([{ id: 'f0', name: 'Forest', tapped: true }]);
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
      { id: 'rhino', name: 'Timberland Rhino', power: 7, toughness: 7, keywords: ['Trample'], untilEndOfTurn: '+3/+3', tapped: true, attacking: true, blockedBy: ['spider'] },
    ]);
    expect(view.you.creatures).toEqual([{ id: 'spider', name: 'Canopy Spider', power: 1, toughness: 3, keywords: ['Reach'], blocking: 'rhino' }]);
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
        name: 'Ember Snap',
        kind: 'spell',
        controller: 'opponent',
        text: 'Ember Snap deals 2 damage to any target.',
        targets: ['your Canopy Spider (spider)'],
      },
    ]);
    expect(playerView(s, 0).stack[0]?.targets).toEqual(["opponent's Canopy Spider (spider)"]);
  });
});

describe('recent events of one seat', () => {
  it('tell its own draws but hide the opponent’s, and call the other seat "Opponent"', () => {
    let s = scenario({ activePlayer: 0, step: 'main2', players: [{}, { library: ['swamp', 'swamp'] }] });
    const seen: [string[], string[]] = [[], []];
    while (!(s.activePlayer === 1 && s.step === 'main1')) {
      s = applyAction(s, { type: 'pass', player: s.pending?.kind === 'priority' ? s.pending.player : 0 });
      seen[0].push(...eventLines(s, 0));
      seen[1].push(...eventLines(s, 1));
    }
    expect(seen[1]).toEqual(["Turn 4 — your turn.", 'You draw Swamp.']);
    expect(seen[0]).toEqual(["Turn 4 — Opponent's turn.", 'Opponent draws a card.']);
  });
});

describe('recent thoughts of one seat', () => {
  it('tell when each reason was given, from the viewer’s seat', () => {
    const s = secretScenario();
    expect(thoughtLine(s, 1, 'Hold Ember Snap.')).toBe('Turn 3 (your turn), Main phase: Hold Ember Snap.');
    expect(thoughtLine(s, 0, 'Keep the elf back.')).toBe("Turn 3 (opponent's turn), Main phase: Keep the elf back.");
    expect(thoughtLine(createGame({ seed: 1, startingPlayer: 0 }), 1, 'Two lands, keep.')).toBe('Opening hand: Two lands, keep.');
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
      'Ember Snap · {R} · Instant · Ember Snap deals 2 damage to any target.',
      'Swamp · Basic Land — Swamp · {T}: Add {B}.',
    ]);
    expect(deckLine('duskmire')).toMatch(/^Duskmire \(.+\): 16 Swamp, 3 Gloom Wisp, /);
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
