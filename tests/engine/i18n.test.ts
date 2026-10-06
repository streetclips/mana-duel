import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chooseAction } from '../../src/ai';
import {
  DECK_LIST,
  EMBERWILD,
  EVOLVE_TRIGGER,
  PROWESS_TRIGGER,
  RELIC_DEFS,
  UNDYING_TRIGGER,
  activatedText,
  allCardDefs,
  applyAction,
  cardSummary,
  createGame,
  describeEvent,
  describeState,
  getCardDef,
  getDeck,
  localizeDeck,
  refusalText,
  resolveDeck,
  rulesText,
  triggerText,
  tryApplyAction,
  typeLine,
  type DeckDef,
  type GameState,
  type PlayerId,
  type Refusal,
} from '../../src/engine';
import { CORE_CARDS } from '../../src/engine/cards';
import { CARD_TEXT_EN } from '../../src/engine/text/cards.en';
import { DECK_TEXT_EN } from '../../src/engine/text/decks.en';
import { setLocale, withLocale } from '../../src/i18n';
import { spanishIn } from '../i18n';
import { playLand, scenario } from '../helpers';

const SOURCE_DEFS = [...CORE_CARDS, ...RELIC_DEFS];

describe('English card and deck text', () => {
  it('translates every card, token and relic: name, subtypes and flavor', () => {
    expect(Object.keys(CARD_TEXT_EN).sort()).toEqual(SOURCE_DEFS.map((def) => def.id).sort());
    for (const def of SOURCE_DEFS) {
      const text = CARD_TEXT_EN[def.id];
      expect(text?.name, def.id).toBeTruthy();
      expect(text?.subtypes?.length ?? 0, def.id).toBe(def.subtypes?.length ?? 0);
      expect(text?.flavor !== undefined, def.id).toBe(def.flavor !== undefined);
      expect(spanishIn([text?.name, ...(text?.subtypes ?? []), text?.flavor ?? ''].join(' ')), def.id).toEqual([]);
    }
    const names = Object.values(CARD_TEXT_EN).map((text) => text.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('translates every deck', () => {
    expect(Object.keys(DECK_TEXT_EN)).toEqual(DECK_LIST.map((deck) => deck.id));
    for (const text of Object.values(DECK_TEXT_EN)) expect(spanishIn(`${text.name} ${text.description}`)).toEqual([]);
  });

  it('serves the source definitions in Spanish and English copies in English', () => {
    const source = getCardDef('grove_tender');
    expect(source).toBe(CORE_CARDS.find((def) => def.id === 'grove_tender'));
    withLocale('en', () => {
      const english = getCardDef('grove_tender');
      expect(english).toMatchObject({ name: 'Grove Tender', subtypes: ['Elf', 'Druid'], flavor: 'She hums, and the land answers.', mana: ['G'] });
      expect(getCardDef('grove_tender')).toBe(english);
      expect(allCardDefs().find((def) => def.id === 'grove_tender')).toBe(english);
    });
    expect(getCardDef('grove_tender')).toBe(source);
  });

  it('writes the same lines of rules text for every card in both languages, none of them empty', () => {
    const lines = (locale: 'es' | 'en') =>
      withLocale(locale, () =>
        allCardDefs().map((def) => ({
          id: def.id,
          rules: rulesText(def),
          abilities: [
            ...[...(def.triggers ?? []).keys(), UNDYING_TRIGGER, EVOLVE_TRIGGER, PROWESS_TRIGGER].map((index) => triggerText(def, index)),
            ...[...(def.activated ?? []).keys()].map((index) => activatedText(def, index)),
          ],
        })),
      );
    const spanish = new Map(lines('es').map((card) => [card.id, card]));
    const english = lines('en');
    expect(english.map((card) => card.id)).toEqual([...spanish.keys()]);
    for (const card of english) {
      const other = spanish.get(card.id);
      expect(card.rules, card.id).toHaveLength(other?.rules.length ?? -1);
      expect(card.abilities, card.id).toHaveLength(other?.abilities.length ?? -1);
      for (const line of [...card.rules, ...card.abilities, ...(other?.rules ?? []), ...(other?.abilities ?? [])]) expect(line, card.id).not.toBe('');
    }
  });

  it('names the built-in decks in the current language and leaves the player’s own decks alone', () => {
    const mine: DeckDef = { ...EMBERWILD, id: 'mine-1', name: 'Mi mazo' };
    expect(getDeck('emberwild')).toBe(EMBERWILD);
    withLocale('en', () => {
      expect(getDeck('emberwild')).toMatchObject({ id: 'emberwild', name: 'Emberwild', cards: EMBERWILD.cards });
      expect(resolveDeck('dawntide').name).toBe('Dawntide');
      expect(resolveDeck(EMBERWILD).name).toBe('Emberwild');
      expect(localizeDeck(mine)).toBe(mine);
    });
  });
});

describe('rules text in English', () => {
  beforeEach(() => setLocale('en'));
  afterEach(() => setLocale('es'));

  const expected: Record<string, { type: string; text: string[] }> = {
    forest: { type: 'Basic Land — Forest', text: ['{T}: Add {G}.'] },
    grove_tender: { type: 'Creature — Elf Druid', text: ['{T}: Add {G}.'] },
    cloudrider_knight: { type: 'Creature — Human Knight', text: ['Flying, vigilance'] },
    cinder_adept: { type: 'Creature — Human Shaman', text: ['When this creature enters, it deals 1 damage to any target.'] },
    crag_dragon: { type: 'Creature — Dragon', text: ['Flying', '{R}: This creature gets +1/+0 until end of turn.'] },
    ember_snap: { type: 'Instant', text: ['Ember Snap deals 2 damage to any target.'] },
    splitting_flame: { type: 'Sorcery', text: ['Splitting Flame deals 2 damage to target creature and 2 damage to target opponent.'] },
    withering_touch: { type: 'Instant', text: ['Target creature gets -2/-2 until end of turn.'] },
    nightshade_tonic: { type: 'Instant', text: ['Target creature gets +1/+1 and gains deathtouch until end of turn.'] },
    dawns_verdict: { type: 'Instant', text: ['Destroy target tapped creature.'] },
    riptide_recall: { type: 'Instant', text: ["Return target creature you don't control to its owner's hand."] },
    turn_the_tide: { type: 'Instant', text: ['Counter target spell.'] },
    sift_the_depths: { type: 'Instant', text: ['Draw two cards, then discard a card.'] },
    blood_tithe: { type: 'Sorcery', text: ['Each opponent loses 2 life. You gain 2 life. Draw a card.'] },
    pack_pounce: {
      type: 'Sorcery',
      text: ["Put a +1/+1 counter on target creature you control. That creature fights target creature you don't control."],
    },
    snapjaw_strike: { type: 'Sorcery', text: ["Target creature you control deals damage equal to its power to target creature you don't control."] },
    herd_roar: { type: 'Sorcery', text: ['Creatures you control get +2/+2 and gain trample until end of turn.'] },
    wild_blossom: { type: 'Instant', text: ['Put two +1/+1 counters on target creature.'] },
    harvest_hymn: { type: 'Sorcery', text: ['Put a +1/+1 counter on each creature you control. You gain 2 life.'] },
    rite_of_lanterns: { type: 'Sorcery', text: ['Create two 1/1 white and black Spirit creature tokens with flying.'] },
    rob_the_mind: { type: 'Sorcery', text: ['Each opponent discards two cards.'] },
    hushwing_bat: { type: 'Creature — Bat', text: ['Flying', 'Whenever this creature deals combat damage to a player, that player discards a card.'] },
    open_path: { type: 'Sorcery', text: ['You may play an additional land this turn. Draw a card.'] },
    fertile_rift: { type: 'Instant', text: ['Search your library for a basic Forest card, put it onto the battlefield tapped, then shuffle.'] },
    deep_sowing: {
      type: 'Sorcery',
      text: ['Search your library for two basic Forest cards, put one onto the battlefield tapped and the other into your hand, then shuffle.'],
    },
    crypt_ghoul: { type: 'Creature — Zombie', text: ['When this creature dies, it deals 1 damage to target opponent.'] },
    hopeful_squire: { type: 'Creature — Human Soldier', text: ['Whenever this creature attacks, put a +1/+1 counter on it.'] },
    galvanic_channeler: {
      type: 'Creature — Human Shaman',
      text: ['Whenever you cast an instant or sorcery spell, this creature deals 1 damage to target opponent.'],
    },
    forge_cadet: { type: 'Creature — Human Soldier', text: ['Whenever another creature you control enters, put a +1/+1 counter on this creature.'] },
    rotwing_crow: { type: 'Creature — Bird', text: ['Flying', 'Whenever another creature you control dies, each opponent loses 1 life.'] },
    vesper_novice: { type: 'Creature — Human Cleric', text: ['Whenever you gain life, put a +1/+1 counter on this creature.'] },
    cliff_lynx: { type: 'Creature — Cat', text: ['Landfall — Whenever a land you control enters, this creature gets +2/+2 until end of turn.'] },
    blistering_hellion: {
      type: 'Creature — Hellion',
      text: ['When this creature enters, if an opponent was dealt damage this turn, put two +1/+1 counters on it.'],
    },
    bonewood_stalker: { type: 'Creature — Zombie Beast', text: ['Sacrifice this creature: Target creature gets -2/-2 until end of turn.'] },
    bloodspore_thrall: { type: 'Creature — Fungus Zombie', text: ['Undying', 'Sacrifice this creature: Each opponent loses 1 life.'] },
    silver_spire: { type: 'Land', text: ['This land enters tapped.', '{T}: Add {W}, {U}, or {B}.'] },
    prismatic_fount: { type: 'Land', text: ['This land enters tapped.', '{T}: Add one mana of any color.'] },
    kelpweaver_druid: { type: 'Creature — Merfolk Druid', text: ['{T}: Add {G} or {U}.'] },
    monk_token: { type: 'Token Creature — Monk', text: ['Prowess'] },
    tome: { type: 'Relic', text: ['At the beginning of your upkeep, if you have no cards in hand, draw a card.'] },
    urn: { type: 'Relic', text: ['Whenever a creature you control dies, each opponent loses 1 life.'] },
  };

  for (const [id, { type, text }] of Object.entries(expected)) {
    it(`describes ${id}`, () => {
      const def = getCardDef(id);
      expect(typeLine(def)).toBe(type);
      expect(rulesText(def)).toEqual(text);
    });
  }

  it('describes undying, evolve and prowess like the triggers they are', () => {
    expect(triggerText(getCardDef('rotbark_treefolk'), UNDYING_TRIGGER)).toBe(
      "When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield under its owner's control with a +1/+1 counter on it.",
    );
    expect(triggerText(getCardDef('shoal_hatchling'), EVOLVE_TRIGGER)).toBe(
      'Whenever another creature you control enters, if that creature has greater power or toughness than this creature, put a +1/+1 counter on this creature.',
    );
    expect(triggerText(getCardDef('arc_initiate'), PROWESS_TRIGGER)).toBe('Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.');
  });

  it('builds one-line summaries', () => {
    expect(cardSummary('timberland_rhino')).toBe('Timberland Rhino · {2}{G}{G} · Creature — Rhino · 4/4 · Trample');
    expect(cardSummary('elemental_token')).toBe('Elemental · Token Creature — Elemental · 1/1 · Haste');
  });

  it('writes the type line and rules text of every card without Spanish', () => {
    for (const def of allCardDefs()) {
      expect(spanishIn([def.name, typeLine(def), ...rulesText(def), def.flavor ?? ''].join(' ')), def.id).toEqual([]);
    }
  });
});

describe('the log in English', () => {
  beforeEach(() => setLocale('en'));
  afterEach(() => setLocale('es'));

  function board(): GameState {
    return scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }, { card: 'forest', id: 'f' }], battlefield: ['mountain', { card: 'test_bear', id: 'bear' }] },
        { battlefield: [{ card: 'grove_tender', id: 'elf' }, { card: 'canopy_spider', id: 'spider' }] },
      ],
    });
  }

  it('tells every event from the viewer’s seat', () => {
    const s = board();
    const lines = (viewer: PlayerId) => (event: Parameters<typeof describeEvent>[1]) => describeEvent(s, event, viewer);
    const mine = lines(0);
    expect(mine({ t: 'start', startingPlayer: 0 })).toBe('You go first.');
    expect(mine({ t: 'start', startingPlayer: 1 })).toBe('The opponent goes first.');
    expect(mine({ t: 'mulligan', player: 1, count: 1 })).toBe('The opponent mulligans (1).');
    expect(mine({ t: 'keep', player: 0, handSize: 7 })).toBe('You keep 7 cards.');
    expect(mine({ t: 'bottom', player: 1, count: 2 })).toBe('The opponent puts 2 cards on the bottom of their library.');
    expect(mine({ t: 'turn', turn: 4, player: 1 })).toBe("Turn 4 — the opponent's turn.");
    expect(mine({ t: 'draw', player: 0, card: 'snap' })).toBe('You draw Ember Snap.');
    expect(mine({ t: 'draw', player: 1, card: 'elf' })).toBe('The opponent draws a card.');
    expect(mine({ t: 'drawEmpty', player: 1 })).toBe("The opponent can't draw: their library is empty.");
    expect(mine({ t: 'land', player: 0, card: 'f' })).toBe('You play Forest.');
    expect(mine({ t: 'cast', player: 0, card: 'snap', targets: [{ card: 'elf' }] })).toBe("You cast Ember Snap targeting the opponent's Grove Tender.");
    expect(lines(1)({ t: 'cast', player: 0, card: 'snap', targets: [{ player: 1 }] })).toBe('The opponent casts Ember Snap targeting you.');
    expect(mine({ t: 'trigger', player: 1, card: 'elf', ability: 0, targets: [{ card: 'bear' }, { player: 0 }] })).toBe(
      "The opponent's Grove Tender triggers targeting your Test Bear and you.",
    );
    expect(mine({ t: 'attack', player: 0, attackers: ['bear', 'snap', 'f'] })).toBe('You attack with Test Bear, Ember Snap, and Forest.');
    expect(mine({ t: 'block', player: 1, blocks: [] })).toBe("The opponent doesn't block.");
    expect(mine({ t: 'block', player: 1, blocks: [{ blocker: 'spider', attacker: 'bear' }] })).toBe('The opponent blocks: Canopy Spider → Test Bear.');
    expect(mine({ t: 'damage', source: 'bear', target: { player: 1 }, amount: 2, combat: true })).toBe('Your Test Bear deals 2 damage to the opponent.');
    expect(mine({ t: 'damage', source: 'spider', target: { card: 'bear' }, amount: 1, combat: true })).toBe(
      "The opponent's Canopy Spider deals 1 damage to your Test Bear.",
    );
    expect(mine({ t: 'life', player: 0, delta: 3, life: 23 })).toBe('You gain 3 life (23).');
    expect(mine({ t: 'loseLife', player: 1, amount: 2 })).toBe('The opponent loses 2 life.');
    expect(mine({ t: 'pump', card: 'bear', power: 1, toughness: 1, keywords: ['deathtouch'] })).toBe(
      'Your Test Bear gets +1/+1 and gains deathtouch until end of turn.',
    );
    expect(mine({ t: 'addCounters', card: 'elf', amount: 2 })).toBe("The opponent's Grove Tender gets 2 +1/+1 counters.");
    expect(mine({ t: 'fight', a: 'bear', b: 'elf' })).toBe("Your Test Bear fights the opponent's Grove Tender.");
    expect(mine({ t: 'dies', card: 'elf', player: 1 })).toBe("The opponent's Grove Tender dies.");
    expect(mine({ t: 'discard', player: 1, card: 'elf' })).toBe('The opponent discards Grove Tender.');
    expect(mine({ t: 'bounce', card: 'elf', player: 1 })).toBe("Grove Tender returns to the opponent's hand.");
    expect(mine({ t: 'counter', card: 'snap', player: 0 })).toBe('Your Ember Snap is countered.');
    expect(mine({ t: 'search', player: 0, card: 'f', to: 'hand' })).toBe('You search your library and put Forest into your hand.');
    expect(mine({ t: 'search', player: 1, card: 'elf', to: 'battlefield' })).toBe('The opponent searches their library and puts Grove Tender onto the battlefield.');
    expect(mine({ t: 'extraLands', player: 0, amount: 1 })).toBe('You may play an additional land this turn.');
    expect(mine({ t: 'concede', player: 1 })).toBe('The opponent concedes.');
    expect(mine({ t: 'gameOver', winner: 0, reason: 'life' })).toBe('You win!');
    expect(mine({ t: 'gameOver', winner: null, reason: 'turnLimit' })).toBe('The game ends in a draw.');
  });

  it('names the tokens it creates with the right article', () => {
    const s = scenario({ players: [{ battlefield: [{ card: 'soldier_token', id: 'soldier' }, { card: 'elemental_token', id: 'elemental' }] }, {}] });
    expect(describeEvent(s, { t: 'create', player: 0, card: 'soldier' }, 0)).toBe('You create a Soldier token.');
    expect(describeEvent(s, { t: 'create', player: 0, card: 'elemental' }, 1)).toBe('The opponent creates an Elemental token.');
  });

  it('tells whole games without Spanish, from both seats', () => {
    const leaks = new Set<string>();
    const decks = DECK_LIST.map((deck) => deck.id);
    for (let index = 0; index < decks.length; index += 2) {
      let s = createGame({ seed: index + 5, players: [{ deck: decks[index] }, { deck: decks[index + 1] }] });
      expect(s.players.map((player) => player.name)).toEqual(['You', 'AI']);
      for (let step = 0; s.pending && s.pending.kind !== 'gameOver' && step < 400; step++) {
        s = applyAction(s, chooseAction(s, s.pending.player));
        for (const event of s.events) {
          for (const viewer of [0, 1] as const) for (const word of spanishIn(describeEvent(s, event, viewer) ?? '')) leaks.add(word);
        }
      }
      for (const word of spanishIn(describeState(s, 0, true))) leaks.add(word);
    }
    expect([...leaks]).toEqual([]);
  });

  it('describes the state for a developer', () => {
    const lines = describeState(board(), 0).split('\n');
    expect(lines[0]).toBe('Turn 3 · Main phase · active: You (p0)');
    expect(lines[1]).toBe('You (p0): 20 life · library 10 · graveyard 0');
    expect(lines[3]).toMatch(/^ {2}battlefield: Mountain\(c\d+\), Test Bear\(bear\) 2\/2$/);
  });
});

describe('the language', () => {
  it('never changes how a game is played', () => {
    const play = (): unknown[] => {
      let s = createGame({ seed: 9, players: [{ deck: 'emberwild' }, { deck: 'duskmire' }] });
      const actions: unknown[] = [];
      for (let step = 0; s.pending && s.pending.kind !== 'gameOver' && step < 400; step++) {
        const action = chooseAction(s, s.pending.player);
        actions.push(action);
        s = applyAction(s, action);
      }
      return [...actions, s.players.map((player) => player.life)];
    };
    expect(withLocale('en', play)).toEqual(play());
  });
});

describe('refusals in English', () => {
  const samples: Refusal[] = [
    { code: 'malformedAction' },
    { code: 'unknownAction', type: 'nope' },
    { code: 'unknownPlayer' },
    { code: 'noDecision' },
    { code: 'gameOver' },
    { code: 'notWaitingFor', kind: 'priority' },
    { code: 'notTheirDecision', player: 1 },
    { code: 'otherSeat' },
    { code: 'notYourDecision' },
    { code: 'noMoreMulligans' },
    { code: 'cardsNotList' },
    { code: 'chooseExactly', count: 2 },
    { code: 'chosenNotInHand', card: 'c1' },
    { code: 'chosenTwice', card: 'c1' },
    { code: 'notInHand' },
    { code: 'notALand' },
    { code: 'landTiming' },
    { code: 'landPlayed' },
    { code: 'allLandsPlayed' },
    { code: 'landsAreNotCast' },
    { code: 'noPriority' },
    { code: 'sorceryTiming' },
    { code: 'notEnoughMana' },
    { code: 'notYourPermanent' },
    { code: 'noSuchAbility' },
    { code: 'tapped' },
    { code: 'summoningSick' },
    { code: 'triggerGone' },
    { code: 'targetsNotList' },
    { code: 'targetCount', given: 2, expected: 1 },
    { code: 'targetMalformed', index: 0 },
    { code: 'illegalTarget', index: 0, target: 'c1' },
    { code: 'sameTargetTwice' },
    { code: 'attackersNotList' },
    { code: 'attackersNotIds' },
    { code: 'attackerTwice', card: 'c1' },
    { code: 'cannotAttack', card: 'c1' },
    { code: 'blocksNotList' },
    { code: 'noCombat' },
    { code: 'malformedBlock' },
    { code: 'blockerTwice', card: 'c1' },
    { code: 'cannotBlock', blocker: 'c1', attacker: 'c2' },
    { code: 'menace', attacker: 'c2' },
  ];

  it('explain every refusal in both languages', () => {
    for (const refusal of samples) {
      const spanish = refusalText(refusal);
      const english = withLocale('en', () => refusalText(refusal));
      expect(english, refusal.code).not.toBe(spanish);
      expect(spanishIn(english), refusal.code).toEqual([]);
    }
  });

  it('reach the result of an action in the current language', () => {
    let s = scenario({ players: [{ hand: [{ card: 'forest', id: 'f1' }, { card: 'forest', id: 'f2' }] }, {}] });
    s = playLand(s, 'f1');
    const refused = withLocale('en', () => tryApplyAction(s, { type: 'playLand', player: 0, card: 'f2' }));
    expect(refused).toEqual({ ok: false, error: "you've already played a land this turn", refusal: { code: 'landPlayed' } });
  });
});
