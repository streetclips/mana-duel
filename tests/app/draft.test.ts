import { describe, expect, it } from 'vitest';
import { chooseAction } from '../../src/ai';
import { isBasicLand, isLandCard } from '../../src/app/cardPool';
import { GameController } from '../../src/app/controller';
import { countCards, deckColors, draftProblems } from '../../src/app/deckBuilding';
import { DeckLibrary } from '../../src/app/deckLibrary';
import {
  AI_DRAFT_DECK_ID,
  DRAFT_DECK_ID,
  PACK_SIZE,
  ROUNDS,
  SEALED_PACKS,
  aiPick,
  allowances,
  autoBuild,
  cardRating,
  createDraft,
  draftPool,
  isDraftRun,
  matchWinner,
  pickCard,
  recordGame,
  saveDeck,
  startGame,
  suggestedDeck,
  type DraftRun,
} from '../../src/app/draft';
import { DraftController, type DraftStore } from '../../src/app/draftController';
import { createTestApi } from '../../src/app/testApi';
import { cardColors, getCardDef, resolveDeck, type DeckEntry } from '../../src/engine';

function pickAll(run: DraftRun): DraftRun {
  let next = run;
  while (next.stage === 'picking') next = pickCard(next, aiPick(next.packs[0], next.picks[0]));
  return next;
}

function built(run: DraftRun): DraftRun {
  return saveDeck(run, { id: null, name: 'Mi draft', featured: null, cards: suggestedDeck(run) });
}

describe('opening packs', () => {
  it('deals each drafter a pack of twelve different cards that are not basic lands', () => {
    const run = createDraft('draft', 4);
    expect(run.stage).toBe('picking');
    for (const pack of run.packs) {
      expect(pack).toHaveLength(PACK_SIZE);
      expect(new Set(pack).size).toBe(PACK_SIZE);
      expect(pack.every((card) => !isBasicLand(card) && !getCardDef(card).token)).toBe(true);
    }
    expect(createDraft('draft', 4)).toEqual(run);
    expect(createDraft('draft', 5).packs).not.toEqual(run.packs);
    expect(draftPool().some((card) => isBasicLand(card))).toBe(false);
  });

  it('opens six packs for each player in sealed, and goes straight to building', () => {
    const run = createDraft('sealed', 9);
    expect(run.stage).toBe('building');
    expect(run.picks.map((picks) => picks.length)).toEqual([SEALED_PACKS * PACK_SIZE, SEALED_PACKS * PACK_SIZE]);
    expect(countCards(run.aiDeck)).toBe(40);
    expect(run.aiDeck.every((entry) => run.picks[1].includes(entry.card) || isBasicLand(entry.card))).toBe(true);
  });
});

describe('picking', () => {
  it('takes your card and the AI’s at once, then swaps the packs, round after round', () => {
    const run = createDraft('draft', 6);
    const [mine, theirs] = run.packs;
    const card = mine[3] ?? '';
    const next = pickCard(run, card);
    expect(next.picks[0]).toEqual([card]);
    expect(next.picks[1]).toHaveLength(1);
    expect(theirs).toContain(next.picks[1][0]);
    expect(next.packs[0]).toEqual(theirs.filter((candidate) => candidate !== next.picks[1][0]));
    expect(next.packs[1]).toEqual(mine.filter((candidate) => candidate !== card));
    let round = next;
    for (let i = 1; i < PACK_SIZE; i++) round = pickCard(round, round.packs[0][0] ?? '');
    expect(round.round).toBe(1);
    expect(round.packs.map((pack) => pack.length)).toEqual([PACK_SIZE, PACK_SIZE]);
    expect(round.picks.map((picks) => picks.length)).toEqual([PACK_SIZE, PACK_SIZE]);
    const done = pickAll(round);
    expect(done.stage).toBe('building');
    expect(done.picks.map((picks) => picks.length)).toEqual([ROUNDS * PACK_SIZE, ROUNDS * PACK_SIZE]);
    expect(countCards(done.aiDeck)).toBe(40);
  });

  it('refuses a card that is not in your pack, or a pick once picking is over', () => {
    const run = createDraft('draft', 6);
    const outside = draftPool().find((card) => !run.packs[0].includes(card)) ?? '';
    expect(() => pickCard(run, outside)).toThrow(/is not in the pack/);
    expect(() => pickCard(pickAll(run), run.packs[0][0] ?? '')).toThrow(/building stage, not picking/);
  });

  it('rates bombs and removal above small creatures, and basic lands at nothing', () => {
    expect(cardRating('prismatic_dragon')).toBeGreaterThan(cardRating('mist_sprite'));
    expect(cardRating('grave_sentence')).toBeGreaterThan(cardRating('gloom_wisp'));
    expect(cardRating('magma_lance')).toBeGreaterThan(cardRating('verdant_surge'));
    expect(cardRating('forest')).toBe(0);
    expect(cardRating('silver_spire')).toBeLessThan(cardRating('ember_hound'));
  });

  it('lets the AI take the best card at first and then keep to its colors', () => {
    expect(aiPick(['mist_sprite', 'crag_dragon', 'gloom_wisp'], [])).toBe('crag_dragon');
    const red = ['ember_hound', 'cinder_adept', 'ridge_marauder', 'ashen_duelist', 'ember_snap', 'magma_lance'];
    expect(cardRating('galewing_falcon')).toBeGreaterThan(cardRating('kiln_sprite'));
    expect(aiPick(['galewing_falcon', 'kiln_sprite'], red)).toBe('kiln_sprite');
  });
});

describe('building', () => {
  it('builds forty cards with lands for its colors out of a pool', () => {
    const run = pickAll(createDraft('draft', 11));
    const deck = autoBuild(run.picks[1]);
    expect(countCards(deck)).toBe(40);
    expect(deckColors(deck).length).toBeLessThanOrEqual(3);
    const spells = deck.filter((entry) => !getCardDef(entry.card).types.includes('land'));
    expect(countCards(spells)).toBeGreaterThanOrEqual(21);
    for (const entry of spells) expect(run.picks[1].filter((card) => card === entry.card).length).toBeGreaterThanOrEqual(entry.count);
    const reds = autoBuild(['ember_hound', 'cinder_adept', 'ridge_marauder', 'ashen_duelist', 'ember_snap', 'magma_lance']);
    expect(deckColors(reds)).toEqual(['R']);
    expect(countCards(reds)).toBe(40);
  });

  it('allows your picks as many times as you took them, and basic lands without limit', () => {
    const run = pickAll(createDraft('draft', 12));
    const limits = allowances(run);
    const first = run.picks[0][0] ?? '';
    expect(limits.find((allowance) => allowance.card === first)?.max).toBe(run.picks[0].filter((card) => card === first).length);
    expect(limits.filter((allowance) => allowance.max === null).map((allowance) => allowance.card).sort()).toEqual([
      'forest',
      'island',
      'mountain',
      'plains',
      'swamp',
    ]);
    expect(draftProblems({ id: null, name: 'x', featured: null, cards: suggestedDeck(run) }, limits)).toEqual([]);
    const notMine = draftPool().find((card) => !run.picks[0].includes(card)) ?? '';
    expect(() => saveDeck(run, { id: null, name: 'x', featured: null, cards: [...suggestedDeck(run), { card: notMine, count: 1 }] })).toThrow(/cannot be played/);
    expect(() => saveDeck(run, { id: null, name: 'x', featured: null, cards: [{ card: 'forest', count: 20 }] })).toThrow(/Faltan 20 cartas/);
    const saved = built(run);
    expect(saved.stage).toBe('match');
    expect(countCards(saved.deck ?? [])).toBe(40);
  });
});

describe('the match', () => {
  it('flips a coin for the first game, lets the loser start the next, and ends at two wins', () => {
    const run = built(pickAll(createDraft('sealed', 3)));
    const firsts = new Set(Array.from({ length: 12 }, (_, n) => startGame({ ...run, rng: Math.imul(n + 1, 0x9e3779b9) >>> 0 }).startingPlayer));
    expect(firsts).toEqual(new Set([0, 1]));
    const lost = recordGame(run, 1, 12);
    expect(startGame(lost).startingPlayer).toBe(0);
    const drawn = recordGame(lost, null, 200);
    expect(drawn.wins).toEqual([0, 1]);
    const won = recordGame(drawn, 0, 9);
    expect(startGame(won).startingPlayer).toBe(1);
    const done = recordGame(won, 0, 14);
    expect(done.stage).toBe('done');
    expect(matchWinner(done)).toBe(0);
    expect(done.games.map((game) => game.winner)).toEqual([1, null, 0, 0]);
    expect(() => recordGame(done, 1, 3)).toThrow(/done stage, not match/);
    expect(startGame(run).seed).not.toBe(startGame(startGame(run).run).seed);
  });

  it('survives a trip through JSON at every stage, and rejects broken runs', () => {
    let run = createDraft('draft', 21);
    const roundTrip = (value: DraftRun) => isDraftRun(JSON.parse(JSON.stringify(value)));
    expect(roundTrip(run)).toBe(true);
    run = pickAll(run);
    expect(roundTrip(run)).toBe(true);
    run = built(run);
    expect(roundTrip(run)).toBe(true);
    run = recordGame(recordGame(run, 1, 9), 1, 10);
    expect(roundTrip(run)).toBe(true);
    expect(isDraftRun({ ...run, version: 3 })).toBe(false);
    expect(isDraftRun({ ...run, picks: [['nope'], []] })).toBe(false);
    expect(isDraftRun({ ...run, picks: [['urn'], []] })).toBe(false);
    expect(isDraftRun({ ...run, stage: 'shopping' })).toBe(false);
    expect(isDraftRun({ ...run, wins: [1] })).toBe(false);
    expect(isDraftRun(null)).toBe(false);
  });
});

function swapOneSpell(run: DraftRun, cards: DeckEntry[]): DeckEntry[] {
  const used = new Map(cards.map((entry) => [entry.card, entry.count]));
  const spare = allowances(run).find((allowance) => allowance.max !== null && !isLandCard(allowance.card) && (used.get(allowance.card) ?? 0) < allowance.max);
  const dropped = cards.find((entry) => !isLandCard(entry.card) && entry.card !== spare?.card);
  if (!spare || !dropped) throw new Error('no spell to swap');
  const swapped = cards.map((entry) => (entry === dropped ? { ...entry, count: entry.count - 1 } : { ...entry })).filter((entry) => entry.count > 0);
  const added = swapped.find((entry) => entry.card === spare.card);
  if (added) added.count += 1;
  else swapped.push({ card: spare.card, count: 1 });
  return swapped;
}

function memoryStore(): DraftStore & { saved: unknown } {
  const store = {
    saved: null as unknown,
    load: () => JSON.parse(JSON.stringify(store.saved)) as unknown,
    save: (run: DraftRun | null) => {
      store.saved = run === null ? null : JSON.parse(JSON.stringify(run));
    },
  };
  return store;
}

describe('the draft controller', () => {
  it('plays the match with your deck against the AI’s, and records each game once', () => {
    const controller = new GameController({ seed: 5, aiDelayMs: 0 });
    const store = memoryStore();
    const draft = new DraftController(controller, store);
    draft.start('sealed', 8);
    draft.saveDeck({ id: null, name: 'Sellado verde', featured: null, cards: suggestedDeck(draft.run as DraftRun) });
    draft.play();
    expect(draft.inGame).toBe(true);
    expect(controller.matchupIds()).toEqual([DRAFT_DECK_ID, AI_DRAFT_DECK_ID]);
    expect(resolveDeck(controller.decks?.[0] ?? 'emberwild').name).toBe('Sellado verde');
    expect(draft.currentGame).toEqual({ number: 1, result: null, wins: [0, 0] });
    controller.concede();
    expect(draft.run?.wins).toEqual([0, 1]);
    expect(draft.currentGame).toEqual({ number: 1, result: 'lost', wins: [0, 1] });
    controller.setAiDelay(0);
    expect(draft.run?.games).toHaveLength(1);
    draft.play();
    expect(draft.currentGame?.number).toBe(2);
    expect(controller.state.startingPlayer).toBe(0);
    controller.concede();
    expect(draft.run?.stage).toBe('done');
    expect(new DraftController(new GameController({ seed: 5, aiDelayMs: 0 }), store).run).toEqual(draft.run);
  });

  it('resumes a game in progress after a reload', () => {
    const controller = new GameController({ seed: 5, aiDelayMs: 0 });
    const store = memoryStore();
    const draft = new DraftController(controller, store);
    draft.start('sealed', 2);
    draft.saveDeck({ id: null, name: 'Mi draft', featured: null, cards: suggestedDeck(draft.run as DraftRun) });
    draft.play();
    controller.settle();
    draft.flush();
    const state = controller.state;
    const later = new GameController({ seed: 5, aiDelayMs: 0 });
    const resumed = new DraftController(later, store);
    resumed.play();
    expect(later.state).toEqual(state);
    expect(resumed.inGame).toBe(true);
  });

  it('resumes a game in progress with the deck it began with, even after the deck changes', () => {
    const controller = new GameController({ seed: 5, aiDelayMs: 0 });
    const draft = new DraftController(controller, memoryStore());
    draft.start('sealed', 8);
    const cards = suggestedDeck(draft.run as DraftRun);
    draft.saveDeck({ id: null, name: 'Mi draft', featured: null, cards });
    draft.play();
    for (let decisions = 0; decisions < 30; decisions++) {
      controller.settle();
      if (!controller.isHumanTurnToDecide()) break;
      controller.dispatch(chooseAction(controller.state, 0));
    }
    draft.flush();
    expect(draft.run?.duel?.actions.length).toBeGreaterThan(30);
    const state = controller.state;
    draft.saveDeck({ id: null, name: 'Mi draft', featured: null, cards: swapOneSpell(draft.run as DraftRun, cards) });
    draft.play();
    expect(controller.state).toEqual(state);
    expect(draft.currentGame?.number).toBe(1);
  });

  it('drives a whole draft through window.manaDuel', () => {
    const controller = new GameController({ seed: 5, aiDelayMs: 0 });
    const draft = new DraftController(controller, memoryStore());
    const library = new DeckLibrary();
    const api = createTestApi(controller, () => undefined, { freezeFx: async () => [], draft, library });
    expect(api.draft.pick('crag_dragon')).toEqual({ ok: false, error: 'there is no draft under way' });
    const started = api.draft.start({ format: 'draft', seed: 30 });
    expect(started).toMatchObject({ ok: true, run: { format: 'draft', stage: 'picking' } });
    let run = api.draft.state();
    while (run?.stage === 'picking') {
      const result = api.draft.pick(run.packs[0][0] ?? '');
      run = result.ok ? result.run : null;
    }
    expect(api.draft.saveDeck([{ card: 'forest', count: 3 }])).toMatchObject({ ok: false });
    expect(api.draft.saveDeck()).toMatchObject({ ok: true, run: { stage: 'match' } });
    expect(api.draft.play()).toMatchObject({ ok: true });
    expect(api.matchup()).toEqual(['draft', 'draft-ai']);
    api.draft.abandon();
    expect(api.draft.state()).toBeNull();
    expect(api.help()).toContain('draft.pick(id)');
    expect(cardColors(getCardDef('crag_dragon'))).toEqual(['R']);
  });
});
