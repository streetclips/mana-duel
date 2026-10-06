import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_COPIES, spellPool } from '../../src/app/cardPool';
import { GameController } from '../../src/app/controller';
import {
  DUELS,
  EXPEDITION_DECK_ID,
  OFFERS,
  RIVAL_HAND,
  RIVAL_LIFE,
  RIVAL_RELICS,
  baseName,
  chooseCard,
  chooseRelic,
  copiesOf,
  createRun,
  currentRival,
  deckSizeOf,
  duelSetup,
  isExpeditionRun,
  perksAgainst,
  recordDuel,
  rivalStart,
  runDeck,
  startDuel,
  swapCard,
  type ExpeditionRun,
} from '../../src/app/expedition';
import { relicOf, relicsOf } from '../../src/app/relics';
import { SAVE_DELAY_MS } from '../../src/app/duelTracker';
import { ExpeditionController, type RunStore } from '../../src/app/expeditionController';
import { createTestApi } from '../../src/app/testApi';
import { DECK_LIST, cardColors, getCardDef, getDeck, resolveDeck, type DeckDef } from '../../src/engine';

afterEach(() => {
  vi.useRealTimers();
});

function winTo(run: ExpeditionRun, stage: ExpeditionRun['stage']['kind']): ExpeditionRun {
  let next = run;
  for (let guard = 0; guard < 40 && next.stage.kind !== stage; guard++) {
    if (next.stage.kind === 'duel') next = recordDuel(next, 'won', 9);
    else if (next.stage.kind === 'card') next = chooseCard(next, next.stage.offers[0] ?? null);
    else if (next.stage.kind === 'swap') next = swapCard(next, null);
    else if (next.stage.kind === 'relic') next = chooseRelic(next, next.stage.offers[0] ?? 'vigor');
    else break;
  }
  return next;
}

describe('an expedition run', () => {
  it('plans seven rivals among the other decks, weak at first and stronger as it goes, with a boss at the end', () => {
    const run = createRun(getDeck('dawntide'), 7);
    expect(run.rivals).toHaveLength(DUELS);
    expect(new Set(run.rivals.map((rival) => rival.deck)).size).toBe(DUELS);
    expect(run.rivals.map((rival) => rival.deck)).not.toContain('dawntide');
    expect(run.rivals.map((rival) => rival.life)).toEqual([14, 16, 16, 18, 20, 20, 20]);
    expect(run.rivals.map((rival) => rival.openingHand)).toEqual([6, 6, 6, 6, 6, 6, 6]);
    expect(run.rivals.map((rival) => rival.relics.length)).toEqual([0, 0, 1, 1, 1, 2, 2]);
    expect(RIVAL_LIFE).toHaveLength(DUELS);
    expect(RIVAL_HAND).toHaveLength(DUELS);
    expect(RIVAL_RELICS).toHaveLength(DUELS);
    expect(run.rivals.map((rival) => rival.boss)).toEqual([false, false, false, false, false, false, true]);
    expect(run.relics).toEqual([]);
    expect(run.spent).toEqual([]);
    expect(run.deck).toEqual(getDeck('dawntide').cards);
    expect(run.stage).toEqual({ kind: 'duel' });
    expect(createRun(getDeck('dawntide'), 7)).toEqual(run);
    const orders = new Set(
      [1, 2, 3, 4, 5].map((seed) =>
        createRun(getDeck('dawntide'), seed)
          .rivals.map((rival) => rival.deck)
          .join(),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('arms the later rivals with different relics a rival may carry, and the boss with a boss relic first', () => {
    const bosses = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const run = createRun(getDeck('stormglass'), seed);
      const relics = run.rivals.flatMap((rival) => rival.relics);
      expect(new Set(relics).size).toBe(relics.length);
      const boss = run.rivals.at(-1);
      const [special, ...common] = boss?.relics ?? [];
      expect(special && relicOf(special).owner).toBe('boss');
      bosses.add(special ?? '');
      for (const relic of [...run.rivals.slice(0, -1).flatMap((rival) => rival.relics), ...common])
        expect(relicOf(relic).owner).toBe('any');
    }
    expect([...bosses].sort()).toEqual([...relicsOf(['boss'])].sort());
  });

  it('sets up each duel with the expedition deck against the rival, with the rival’s life, hand and relics for that duel', () => {
    const run = createRun(getDeck('emberwild'), 3);
    const first = duelSetup(run);
    expect(resolveDeck(first.decks[0])).toMatchObject({
      id: EXPEDITION_DECK_ID,
      name: 'Brasalvaje',
      colors: ['R', 'G'],
      featured: 'crag_dragon',
    });
    expect(first.decks[1]).toBe(run.rivals[0]?.deck);
    expect(first.perks).toEqual([{}, { life: 14, openingHand: 6 }]);
    const boss = {
      ...run,
      wins: 6,
      rivals: run.rivals.map((rival) =>
        rival.boss ? { ...rival, relics: ['bell' as const, 'vigor' as const] } : rival,
      ),
    };
    expect(duelSetup(boss).perks).toEqual([{}, { life: 26, openingHand: 6, relics: ['bell'] }]);
    const masked = { ...boss, relics: ['mask' as const, 'urn' as const] };
    expect(duelSetup(masked).perks).toEqual([{ relics: ['urn'] }, { life: 26, openingHand: 5, relics: ['bell'] }]);
    const rival = masked.rivals[6];
    if (!rival) throw new Error('expected a boss');
    expect(perksAgainst(masked, rival)).toEqual(duelSetup(masked).perks);
    expect(rivalStart(masked, rival)).toEqual({ life: 26, openingHand: 5 });
    expect(rivalStart(run, run.rivals[1] ?? rival)).toEqual({ life: 16, openingHand: 6 });
  });

  it('offers three cards of the deck’s colors after a win, then swaps one in or adds it', () => {
    const won = recordDuel(createRun(getDeck('emberwild'), 11), 'won', 12);
    expect(won.wins).toBe(1);
    expect(won.history).toEqual([
      { rival: createRun(getDeck('emberwild'), 11).rivals[0]?.deck, result: 'won', turns: 12 },
    ]);
    if (won.stage.kind !== 'card') throw new Error('expected a card offer');
    const offers = won.stage.offers;
    expect(offers).toHaveLength(OFFERS);
    expect(new Set(offers).size).toBe(OFFERS);
    for (const card of offers) {
      const def = getCardDef(card);
      expect(def.types).not.toContain('land');
      expect(cardColors(def).every((color) => ['R', 'G'].includes(color))).toBe(true);
    }
    const picked = offers[0] ?? '';
    const swapping = chooseCard(won, picked);
    expect(swapping.stage).toEqual({ kind: 'swap', card: picked });
    const swapped = swapCard(swapping, 'ember_snap');
    expect(deckSizeOf(swapped)).toBe(40);
    expect(copiesOf(swapped, 'ember_snap')).toBe(copiesOf(won, 'ember_snap') - 1);
    expect(copiesOf(swapped, picked)).toBe(copiesOf(won, picked) + 1);
    expect(swapped.added).toEqual([picked]);
    expect(swapped.removed).toEqual(['ember_snap']);
    expect(swapped.stage).toEqual({ kind: 'duel' });
    const added = swapCard(swapping, null);
    expect(deckSizeOf(added)).toBe(41);
    expect(added.removed).toEqual([]);
    expect(chooseCard(won, null)).toMatchObject({ stage: { kind: 'duel' }, deck: won.deck });
  });

  it('never offers a fifth copy of a card', () => {
    const run = createRun(getDeck('duskmire'), 5);
    const pool = spellPool(['B']);
    const full = {
      ...run,
      deck: [{ card: 'swamp', count: 16 }, ...pool.slice(1).map((card) => ({ card, count: MAX_COPIES }))],
    };
    const won = recordDuel(full, 'won', 8);
    expect(won.stage).toEqual({ kind: 'card', offers: [pool[0]] });
  });

  it('removes a card entry once its last copy is swapped out', () => {
    const won = recordDuel(createRun(getDeck('emberwild'), 11), 'won', 12);
    if (won.stage.kind !== 'card') throw new Error('expected a card offer');
    const swapped = swapCard(chooseCard(won, won.stage.offers[0] ?? null), 'crag_dragon');
    expect(swapped.deck.some((entry) => entry.card === 'crag_dragon')).toBe(false);
  });

  it('offers a relic after every third win, and ends after the seventh', () => {
    const run = createRun(getDeck('sunmeadow'), 21);
    const relic = winTo(run, 'relic');
    expect(relic.wins).toBe(3);
    if (relic.stage.kind !== 'relic') throw new Error('expected a relic offer');
    expect(relic.stage.offers).toHaveLength(OFFERS);
    for (const offer of relic.stage.offers) expect(relicOf(offer).owner).not.toBe('boss');
    const chosen = relic.stage.offers[1] ?? 'vigor';
    const next = chooseRelic(relic, chosen);
    expect(next.relics).toEqual([chosen]);
    expect(next.stage).toEqual({ kind: 'duel' });
    const second = winTo(next, 'relic');
    expect(second.wins).toBe(6);
    if (second.stage.kind !== 'relic') throw new Error('expected a relic offer');
    expect(second.stage.offers).not.toContain(chosen);
    const boss = winTo(second, 'duel');
    expect(currentRival(boss)?.boss).toBe(true);
    const done = recordDuel(boss, 'won', 15);
    expect(done.stage).toEqual({ kind: 'won' });
    expect(done.wins).toBe(DUELS);
    expect(currentRival(done)).toBeNull();
  });

  it('replays the duel instead of ending the run the first time the phoenix feather sees a defeat', () => {
    const run = { ...createRun(getDeck('mistgrave'), 2), relics: ['phoenix' as const] };
    const saved = recordDuel(run, 'lost', 11);
    expect(saved).toMatchObject({ stage: { kind: 'duel' }, wins: 0, spent: ['phoenix'], relics: ['phoenix'] });
    expect(saved.history).toEqual([{ rival: run.rivals[0]?.deck, result: 'lost', turns: 11 }]);
    expect(currentRival(saved)).toEqual(currentRival(run));
    expect(recordDuel(saved, 'lost', 9).stage).toEqual({ kind: 'lost' });
  });

  it('ends at the first defeat and replays the duel after a draw', () => {
    const run = createRun(getDeck('mistgrave'), 2);
    const drawn = recordDuel(run, 'draw', 200);
    expect(drawn.stage).toEqual({ kind: 'duel' });
    expect(drawn.wins).toBe(0);
    expect(currentRival(drawn)).toEqual(currentRival(run));
    const lost = recordDuel(drawn, 'lost', 9);
    expect(lost.stage).toEqual({ kind: 'lost' });
    expect(lost.history.map((record) => record.result)).toEqual(['draw', 'lost']);
    expect(() => recordDuel(lost, 'won', 3)).toThrow(/lost stage/);
  });

  it('refuses choices that are not on offer or out of order', () => {
    const run = createRun(getDeck('emberwild'), 11);
    expect(() => chooseCard(run, 'ember_snap')).toThrow(/duel stage, not card/);
    const won = recordDuel(run, 'won', 9);
    expect(() => chooseCard(won, 'prismatic_dragon')).toThrow(/not one of the cards on offer/);
    expect(() => swapCard(won, null)).toThrow(/card stage, not swap/);
    if (won.stage.kind !== 'card') throw new Error('expected a card offer');
    const swapping = chooseCard(won, won.stage.offers[0] ?? null);
    expect(() => swapCard(swapping, 'aurora_seraph')).toThrow(/not in the expedition deck/);
    expect(() => chooseRelic(won, 'vigor')).toThrow(/card stage, not relic/);
  });

  it('turns relics into perks for every duel, and starts every duel for the hourglass', () => {
    const run = { ...createRun(getDeck('crossroads'), 4), relics: relicsOf(['any', 'player']) };
    expect(duelSetup(run).perks[0]).toEqual({
      life: 26,
      battlefield: ['soldier_token', 'silver_spire'],
      relics: ['censer', 'urn', 'drum', 'chalice', 'tome'],
      drawOnFirstTurn: true,
    });
    const starts = (relics: ExpeditionRun['relics']) =>
      [1, 2, 3, 4, 5, 6, 7, 8].map(
        (seed) => startDuel({ ...createRun(getDeck('crossroads'), seed), relics }).startingPlayer,
      );
    expect(new Set(starts([]))).toEqual(new Set([0, 1]));
    expect(new Set(starts(['hourglass']))).toEqual(new Set([0]));
    const landless = {
      ...createRun(getDeck('flamecrest'), 1),
      deck: [{ card: 'kiln_sprite', count: 40 }],
      relics: ['cartographer' as const],
    };
    expect(duelSetup(landless).perks[0]).toEqual({ openingHand: 6, battlefield: ['mountain'] });
  });

  it('draws each duel’s seed from the run, so a run replays the same way', () => {
    const run = createRun(getDeck('gloamwood'), 8);
    const first = startDuel(run);
    expect(startDuel(run)).toEqual(first);
    expect(first.run.rng).not.toBe(run.rng);
    expect(startDuel(first.run).seed).not.toBe(first.seed);
  });

  it('survives a trip through JSON at every stage, and rejects broken runs', () => {
    let run = createRun(getDeck('vesperhall'), 30);
    const seen = new Set<string>();
    for (let guard = 0; guard < 40 && run.stage.kind !== 'won'; guard++) {
      seen.add(run.stage.kind);
      expect(isExpeditionRun(JSON.parse(JSON.stringify(run)))).toBe(true);
      run = winTo(run, run.stage.kind === 'duel' ? 'card' : 'duel');
      if (run.stage.kind === 'relic') run = chooseRelic(run, run.stage.offers[0] ?? 'vigor');
    }
    expect(isExpeditionRun(JSON.parse(JSON.stringify(run)))).toBe(true);
    expect([...seen].sort()).toEqual(['card', 'duel']);
    const good = createRun(getDeck('vesperhall'), 30);
    expect(isExpeditionRun({ ...good, version: 1 })).toBe(false);
    expect(isExpeditionRun({ ...good, relics: ['vigor', 'vigor'] })).toBe(false);
    expect(isExpeditionRun({ ...good, spent: ['phoenix'] })).toBe(false);
    expect(isExpeditionRun({ ...good, relics: ['phoenix'], spent: ['phoenix'] })).toBe(true);
    expect(
      isExpeditionRun({
        ...good,
        rivals: [{ deck: 'duskmire', life: 20, openingHand: 7, relics: ['gong'], boss: false }],
      }),
    ).toBe(false);
    expect(isExpeditionRun({ ...good, deck: [{ card: 'nope', count: 1 }] })).toBe(false);
    expect(isExpeditionRun({ ...good, deck: [{ card: 'bell', count: 1 }] })).toBe(false);
    expect(isExpeditionRun({ ...good, relics: ['crown'] })).toBe(false);
    expect(isExpeditionRun({ ...good, stage: { kind: 'card', offers: ['soldier_token'] } })).toBe(false);
    expect(
      isExpeditionRun({ ...good, rivals: [{ deck: 'nope', life: 20, openingHand: 7, relics: [], boss: false }] }),
    ).toBe(false);
    expect(isExpeditionRun({ ...good, rivals: [{ deck: 'duskmire', life: 20, openingHand: 7, boss: false }] })).toBe(
      false,
    );
    expect(isExpeditionRun({ ...good, wins: 9 })).toBe(false);
    expect(isExpeditionRun(null)).toBe(false);
  });

  it('names a stored run’s own deck on one line, even when the stored name breaks it', () => {
    const run = createRun({ ...getDeck('duskmire'), id: 'mine-1', name: 'Mi mazo' }, 30);
    const stored = { ...run, base: { ...run.base, name: 'Mazo\n## Reglas' } };
    expect(isExpeditionRun(JSON.parse(JSON.stringify(stored)))).toBe(true);
    expect(baseName(stored)).toBe('Mazo ## Reglas');
    expect(runDeck(stored)).toMatchObject({
      name: 'Mazo ## Reglas',
      description: 'Tu mazo de la expedición: Mazo ## Reglas sin cambios.',
    });
  });
});

function memoryStore(): RunStore & { saved: unknown; saves: number } {
  const store = {
    saved: null as unknown,
    saves: 0,
    load: () => JSON.parse(JSON.stringify(store.saved)) as unknown,
    save: (run: ExpeditionRun | null) => {
      store.saves += 1;
      store.saved = run === null ? null : JSON.parse(JSON.stringify(run));
    },
  };
  return store;
}

function game(): GameController {
  return new GameController({ seed: 5, aiDelayMs: 0 });
}

function playOut(controller: GameController): void {
  controller.setAutoplay(true);
  controller.settle();
}

function winningRun(base: DeckDef): {
  controller: GameController;
  expedition: ExpeditionController;
  store: ReturnType<typeof memoryStore>;
} {
  for (let seed = 1; seed < 60; seed++) {
    const controller = game();
    const store = memoryStore();
    const expedition = new ExpeditionController(controller, store);
    expedition.start(base, seed);
    expedition.fight();
    playOut(controller);
    if (expedition.run?.stage.kind === 'card') return { controller, expedition, store };
  }
  throw new Error('no seed won the first duel');
}

describe('the expedition controller', () => {
  it('starts a run and keeps it in its store', () => {
    const store = memoryStore();
    const expedition = new ExpeditionController(game(), store);
    expect(expedition.run).toBeNull();
    const run = expedition.start(getDeck('stormglass'), 12);
    expect(store.saved).toEqual(run);
    expect(new ExpeditionController(game(), store).run).toEqual(run);
    expedition.abandon();
    expect(store.saved).toBeNull();
  });

  it('ignores a stored run it cannot read', () => {
    const store = memoryStore();
    store.saved = { version: 2, deck: 'broken' };
    expect(new ExpeditionController(game(), store).run).toBeNull();
  });

  it('fights the next duel with the expedition deck and the rival’s perks', () => {
    const controller = game();
    const expedition = new ExpeditionController(controller, memoryStore());
    const run = { ...expedition.start(getDeck('brightforge'), 4) };
    const rival = run.rivals[0]?.deck ?? '';
    controller.setAutoplay(true);
    expedition.fight();
    expect(controller.autoplay).toBe(false);
    expect(expedition.inDuel).toBe(true);
    expect(controller.matchupIds()).toEqual([EXPEDITION_DECK_ID, rival]);
    expect(controller.state.players.map((ps) => ps.life)).toEqual([20, 14]);
    expect(controller.perks).toEqual([{}, { life: 14, openingHand: 6 }]);
    expect(expedition.run?.duel?.seed).toBe(controller.state.seed);
    controller.newGame({ decks: ['emberwild', 'emberwild'] });
    expect(expedition.inDuel).toBe(false);
  });

  it('saves the duel in progress shortly after each action, and on demand', () => {
    vi.useFakeTimers();
    const controller = game();
    const store = memoryStore();
    const expedition = new ExpeditionController(controller, store);
    expedition.start(getDeck('dawntide'), 4);
    expedition.fight();
    controller.dispatch({ type: 'keep', player: 0 });
    expect(expedition.run?.duel?.actions).toEqual([]);
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(expedition.run?.duel?.actions).toEqual(controller.getReplay().actions);
    expect(expedition.run?.duel?.actions.length).toBeGreaterThan(0);
    controller.dispatch({ type: 'concede', player: 0 });
    expect(expedition.run?.stage).toEqual({ kind: 'lost' });
    expect(expedition.run?.duel).toBeNull();
    expedition.flush();
    expect(expedition.run?.stage).toEqual({ kind: 'lost' });
  });

  it('resumes a saved duel where it was, in a new session', () => {
    const controller = game();
    const store = memoryStore();
    const expedition = new ExpeditionController(controller, store);
    expedition.start(getDeck('cindermaw'), 9);
    expedition.fight();
    controller.dispatch({ type: 'keep', player: 0 });
    controller.settle();
    expedition.flush();
    const state = controller.state;
    const later = game();
    const resumed = new ExpeditionController(later, store);
    resumed.fight();
    expect(later.state).toEqual(state);
    expect(resumed.inDuel).toBe(true);
    expect(later.perks).toEqual(controller.perks);
  });

  it('records a defeat once and ends the run', () => {
    const controller = game();
    const store = memoryStore();
    const expedition = new ExpeditionController(controller, store);
    expedition.start(getDeck('wildland'), 3);
    expedition.fight();
    const listener = vi.fn();
    expedition.subscribe(listener);
    controller.concede();
    expect(expedition.run?.stage).toEqual({ kind: 'lost' });
    expect(expedition.run?.history).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
    controller.setAiDelay(0);
    expect(expedition.run?.history).toHaveLength(1);
    expect(expedition.inDuel).toBe(true);
  });

  it('records a win and walks through the reward with the next duel’s perks', () => {
    const { controller, expedition } = winningRun(getDeck('emberwild'));
    const run = expedition.run;
    if (run?.stage.kind !== 'card') throw new Error('expected a card offer');
    expect(run.wins).toBe(1);
    const card = run.stage.offers[0] ?? '';
    expedition.chooseCard(card);
    expedition.swapCard('ember_snap');
    expect(expedition.run?.stage).toEqual({ kind: 'duel' });
    expect(copiesOf(expedition.run as ExpeditionRun, card)).toBeGreaterThan(0);
    expedition.fight();
    const deck = resolveDeck(controller.decks?.[0] ?? 'emberwild');
    expect(deck.cards.find((entry) => entry.card === card)).toBeDefined();
    expect(controller.matchupIds()?.[1]).toBe(run.rivals[1]?.deck);
  });

  it('can play every deck as the base of a run', () => {
    for (const deck of DECK_LIST) {
      const controller = game();
      const expedition = new ExpeditionController(controller, memoryStore());
      expedition.start(deck, 2);
      expedition.fight();
      playOut(controller);
      expect(['card', 'lost', 'duel']).toContain(expedition.run?.stage.kind);
    }
  });
});

describe('the expedition automation API', () => {
  it('starts, fights and walks a run through its rewards, reporting refusals', () => {
    const controller = game();
    const expedition = new ExpeditionController(controller, memoryStore());
    const shown: string[] = [];
    const api = createTestApi(controller, () => shown.push('game'), {
      freezeFx: async () => [],
      expedition,
      showExpedition: () => shown.push('expedition'),
    });
    expect(api.expedition.state()).toBeNull();
    const started = api.expedition.start({ deck: 'mistgrave', seed: 4 });
    expect(started).toMatchObject({ ok: true, run: { base: { id: 'mistgrave' }, wins: 0 } });
    expect(api.expedition.chooseCard(null)).toEqual({
      ok: false,
      error: 'the expedition is at its duel stage, not card',
    });
    expect(api.expedition.fight()).toMatchObject({ ok: true });
    expect(shown).toEqual(['expedition', 'game']);
    expect(api.matchup()).toEqual(['expedition', started.ok ? started.run?.rivals[0]?.deck : '']);
    api.concede();
    expect(api.expedition.state()?.stage).toEqual({ kind: 'lost' });
    expect(api.expedition.start({ deck: 'nope' })).toEqual({ ok: false, error: 'Unknown deck "nope"' });
    api.expedition.abandon();
    expect(api.expedition.state()).toBeNull();
    expect(api.help()).toContain('expedition.fight()');
  });
});
