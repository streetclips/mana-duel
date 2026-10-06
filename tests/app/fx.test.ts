import { describe, expect, it } from 'vitest';
import { chooseAction } from '../../src/ai';
import { fxCues, fxHoldMs, type FxCue } from '../../src/app/fx';
import { createGame, type Action, type GameState } from '../../src/engine';
import { act, attack, block, cast, pass, passTo, scenario } from '../helpers';

interface Step {
  state: GameState;
  cues: FxCue[];
}

function step(s: GameState, action: Action): Step {
  const next = act(s, action);
  return { state: next, cues: fxCues(s, next) };
}

function passCollecting(s: GameState, done: (state: GameState) => boolean): Step {
  let state = s;
  const cues: FxCue[] = [];
  for (let i = 0; i < 200 && !done(state); i++) {
    const pending = state.pending;
    if (!pending || pending.kind === 'gameOver') break;
    let action: Action;
    if (pending.kind === 'priority') action = { type: 'pass', player: pending.player };
    else if (pending.kind === 'declareAttackers')
      action = { type: 'declareAttackers', player: pending.player, attackers: [] };
    else if (pending.kind === 'declareBlockers')
      action = { type: 'declareBlockers', player: pending.player, blocks: [] };
    else throw new Error(`stuck at ${pending.kind}`);
    const next = step(state, action);
    cues.push(...next.cues);
    state = next.state;
  }
  if (!done(state)) throw new Error('the expected point was never reached');
  return { state, cues };
}

function passUntilTargets(s: GameState): GameState {
  return passCollecting(s, (state) => state.pending?.kind === 'chooseTargets').state;
}

const stackEmpty = (s: GameState): boolean => s.stack.length === 0;
const inMain2 = (s: GameState): boolean => s.step === 'main2' && s.pending?.kind === 'priority';

describe('fx cues: cards moving', () => {
  it('deals the opening hands card by card, then starts the first turn', () => {
    const s = createGame({ seed: 7, startingPlayer: 0, skipMulligans: true });
    const cues = fxCues(null, s);
    const draws = cues.filter((cue): cue is Extract<FxCue, { kind: 'draw' }> => cue.kind === 'draw');
    expect(draws).toHaveLength(14);
    expect(draws.slice(0, 7).every((cue) => cue.player === 0)).toBe(true);
    expect(draws.map((cue) => cue.card)).toEqual([...s.players[0].hand, ...s.players[1].hand]);
    expect(cues.at(-1)).toEqual({ kind: 'turn', player: 0, turn: 1 });
  });

  it('draws for the new turn and names the player whose turn begins', () => {
    const s = scenario({ players: [{}, { library: [{ card: 'forest', id: 'top' }, 'forest'] }] });
    const { cues } = passCollecting(s, (state) => state.activePlayer === 1 && state.step === 'main1');
    expect(cues).toEqual([
      { kind: 'turn', player: 1, turn: 4 },
      { kind: 'draw', player: 1, card: 'top' },
    ]);
  });

  it('shows the opponent playing a land and casting a spell, with its targets', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        {},
        {
          hand: [
            { card: 'mountain', id: 'land' },
            { card: 'ember_snap', id: 'snap' },
          ],
        },
      ],
    });
    const land = step(s, { type: 'playLand', player: 1, card: 'land' });
    expect(land.cues).toEqual([
      { kind: 'enter', player: 1, card: 'land' },
      { kind: 'play', player: 1, card: 'land', via: 'land', targets: [] },
    ]);
    s = land.state;
    const spell = step(s, { type: 'cast', player: 1, card: 'snap', targets: [{ player: 0 }] });
    expect(spell.cues).toEqual([{ kind: 'play', player: 1, card: 'snap', via: 'cast', targets: [{ player: 0 }] }]);
    const resolved = passCollecting(spell.state, stackEmpty);
    expect(resolved.cues).toEqual([{ kind: 'life', player: 0, delta: -2 }]);
  });

  it('shows a creature spell entering when it resolves', () => {
    const s = scenario({
      players: [{ hand: [{ card: 'ember_hound', id: 'hound' }], battlefield: ['mountain', 'mountain'] }, {}],
    });
    const resolved = passCollecting(cast(s, 'hound'), stackEmpty);
    expect(resolved.cues).toEqual([{ kind: 'enter', player: 0, card: 'hound' }]);
  });

  it('shows the cards discarded at cleanup', () => {
    let s = scenario({
      step: 'main2',
      players: [{ hand: Array.from({ length: 8 }, (_, i) => ({ card: 'forest', id: `f${i}` })), landsPlayed: 1 }, {}],
    });
    s = passTo(s, 'discard');
    const discarded = step(s, { type: 'discard', player: 0, cards: ['f3'] });
    expect(discarded.cues[0]).toEqual({ kind: 'discard', player: 0, card: 'f3' });
  });
});

describe('fx cues: combat', () => {
  it('lets an attacker and its blocker strike each other, then shows the damage and the death', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
        {
          battlefield: [
            { card: 'ember_hound', id: 'left' },
            { card: 'canopy_spider', id: 'spider' },
            { card: 'ember_hound', id: 'right' },
          ],
        },
      ],
    });
    const attacked = step(passTo(s, 'declareAttackers'), { type: 'declareAttackers', player: 0, attackers: ['rhino'] });
    expect(attacked.cues).toEqual([{ kind: 'attack', player: 0, card: 'rhino' }]);
    const blocked = step(passTo(attacked.state, 'declareBlockers'), {
      type: 'declareBlockers',
      player: 1,
      blocks: [{ blocker: 'spider', attacker: 'rhino' }],
    });
    expect(blocked.cues).toEqual([{ kind: 'block', player: 1, card: 'spider', attacker: 'rhino' }]);
    s = blocked.state;
    const combat = passCollecting(s, inMain2);
    expect(combat.cues).toEqual([
      { kind: 'strike', card: 'rhino', target: { card: 'spider' } },
      { kind: 'damage', card: 'spider', amount: 3 },
      { kind: 'strike', card: 'rhino', target: { player: 1 } },
      { kind: 'life', player: 1, delta: -1 },
      { kind: 'strike', card: 'spider', target: { card: 'rhino' } },
      { kind: 'damage', card: 'rhino', amount: 1 },
      { kind: 'dies', player: 1, card: 'spider', next: 'right' },
    ]);
  });

  it('shows an unblocked attacker striking the player', () => {
    const s = attack(scenario({ players: [{ battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] }, {}] }), [
      'rhino',
    ]);
    const combat = passCollecting(s, inMain2);
    expect(combat.cues).toEqual([
      { kind: 'strike', card: 'rhino', target: { player: 1 } },
      { kind: 'life', player: 1, delta: -4 },
    ]);
  });

  it('adds up double strike into one strike and one life change', () => {
    const s = attack(scenario({ players: [{ battlefield: [{ card: 'sunblade_paladin', id: 'paladin' }] }, {}] }), [
      'paladin',
    ]);
    const combat = passCollecting(s, inMain2);
    expect(combat.cues).toEqual([
      { kind: 'strike', card: 'paladin', target: { player: 1 } },
      { kind: 'life', player: 1, delta: -4 },
    ]);
  });

  it('shows lifelink as a gain for the attacker and a loss for the defender', () => {
    const s = attack(scenario({ players: [{ battlefield: [{ card: 'dawn_acolyte', id: 'acolyte' }] }, {}] }), [
      'acolyte',
    ]);
    const combat = passCollecting(s, inMain2);
    expect(combat.cues.filter((cue) => cue.kind === 'life')).toEqual([
      { kind: 'life', player: 1, delta: -1 },
      { kind: 'life', player: 0, delta: 1 },
    ]);
  });

  it('places each dead creature before the next one that survived', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
        {
          battlefield: [
            { card: 'ember_hound', id: 'a' },
            { card: 'grove_tender', id: 'b' },
            { card: 'mist_sprite', id: 'c' },
            { card: 'canopy_spider', id: 'd' },
          ],
        },
      ],
    });
    s = attack(s, ['rhino']);
    s = block(s, [
      { blocker: 'b', attacker: 'rhino' },
      { blocker: 'c', attacker: 'rhino' },
    ]);
    const deaths = passCollecting(s, inMain2).cues.filter((cue) => cue.kind === 'dies');
    expect(deaths).toEqual([
      { kind: 'dies', player: 1, card: 'b', next: 'd' },
      { kind: 'dies', player: 1, card: 'c', next: 'd' },
    ]);
  });
});

describe('fx cues: spells and abilities', () => {
  it('shows burn hitting a creature without a strike', () => {
    const s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
        { battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      ],
    });
    const resolved = passCollecting(cast(s, 'snap', [{ card: 'elf' }]), stackEmpty);
    expect(resolved.cues).toEqual([
      { kind: 'damage', card: 'elf', amount: 2 },
      { kind: 'dies', player: 1, card: 'elf', next: null },
    ]);
  });

  it('lets two creatures that fight strike each other', () => {
    const s = scenario({
      players: [
        {
          hand: [{ card: 'feral_clash', id: 'clash' }],
          battlefield: ['forest', 'forest', { card: 'timberland_rhino', id: 'rhino' }],
        },
        { battlefield: [{ card: 'cinder_adept', id: 'adept' }] },
      ],
    });
    const resolved = passCollecting(cast(s, 'clash', [{ card: 'rhino' }, { card: 'adept' }]), stackEmpty);
    expect(resolved.cues).toEqual([
      { kind: 'strike', card: 'rhino', target: { card: 'adept' } },
      { kind: 'damage', card: 'adept', amount: 4 },
      { kind: 'strike', card: 'adept', target: { card: 'rhino' } },
      { kind: 'damage', card: 'rhino', amount: 2 },
      { kind: 'dies', player: 1, card: 'adept', next: null },
    ]);
  });

  it('lets a creature that bites strike its target, which does not strike back', () => {
    const s = scenario({
      players: [
        {
          hand: [{ card: 'snapjaw_strike', id: 'strike' }],
          battlefield: ['forest', 'forest', { card: 'mossfin_lurker', id: 'lurker' }],
        },
        { battlefield: [{ card: 'cinder_adept', id: 'adept' }] },
      ],
    });
    const resolved = passCollecting(cast(s, 'strike', [{ card: 'lurker' }, { card: 'adept' }]), stackEmpty);
    expect(resolved.cues).toEqual([
      { kind: 'strike', card: 'lurker', target: { card: 'adept' } },
      { kind: 'damage', card: 'adept', amount: 3 },
      { kind: 'dies', player: 1, card: 'adept', next: null },
    ]);
  });

  it('shows a triggered ability and its damage, but no strike for a creature that only pings', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'cinder_adept', id: 'adept' }], battlefield: ['mountain', 'mountain', 'mountain'] },
        { battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      ],
    });
    s = passUntilTargets(cast(s, 'adept'));
    const chosen = step(s, { type: 'chooseTargets', player: 0, targets: [{ card: 'elf' }] });
    expect(chosen.cues).toEqual([{ kind: 'ability', player: 0, card: 'adept' }]);
    const resolved = passCollecting(chosen.state, stackEmpty);
    expect(resolved.cues).toEqual([
      { kind: 'damage', card: 'elf', amount: 1 },
      { kind: 'dies', player: 1, card: 'elf', next: null },
    ]);
  });

  it('shows each activation of an ability and each pump as it resolves', () => {
    let s = scenario({
      players: [{ battlefield: [{ card: 'crag_dragon', id: 'dragon' }, 'mountain', 'mountain'] }, {}],
    });
    const activated = step(s, { type: 'activate', player: 0, card: 'dragon', ability: 0, targets: [] });
    expect(activated.cues).toEqual([{ kind: 'ability', player: 0, card: 'dragon' }]);
    s = step(activated.state, { type: 'activate', player: 0, card: 'dragon', ability: 0, targets: [] }).state;
    expect(passCollecting(s, stackEmpty).cues).toEqual([
      { kind: 'pump', card: 'dragon', power: 1, toughness: 0 },
      { kind: 'pump', card: 'dragon', power: 1, toughness: 0 },
    ]);
  });

  it('shows a blessing as a pump and a life gain', () => {
    const s = scenario({
      players: [
        {
          hand: [{ card: 'radiant_blessing', id: 'blessing' }],
          battlefield: ['plains', { card: 'beacon_squire', id: 'squire' }],
        },
        {},
      ],
    });
    expect(passCollecting(cast(s, 'blessing', [{ card: 'squire' }]), stackEmpty).cues).toEqual([
      { kind: 'pump', card: 'squire', power: 2, toughness: 2 },
      { kind: 'life', player: 0, delta: 2 },
    ]);
  });

  it('shows +1/+1 counters as a pump, and a team pump on every creature it reaches', () => {
    const blossom = scenario({
      players: [
        {
          hand: [{ card: 'wild_blossom', id: 'blossom' }],
          battlefield: ['forest', 'forest', { card: 'test_bear', id: 'bear' }],
        },
        {},
      ],
    });
    expect(passCollecting(cast(blossom, 'blossom', [{ card: 'bear' }]), stackEmpty).cues).toEqual([
      { kind: 'pump', card: 'bear', power: 2, toughness: 2 },
    ]);
    const rally = scenario({
      players: [
        {
          hand: [{ card: 'rally_the_meadow', id: 'rally' }],
          battlefield: ['plains', 'plains', { card: 'test_bear', id: 'bear' }, { card: 'warren_hare', id: 'hare' }],
        },
        { battlefield: ['ember_hound'] },
      ],
    });
    expect(passCollecting(cast(rally, 'rally'), stackEmpty).cues).toEqual([
      { kind: 'pump', card: 'bear', power: 1, toughness: 1 },
      { kind: 'pump', card: 'hare', power: 1, toughness: 1 },
    ]);
  });

  it('shows a "whenever you cast" trigger as an ability before the spell resolves', () => {
    const s = scenario({
      players: [
        {
          hand: [{ card: 'static_jolt', id: 'jolt' }],
          battlefield: ['mountain', { card: 'stormglass_drake', id: 'drake' }],
        },
        {},
      ],
    });
    const played = step(s, { type: 'cast', player: 0, card: 'jolt', targets: [{ player: 1 }] });
    expect(played.cues).toEqual([
      { kind: 'play', player: 0, card: 'jolt', via: 'cast', targets: [{ player: 1 }] },
      { kind: 'ability', player: 0, card: 'drake' },
    ]);
    expect(passCollecting(played.state, stackEmpty).cues).toEqual([
      { kind: 'pump', card: 'drake', power: 1, toughness: 1 },
      { kind: 'life', player: 1, delta: -1 },
      { kind: 'draw', player: 0, card: s.players[0].library[0] },
    ]);
  });

  it('shows a shrink that kills as a pump followed by a death', () => {
    const s = scenario({
      players: [
        { hand: [{ card: 'withering_touch', id: 'touch' }], battlefield: ['swamp'] },
        { battlefield: [{ card: 'cinder_adept', id: 'adept' }] },
      ],
    });
    expect(passCollecting(cast(s, 'touch', [{ card: 'adept' }]), stackEmpty).cues).toEqual([
      { kind: 'pump', card: 'adept', power: -2, toughness: -2 },
      { kind: 'dies', player: 1, card: 'adept', next: null },
    ]);
  });

  it('shows a countered spell', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'turn_the_tide', id: 'tide' }], battlefield: ['island', 'island', 'island'] },
        { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
      ],
    });
    s = pass(cast(s, 'rhino'));
    s = cast(s, 'tide', [{ card: 'rhino' }]);
    expect(passCollecting(s, stackEmpty).cues).toEqual([{ kind: 'counter', player: 1, card: 'rhino' }]);
  });

  it('shows a spell that fizzles', () => {
    let s = scenario({
      players: [
        {
          hand: [
            { card: 'ember_snap', id: 's1' },
            { card: 'ember_snap', id: 's2' },
          ],
          battlefield: ['mountain', 'mountain'],
        },
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
      ],
    });
    s = cast(cast(s, 's1', [{ card: 'hound' }]), 's2', [{ card: 'hound' }]);
    const cues = passCollecting(s, stackEmpty).cues;
    expect(cues).toContainEqual({ kind: 'fizzle', player: 0, card: 's1' });
  });

  it('shows a creature returned to its owner’s hand from its place on the battlefield', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'undertow', id: 'undertow' }], battlefield: ['island', 'island'] },
        {
          battlefield: [
            { card: 'timberland_rhino', id: 'rhino' },
            { card: 'ember_hound', id: 'hound' },
          ],
        },
      ],
    });
    s = pass(s);
    s = cast(s, 'undertow', [{ card: 'rhino' }]);
    expect(passCollecting(s, stackEmpty).cues).toEqual([{ kind: 'bounce', player: 1, card: 'rhino', next: 'hound' }]);
  });
});

describe('fx cues: tokens, keyword grants, undying and discards', () => {
  it('shows tokens entering like any other creature', () => {
    const s = scenario({
      players: [{ hand: [{ card: 'raise_the_banners', id: 'banners' }], battlefield: ['plains', 'plains'] }, {}],
    });
    const { state, cues } = passCollecting(cast(s, 'banners'), stackEmpty);
    const tokens = state.players[0].battlefield.filter((id) => state.cards[id]?.def === 'soldier_token');
    expect(tokens).toHaveLength(2);
    expect(cues).toEqual(tokens.map((card) => ({ kind: 'enter', player: 0, card })));
  });

  it('shows a land that an effect fetches from the library entering after its creature', () => {
    const s = scenario({
      players: [
        {
          hand: [{ card: 'trail_scout', id: 'scout' }],
          battlefield: ['forest', 'forest'],
          library: [{ card: 'forest', id: 'found' }, 'mountain'],
        },
        {},
      ],
    });
    expect(passCollecting(cast(s, 'scout'), stackEmpty).cues).toEqual([
      { kind: 'enter', player: 0, card: 'scout' },
      { kind: 'ability', player: 0, card: 'scout' },
      { kind: 'enter', player: 0, card: 'found' },
    ]);
  });

  it('carries the keywords a pump grants', () => {
    const s = scenario({
      players: [
        {
          hand: [{ card: 'charge_of_the_forge', id: 'charge' }],
          battlefield: ['mountain', 'plains', { card: 'test_bear', id: 'bear' }],
        },
        {},
      ],
    });
    expect(passCollecting(cast(s, 'charge'), stackEmpty).cues).toEqual([
      { kind: 'pump', card: 'bear', power: 1, toughness: 0, keywords: ['firstStrike'] },
    ]);
  });

  it('shows an undying creature dying, then coming back with its counter', () => {
    const s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
        { battlefield: [{ card: 'gravebloom_sprout', id: 'sprout' }] },
      ],
    });
    expect(passCollecting(cast(s, 'snap', [{ card: 'sprout' }]), stackEmpty).cues).toEqual([
      { kind: 'damage', card: 'sprout', amount: 2 },
      { kind: 'dies', player: 1, card: 'sprout', next: null },
      { kind: 'ability', player: 1, card: 'sprout' },
      { kind: 'enter', player: 1, card: 'sprout' },
      { kind: 'pump', card: 'sprout', power: 1, toughness: 1 },
    ]);
  });

  it('shows the card an effect makes a player discard', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'memory_leech', id: 'leech' }], battlefield: ['swamp', 'swamp', 'swamp'] },
        { hand: [{ card: 'ember_snap', id: 'snap' }] },
      ],
    });
    s = passTo(cast(s, 'leech'), 'discard');
    expect(step(s, { type: 'discard', player: 1, cards: ['snap'] }).cues).toEqual([
      { kind: 'discard', player: 1, card: 'snap' },
    ]);
  });
});

describe('fx holds', () => {
  const cast1: FxCue = { kind: 'play', player: 1, card: 'snap', via: 'cast', targets: [] };
  const cast0: FxCue = { kind: 'play', player: 0, card: 'snap', via: 'cast', targets: [] };

  it('wait longest for the opponent’s plays, combat and deaths', () => {
    expect(fxHoldMs([cast1], 0, false)).toBe(900);
    expect(
      fxHoldMs(
        [
          { kind: 'strike', card: 'a', target: { player: 1 } },
          { kind: 'life', player: 1, delta: -2 },
        ],
        0,
        false,
      ),
    ).toBe(650);
    expect(fxHoldMs([{ kind: 'draw', player: 0, card: 'c1' }], 0, false)).toBe(0);
  });

  it('do not wait for your own plays unless you are watching the AI play both seats', () => {
    expect(fxHoldMs([cast0], 0, false)).toBe(0);
    expect(fxHoldMs([cast0], 0, true)).toBe(900);
  });
});

describe('fx cues in a whole game', () => {
  it('follow an AI game to its end', () => {
    const seen = new Set<string>();
    let s = createGame({ seed: 12, players: [{ deck: 'duskmire' }, { deck: 'dawntide' }] });
    for (const cue of fxCues(null, s)) seen.add(cue.kind);
    for (let i = 0; i < 3000 && s.pending && s.pending.kind !== 'gameOver'; i++) {
      const next = act(s, chooseAction(s, s.pending.player));
      for (const cue of fxCues(s, next)) seen.add(cue.kind);
      s = next;
    }
    expect(s.pending?.kind).toBe('gameOver');
    expect([...seen]).toEqual(
      expect.arrayContaining(['draw', 'play', 'enter', 'attack', 'strike', 'life', 'dies', 'turn']),
    );
  });
});
