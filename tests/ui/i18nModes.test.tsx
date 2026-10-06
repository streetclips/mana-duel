// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameController } from '../../src/app/controller';
import { DeckLibrary } from '../../src/app/deckLibrary';
import { createDraft, defaultDraftName, recordGame, saveDeck, suggestedDeck, type DraftRun } from '../../src/app/draft';
import { DraftController } from '../../src/app/draftController';
import { chooseRelic, createRun, recordDuel, type ExpeditionRun } from '../../src/app/expedition';
import { ExpeditionController } from '../../src/app/expeditionController';
import { getCardDef, getDeck } from '../../src/engine';
import { setLocale } from '../../src/i18n';
import { App, type Screen } from '../../src/ui/App';
import { draftStatus, gameBadge, gameOutcome } from '../../src/ui/DraftScreen';
import { localDraftStore } from '../../src/ui/draftStore';
import { duelBadge, duelOutcome, expeditionStatus } from '../../src/ui/ExpeditionScreen';
import { localRunStore } from '../../src/ui/expeditionStore';
import { shownText, spanishIn } from '../i18n';

beforeEach(() => {
  setLocale('en');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  setLocale('es');
});

function setupExpedition(initialScreen: Screen = 'start', run?: ExpeditionRun) {
  if (run) localRunStore.save(run);
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0 });
  const expedition = new ExpeditionController(controller, localRunStore);
  render(<App controller={controller} initialScreen={initialScreen} expedition={expedition} />);
  return { controller, expedition };
}

function setupDraft(initialScreen: Screen = 'start', run?: DraftRun) {
  if (run) localDraftStore.save(run);
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0 });
  const draft = new DraftController(controller, localDraftStore);
  const library = new DeckLibrary();
  render(<App controller={controller} initialScreen={initialScreen} draft={draft} library={library} />);
  return { controller, draft, library };
}

const byTestId = (id: string): HTMLElement => screen.getByTestId(id);

function click(element: HTMLElement): void {
  fireEvent.click(element);
}

function spanishOn(testId: string): string[] {
  return spanishIn(shownText(byTestId(testId)));
}

function ready(seed = 3): DraftRun {
  const run = createDraft('sealed', seed);
  return saveDeck(run, { id: null, name: defaultDraftName(), featured: null, cards: suggestedDeck(run) });
}

describe('the Expedition in English', () => {
  it('opens from the start screen, starts a run and shows its rivals', () => {
    setupExpedition();
    expect(byTestId('btn-expedition-status').textContent).toBe('Seven duels in a row with one deck');
    click(byTestId('btn-expedition'));
    expect(byTestId('expedition-new').textContent).toContain(
      'Seven duels in a row with the same deck, each rival tougher than the last: from the third on they carry relics',
    );
    expect(spanishOn('expedition')).toEqual([]);
    click(byTestId('expedition-deck-dawntide'));
    expect(byTestId('deck-detail').textContent).toContain('Dawntide');
    expect(byTestId('btn-expedition-start').textContent).toBe('Start with Dawntide');
    click(byTestId('btn-expedition-start'));
    expect(byTestId('expedition-floor-1').textContent).toContain('14 life · hand of 6');
    expect(byTestId('expedition-floor-7').textContent).toContain('Boss:');
    expect(byTestId('btn-expedition-fight').textContent).toBe('Fight: duel 1');
    expect(byTestId('run-deck-size').textContent).toBe('40 cards · unchanged');
    expect(spanishOn('expedition')).toEqual([]);
  });

  it('reads a boss relic in English', () => {
    const run = createRun(getDeck('dawntide'), 7);
    setupExpedition('expedition', run);
    const boss = run.rivals[6];
    const special = boss?.relics[0];
    if (!boss || !special) throw new Error('expected a boss with a relic');
    click(byTestId(`rival-relic-${special}`));
    const sheet = byTestId('relic-sheet');
    expect(sheet.textContent).toContain(`Boss relic: ${getDeck(boss.deck).name}`);
    expect(sheet.textContent).toContain('Its special ability: only bosses carry this relic.');
    expect(spanishOn('relic-sheet')).toEqual([]);
  });

  it('offers a card and swaps it into the deck in English', () => {
    const run = recordDuel(createRun(getDeck('emberwild'), 11), 'won', 9);
    const [card = ''] = run.stage.kind === 'card' ? run.stage.offers : [];
    setupExpedition('expedition', run);
    expect(byTestId('expedition-reward').textContent).toContain('Duel 1 of 7 cleared');
    expect(byTestId('expedition-reward').textContent).toContain('Choose a card for your deck');
    expect(byTestId('btn-reward-skip').textContent).toBe('Skip');
    expect(spanishOn('expedition')).toEqual([]);
    click(byTestId(`reward-card-${card}`));
    fireEvent.contextMenu(byTestId(`reward-card-${card}`));
    expect(byTestId('card-sheet').textContent).toContain('New to your deck');
    click(byTestId('card-sheet'));
    expect(byTestId('btn-reward-take').textContent).toBe('Take it');
    click(byTestId('btn-reward-take'));
    expect(byTestId('expedition-swap').textContent).toContain(`In comes ${getCardDef(card).name}`);
    expect(byTestId('expedition-swap').textContent).toContain('Which card leaves your deck?');
    expect(byTestId('btn-swap-confirm').textContent).toBe('Choose what leaves');
    expect(byTestId('btn-swap-add').textContent).toBe('Add without taking out');
    expect(spanishOn('expedition')).toEqual([]);
    click(byTestId('swap-card-ember_snap'));
    expect(byTestId('btn-swap-confirm').getAttribute('aria-label')).toBe(`Swap Ember Snap for ${getCardDef(card).name}`);
    click(byTestId('btn-swap-confirm'));
    expect(byTestId('run-deck-size').textContent).toBe('40 cards · with 1 new card');
    expect(byTestId('expedition-floor-1').textContent).toContain('Defeated');
  });

  it('offers relics and lists the one taken in English', () => {
    const run: ExpeditionRun = { ...createRun(getDeck('stormglass'), 5), wins: 3, stage: { kind: 'relic', offers: ['mask', 'censer', 'phoenix'] } };
    setupExpedition('expedition', run);
    expect(byTestId('expedition-relics').textContent).toContain('3 wins');
    expect(byTestId('relic-option-mask').textContent).toContain('Mask of Silence');
    expect(byTestId('relic-option-mask').textContent).toContain('Your opponent starts each duel with one card fewer in their opening hand.');
    expect(byTestId('relic-option-phoenix').textContent).toContain('Phoenix Feather');
    expect(byTestId('btn-relic-take').textContent).toBe('Choose a relic');
    click(byTestId('relic-option-censer'));
    expect(byTestId('btn-relic-take').textContent).toBe('Take Spore Censer');
    expect(spanishOn('expedition')).toEqual([]);
    click(byTestId('btn-relic-take'));
    expect(byTestId('relic-censer').textContent).toContain('Whenever you cast an instant or sorcery spell, create a 1/1 green Saproling creature token.');
    expect(spanishOn('expedition')).toEqual([]);
  });

  it('sums up a finished expedition in English', () => {
    let run = createRun(getDeck('gloamwood'), 6);
    run = { ...run, wins: 6, history: run.rivals.slice(0, 6).map((rival) => ({ rival: rival.deck, result: 'won' as const, turns: 9 })) };
    run = chooseRelic({ ...run, stage: { kind: 'relic', offers: ['vigor'] } }, 'vigor');
    run = recordDuel(run, 'won', 12);
    setupExpedition('expedition', run);
    expect(byTestId('expedition-result-title').textContent).toBe('Expedition complete!');
    expect(byTestId('expedition-result').textContent).toContain('You beat all 7 rivals with Gloamwood.');
    expect(byTestId('expedition-result').textContent).toContain('Win · 9 turns');
    expect(byTestId('relic-vigor').textContent).toContain('Amulet of VigorYou start each duel with 6 more life.');
    expect(byTestId('btn-expedition-new').textContent).toBe('New expedition');
    expect(spanishOn('expedition')).toEqual([]);
    click(byTestId('btn-expedition-home'));
    expect(byTestId('btn-expedition-status').textContent).toBe('Completed with Gloamwood');
  });

  it('sums up a lost expedition in English', () => {
    const run = recordDuel(createRun(getDeck('brightforge'), 4), 'lost', 5);
    const rival = getDeck(run.rivals[0]?.deck ?? '').name;
    setupExpedition('expedition', run);
    expect(byTestId('expedition-result-title').textContent).toBe('End of the expedition');
    expect(byTestId('expedition-result').textContent).toContain(`You fell in duel 1 of 7, against ${rival}.`);
    expect(byTestId('expedition-result').textContent).toContain('Loss · 5 turns');
    expect(spanishOn('expedition')).toEqual([]);
    click(byTestId('btn-expedition-home'));
    expect(byTestId('btn-expedition-status').textContent).toBe('Ended at duel 1 of 7');
  });

  it('shows a run started in Spanish under the English name of its deck, and asks before abandoning it', () => {
    setLocale('es');
    const run = createRun(getDeck('emberwild'), 3);
    setLocale('en');
    expect(run.base.name).toBe('Brasalvaje');
    setupExpedition('start', run);
    expect(byTestId('btn-expedition-status').textContent).toBe('Under way with Emberwild: 0 of 7 wins');
    click(byTestId('btn-expedition'));
    click(byTestId('btn-expedition-abandon'));
    expect(byTestId('expedition-abandon').textContent).toContain("You'll lose the expedition with Emberwild: 0 wins, 0 new cards and 0 relics.");
    expect(byTestId('btn-abandon-no').textContent).toBe('Keep going');
    expect(spanishOn('expedition')).toEqual([]);
  });

  it('labels and ends the duels of a run in English', () => {
    expect([duelBadge(1, 7, false), duelBadge(7, 7, true)]).toEqual(['Duel 1/7', 'Boss']);
    const duel = { number: 2, total: 7, rival: 'duskmire', boss: false, result: null, revived: false };
    expect(duelOutcome(duel)).toBeNull();
    expect(duelOutcome({ ...duel, result: 'won' })).toBe('Duel 2 of 7 cleared: choose your reward.');
    expect(duelOutcome({ ...duel, number: 7, result: 'won' })).toBe('You beat the boss! The expedition is yours.');
    expect(duelOutcome({ ...duel, result: 'lost' })).toBe('The expedition ends here.');
    expect(duelOutcome({ ...duel, result: 'lost', revived: true })).toBe("The Phoenix Feather burns: you'll replay this duel.");
    expect(duelOutcome({ ...duel, result: 'draw' })).toBe("Draw: you'll replay this duel.");
    expect(expeditionStatus(null)).toBe('Seven duels in a row with one deck');
  });
});

describe('the Draft in English', () => {
  it('opens from the start screen and picks from the first pack', () => {
    const { draft } = setupDraft();
    expect(byTestId('btn-draft-status').textContent).toBe('Pick cards from packs and play with what you build');
    click(byTestId('btn-draft'));
    expect(byTestId('draft-new').textContent).toContain('New cards every time');
    expect(byTestId('draft-format-draft').textContent).toContain('Draft against the AI');
    expect(byTestId('draft-format-sealed').textContent).toContain('Sealed');
    expect(byTestId('btn-draft-start').textContent).toBe('Open the first pack');
    expect(spanishOn('draft')).toEqual([]);
    click(byTestId('btn-draft-start'));
    expect(draft.run?.name).toBe('My draft');
    expect(byTestId('draft-picking').textContent).toContain('Pack 1 of 3 · card 1 of 12');
    expect(byTestId('btn-draft-pick').textContent).toBe('Tap a card');
    const card = draft.run?.packs[0][0] ?? '';
    click(byTestId(`draft-card-${card}`));
    expect(byTestId('btn-draft-pick').textContent).toBe(`Pick ${getCardDef(card).name}`);
    expect(spanishOn('draft')).toEqual([]);
    click(byTestId('btn-draft-pick'));
    expect(byTestId('draft-pick-count').textContent).toBe('1 card');
    expect(byTestId('btn-draft-picks').textContent).toBe('View your cards');
    expect(spanishOn('draft')).toEqual([]);
  });

  it('opens six packs in sealed, ready to build', () => {
    setupDraft('draft');
    click(byTestId('draft-format-sealed'));
    expect(byTestId('btn-draft-start').textContent).toBe('Open the packs');
    click(byTestId('btn-draft-start'));
    expect(byTestId('draft-building').textContent).toContain('Packs opened');
    expect(byTestId('draft-building').textContent).toContain('Build your deck');
    expect(byTestId('draft-pick-count').textContent).toBe('72 cards');
    expect(byTestId('btn-draft-build').textContent).toBe('Build my deck');
    expect(spanishOn('draft')).toEqual([]);
  });

  it('shows the match and asks before abandoning it in English', () => {
    setupDraft('draft', recordGame(ready(), 1, 10));
    expect(byTestId('draft-match').textContent).toContain('Best of three');
    expect(byTestId('draft-score').textContent).toBe('You 0 – 1 AI');
    expect(byTestId('btn-draft-play').textContent).toBe('Play game 2');
    expect(byTestId('btn-draft-edit').textContent).toBe('Change my deck');
    expect(byTestId('draft-match').textContent).toContain('Game 1');
    expect(byTestId('draft-match').textContent).toContain('Loss · 10 turns');
    expect(spanishOn('draft')).toEqual([]);
    click(byTestId('btn-draft-abandon'));
    expect(byTestId('draft-abandon').textContent).toContain("You'll lose your cards and the best-of-three match.");
    expect(byTestId('btn-draft-abandon-yes').textContent).toBe('Abandon the draft');
    expect(spanishOn('draft')).toEqual([]);
  });

  it('ends on the result and saves the deck into your decks in English', () => {
    const { library } = setupDraft('draft', recordGame(recordGame(ready(), 0, 11), 0, 13));
    expect(byTestId('draft-result-title').textContent).toBe('Draft won!');
    expect(byTestId('draft-done').textContent).toContain('You won 2-0 with My draft.');
    expect(byTestId('btn-draft-ai-deck').textContent).toBe("View the AI's deck");
    expect(spanishOn('draft')).toEqual([]);
    click(byTestId('btn-draft-save'));
    expect(library.decks.map((deck) => deck.name)).toEqual(['My draft']);
    expect(byTestId('btn-draft-save').textContent).toBe('Saved to My decks as My draft');
    click(byTestId('btn-draft-back'));
    expect(byTestId('btn-draft-status').textContent).toBe('Sealed over: you won 2-0');
  });

  it('describes the draft on the start screen and in its games in English', () => {
    const run = ready();
    expect(draftStatus(createDraft('draft', 2))).toBe('Draft under way: pack 1 of 3');
    expect(draftStatus(createDraft('sealed', 2))).toBe('Sealed: build your deck');
    expect(draftStatus(run)).toBe('Sealed: game under way, 0-0');
    expect(gameBadge({ number: 2, result: null, wins: [1, 0] })).toBe('Draft · game 2');
    expect(gameOutcome({ number: 1, result: null, wins: [0, 0] })).toBeNull();
    expect(gameOutcome({ number: 1, result: 'won', wins: [1, 0] })).toBe('You win this game: 1-0. First to 2 wins.');
    expect(gameOutcome({ number: 2, result: 'draw', wins: [1, 0] })).toBe('Draw: the score stays 1-0.');
    expect(gameOutcome({ number: 2, result: 'won', wins: [2, 0] })).toBe('You win the draft 2-0!');
    expect(gameOutcome({ number: 3, result: 'lost', wins: [1, 2] })).toBe('The AI wins the draft 2-1.');
  });
});
