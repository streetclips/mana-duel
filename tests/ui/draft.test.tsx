// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../../src/app/controller';
import { DeckLibrary } from '../../src/app/deckLibrary';
import {
  PACK_SIZE,
  aiPick,
  createDraft,
  pickCard,
  recordGame,
  saveDeck,
  suggestedDeck,
  type DraftRun,
} from '../../src/app/draft';
import { DraftController } from '../../src/app/draftController';
import { App, type Screen } from '../../src/ui/App';
import { localDraftStore } from '../../src/ui/draftStore';

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  localStorage.clear();
});

function setup(initialScreen: Screen = 'start', run?: DraftRun) {
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

function stage(): string | undefined {
  return byTestId('draft').dataset.stage;
}

function pickedAll(run: DraftRun): DraftRun {
  let next = run;
  while (next.stage === 'picking') next = pickCard(next, aiPick(next.packs[0], next.picks[0]));
  return next;
}

function ready(seed = 3): DraftRun {
  const run = createDraft('sealed', seed);
  return saveDeck(run, { id: null, name: 'Mi draft', featured: null, cards: suggestedDeck(run) });
}

describe('starting a draft', () => {
  it('opens from the start screen and opens the first pack of a draft against the AI', () => {
    const { draft } = setup();
    expect(byTestId('btn-draft-status').textContent).toBe('Elige cartas de sobres y juega con lo que construyas');
    click(byTestId('btn-draft'));
    expect(stage()).toBe('new');
    expect(byTestId('draft-format-draft').getAttribute('aria-checked')).toBe('true');
    click(byTestId('btn-draft-start'));
    expect(stage()).toBe('picking');
    expect(draft.run?.format).toBe('draft');
    expect(within(byTestId('draft-picking')).getAllByRole('radio')).toHaveLength(PACK_SIZE);
    expect(byTestId('draft-picking').textContent).toContain('Sobre 1 de 3 · carta 1 de 12');
  });

  it('opens six packs at once in sealed, ready to build', () => {
    const { draft } = setup('draft');
    click(byTestId('draft-format-sealed'));
    expect(byTestId('btn-draft-start').textContent).toBe('Abrir los sobres');
    click(byTestId('btn-draft-start'));
    expect(stage()).toBe('building');
    expect(byTestId('draft-pick-count').textContent).toBe('72 cartas');
    expect(draft.run?.format).toBe('sealed');
  });

  it('abandons a draft only after confirming', () => {
    const { draft } = setup('draft', createDraft('draft', 2));
    click(byTestId('btn-draft-abandon'));
    click(byTestId('btn-draft-abandon-no'));
    expect(draft.run).not.toBeNull();
    click(byTestId('btn-draft-abandon'));
    click(byTestId('btn-draft-abandon-yes'));
    expect(draft.run).toBeNull();
    expect(stage()).toBe('new');
  });
});

describe('picking cards', () => {
  it('takes the card you tap and shows the next pack, with your cards so far', () => {
    const { draft } = setup('draft', createDraft('draft', 7));
    const pack = draft.run?.packs[0] ?? [];
    const card = pack[2] ?? '';
    expect((byTestId('btn-draft-pick') as HTMLButtonElement).disabled).toBe(true);
    click(byTestId(`draft-card-${card}`));
    expect(byTestId(`draft-card-${card}`).getAttribute('aria-checked')).toBe('true');
    click(byTestId('btn-draft-pick'));
    expect(draft.run?.picks[0]).toEqual([card]);
    expect(byTestId('draft-picking').textContent).toContain('carta 2 de 12');
    expect(within(byTestId('draft-picking')).getAllByRole('radio')).toHaveLength(PACK_SIZE - 1);
    expect(byTestId('draft-pick-count').textContent).toBe('1 carta');
    click(byTestId('btn-draft-picks'));
    expect(byTestId('deck-viewer').dataset.deck).toBe('draft-pool');
    expect(byTestId(`deck-card-${card}`).dataset.count).toBe('1');
  });
});

describe('reading the cards of a pack', () => {
  it('opens a card in a sheet on a long press, without choosing it', () => {
    vi.useFakeTimers();
    const { draft } = setup('draft', createDraft('draft', 7));
    const [first = '', second = ''] = draft.run?.packs[0] ?? [];
    click(byTestId(`draft-card-${first}`));
    const card = byTestId(`draft-card-${second}`);
    fireEvent.pointerDown(card, { button: 0 });
    act(() => {
      vi.advanceTimersByTime(450);
    });
    fireEvent.pointerUp(card);
    click(card);
    expect(within(byTestId('card-sheet')).getByRole('dialog').getAttribute('aria-label')).toBe(
      card.getAttribute('aria-label'),
    );
    expect(card.getAttribute('aria-checked')).toBe('false');
    expect(byTestId(`draft-card-${first}`).getAttribute('aria-checked')).toBe('true');
    click(byTestId('card-sheet'));
    expect(screen.queryByTestId('card-sheet')).toBeNull();
    fireEvent.contextMenu(card);
    expect(within(byTestId('card-sheet')).getByRole('dialog').getAttribute('aria-label')).toBe(
      card.getAttribute('aria-label'),
    );
  });

  it('adds nothing to the screen when you choose a card', () => {
    const { draft } = setup('draft', createDraft('draft', 7));
    const elements = byTestId('draft').querySelectorAll('*').length;
    click(byTestId(`draft-card-${draft.run?.packs[0][3] ?? ''}`));
    expect(byTestId('draft').querySelectorAll('*').length).toBe(elements);
  });
});

describe('building and playing the match', () => {
  it('builds your deck from your cards, starting from a suggestion, and will not take an unplayable one', () => {
    const { draft } = setup('draft', pickedAll(createDraft('draft', 12)));
    expect(stage()).toBe('building');
    click(byTestId('btn-draft-build'));
    expect(byTestId('builder-count').textContent).toBe('40/40');
    const save = byTestId('btn-builder-save') as HTMLButtonElement;
    expect(save.textContent).toBe('Listo');
    expect(save.disabled).toBe(false);
    const tiles = within(byTestId('deck-builder')).getAllByTestId(/^builder-deck-/);
    const first = (tiles[0]?.dataset.testid ?? '').replace('builder-deck-', '');
    click(byTestId(`remove-${first}`));
    expect(save.disabled).toBe(true);
    click(byTestId('btn-builder-suggest'));
    expect(save.disabled).toBe(false);
    click(byTestId('builder-tab-pool'));
    const pool = within(byTestId('deck-builder')).getAllByTestId(/^builder-pool-/).length;
    expect(pool).toBe(new Set(draft.run?.picks[0]).size + 5);
    click(save);
    expect(stage()).toBe('match');
    expect(byTestId('draft-score').textContent).toBe('Tú 0 – 0 IA');
    expect(draft.run?.deck).not.toBeNull();
  });

  it('plays a game of the match and comes back to the score', () => {
    const { controller, draft } = setup('draft', ready());
    click(byTestId('btn-draft-play'));
    act(() => controller.settle());
    expect(controller.matchupIds()).toEqual(['draft', 'draft-ai']);
    expect(byTestId('duel-badge-1').textContent).toBe('Draft · partida 1');
    expect(byTestId('deck-name-1').textContent).toContain('Draft de la IA');
    click(byTestId('btn-menu'));
    expect(byTestId('menu-home').textContent).toBe('Volver al draft');
    expect(screen.queryByTestId('menu-new-game')).toBeNull();
    click(byTestId('menu-concede'));
    expect(byTestId('game-over').textContent).toContain('Pierdes esta partida: 0-1. Gana quien llegue a 2.');
    expect(byTestId('btn-mode-next').textContent).toBe('Continuar el draft');
    click(byTestId('btn-mode-continue'));
    expect(stage()).toBe('match');
    expect(byTestId('draft-score').textContent).toBe('Tú 0 – 1 IA');
    expect(byTestId('btn-draft-play').textContent).toBe('Jugar la partida 2');
    expect(draft.run?.games).toEqual([{ winner: 1, turns: controller.state.turn }]);
  });

  it('goes back to the draft in the middle of a game and resumes it', () => {
    const { controller } = setup('draft', ready());
    click(byTestId('btn-draft-play'));
    act(() => controller.settle());
    const state = controller.state;
    click(byTestId('btn-menu'));
    click(byTestId('menu-home'));
    expect(stage()).toBe('match');
    expect(byTestId('btn-draft-play').textContent).toBe('Continuar la partida');
    click(byTestId('btn-draft-play'));
    expect(controller.state).toEqual(state);
  });

  it('changes your deck between games', () => {
    const { draft } = setup('draft', recordGame(ready(), 1, 10));
    click(byTestId('btn-draft-edit'));
    click(byTestId('btn-builder-back'));
    expect(screen.queryByTestId('deck-builder')).toBeNull();
    click(byTestId('btn-draft-edit'));
    const tiles = within(byTestId('deck-builder')).getAllByTestId(/^builder-deck-/);
    const basic =
      tiles
        .map((tile) => (tile.dataset.testid ?? '').replace('builder-deck-', ''))
        .find((card) => ['plains', 'island', 'swamp', 'mountain', 'forest'].includes(card)) ?? '';
    click(byTestId(`add-${basic}`));
    click(byTestId('btn-builder-save'));
    expect(draft.run?.deck?.find((entry) => entry.card === basic)?.count).toBeGreaterThan(0);
    expect(draft.run?.stage).toBe('match');
  });

  it('ends on the result, saves your deck into your decks and starts over', () => {
    const { library } = setup('draft', recordGame(recordGame(ready(), 0, 11), 0, 13));
    expect(stage()).toBe('done');
    expect(byTestId('draft-result-title').textContent).toBe('¡Draft ganado!');
    expect(within(byTestId('draft-done')).getAllByRole('listitem')).toHaveLength(2);
    click(byTestId('btn-draft-ai-deck'));
    expect(byTestId('deck-viewer').dataset.deck).toBe('draft-ai');
    click(byTestId('btn-deck-close'));
    click(byTestId('btn-draft-save'));
    expect(library.decks.map((deck) => deck.name)).toEqual(['Mi draft']);
    expect(byTestId('btn-draft-save').textContent).toBe('Guardado en Mis mazos como Mi draft');
    expect((byTestId('btn-draft-save') as HTMLButtonElement).disabled).toBe(true);
    click(byTestId('btn-draft-new'));
    expect(stage()).toBe('new');
    click(byTestId('btn-draft-back'));
    expect(byTestId('btn-draft-status').textContent).toBe('Sellado terminado: ganaste 2-0');
  });
});
