// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { GameController } from '../../src/app/controller';
import { buildDeck, type DeckDraft } from '../../src/app/deckBuilding';
import { DeckLibrary } from '../../src/app/deckLibrary';
import { ExpeditionController } from '../../src/app/expeditionController';
import { DECK_LIST, getDeck, type DeckDef } from '../../src/engine';
import { App, type Screen } from '../../src/ui/App';
import { DeckViewer } from '../../src/ui/components/DeckViewer';
import { localDeckStore } from '../../src/ui/deckLibraryStore';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function setup(initialScreen: Screen = 'start', decks: DeckDef[] = []) {
  if (decks.length > 0) localDeckStore.save(decks);
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0 });
  const library = new DeckLibrary(localDeckStore);
  const expedition = new ExpeditionController(controller);
  render(<App controller={controller} initialScreen={initialScreen} library={library} expedition={expedition} />);
  return { controller, library, expedition };
}

const byTestId = (id: string): HTMLElement => screen.getByTestId(id);

function click(element: HTMLElement): void {
  fireEvent.click(element);
}

function type(id: string, value: string): void {
  fireEvent.input(byTestId(id), { target: { value } });
}

function deck(cards: DeckDraft['cards'], name = 'Mi mazo', id = 'mine-1'): DeckDef {
  return buildDeck({ id, name, featured: null, cards }, id);
}

const count = (): string => byTestId('builder-count').textContent ?? '';

describe('my decks', () => {
  it('opens from the start screen, empty at first, with every deck of the game to start from', () => {
    setup();
    expect(byTestId('btn-my-decks-status').textContent).toBe('Crea mazos con las cartas de todos los mazos');
    click(byTestId('btn-my-decks'));
    expect(byTestId('decks-screen').textContent).toContain('al menos 40 cartas');
    expect(DECK_LIST.every((candidate) => screen.queryByTestId(`copy-${candidate.id}`) !== null)).toBe(true);
    click(byTestId('btn-decks-back'));
    expect(byTestId('start-screen')).toBeTruthy();
  });

  it('copies a deck of the game, changes it and saves it', () => {
    const { library } = setup('decks');
    click(byTestId('copy-dawntide'));
    expect((byTestId('builder-name') as HTMLInputElement).value).toBe('Mi Albamar');
    expect(byTestId('deck-builder').dataset.tab).toBe('deck');
    expect(count()).toBe('40/40');
    click(byTestId('remove-mist_sprite'));
    expect(count()).toBe('39/40');
    expect(byTestId('builder-problems').textContent).toContain('Falta 1 carta: un mazo tiene al menos 40.');
    click(byTestId('builder-tab-pool'));
    type('builder-search', 'dragon del risco');
    expect(byTestId('builder-results').textContent).toBe('1 carta');
    click(byTestId('add-crag_dragon'));
    expect(count()).toBe('40/40');
    expect(byTestId('builder-problems').textContent).toBe(
      'Nada en el mazo da maná rojo: tus cartas rojas no podrán pagarse.',
    );
    type('builder-name', '\u0007');
    expect((byTestId('btn-builder-save') as HTMLButtonElement).disabled).toBe(true);
    type('builder-name', 'Cielo y fuego');
    click(byTestId('btn-builder-save'));
    expect(screen.queryByTestId('deck-builder')).toBeNull();
    expect(byTestId('my-deck-mine-1').textContent).toContain('Cielo y fuego');
    expect(byTestId('my-deck-mine-1').dataset.playable).toBe('true');
    const saved = library.get('mine-1');
    expect(saved?.cards.find((entry) => entry.card === 'crag_dragon')?.count).toBe(1);
    expect(saved?.cards.find((entry) => entry.card === 'mist_sprite')?.count).toBe(1);
    expect(saved?.colors).toEqual(['W', 'U', 'R']);
    expect(JSON.parse(localStorage.getItem('manaDuel.customDecks') ?? '[]')).toHaveLength(1);
  });

  it('builds a deck from nothing, filters the cards and fills it up with basic lands', () => {
    setup('decks');
    click(byTestId('btn-new-deck'));
    expect((byTestId('builder-name') as HTMLInputElement).value).toBe('Mi mazo');
    expect(byTestId('deck-builder').dataset.tab).toBe('pool');
    click(byTestId('builder-color-G'));
    click(byTestId('builder-kind-creature'));
    const tiles = within(byTestId('deck-builder')).getAllByTestId(/^builder-pool-/);
    expect(tiles.length).toBeGreaterThan(20);
    for (const tile of tiles.slice(0, 6)) {
      const card = (tile.dataset.testid ?? '').replace('builder-pool-', '');
      for (let i = 0; i < 4; i++) click(byTestId(`add-${card}`));
      expect(byTestId(`builder-pool-${card}`).dataset.count).toBe('4');
      expect((byTestId(`add-${card}`) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(count()).toBe('24/40');
    click(byTestId('builder-tab-deck'));
    click(byTestId('btn-builder-fill'));
    expect(count()).toBe('40/40');
    expect(byTestId('builder-deck-forest').dataset.count).toBe('16');
    expect(screen.queryByTestId('btn-builder-fill')).toBeNull();
  });

  it('asks before leaving with changes that are not saved', () => {
    const { library } = setup('decks');
    click(byTestId('copy-duskmire'));
    click(byTestId('btn-builder-back'));
    expect(screen.queryByTestId('deck-builder')).toBeNull();
    click(byTestId('copy-duskmire'));
    click(byTestId('add-gloom_wisp'));
    click(byTestId('btn-builder-back'));
    click(byTestId('btn-builder-stay'));
    expect(byTestId('deck-builder')).toBeTruthy();
    click(byTestId('btn-builder-back'));
    click(byTestId('btn-builder-discard'));
    expect(screen.queryByTestId('deck-builder')).toBeNull();
    expect(library.decks).toEqual([]);
  });

  it('opens a card to add or remove copies and to put it on the deck box', () => {
    const { library } = setup('decks');
    click(byTestId('copy-emberwild'));
    click(within(byTestId('builder-deck-cinder_adept')).getByRole('button', { name: 'Ver Adepto del ascua' }));
    const sheet = byTestId('card-sheet');
    expect(sheet.textContent).toContain('2 en el mazo');
    click(byTestId('sheet-add'));
    expect(byTestId('card-sheet').textContent).toContain('3 en el mazo');
    click(byTestId('sheet-remove'));
    click(byTestId('sheet-feature'));
    expect(screen.queryByTestId('sheet-feature')).toBeNull();
    click(byTestId('card-sheet'));
    fireEvent.contextMenu(
      within(byTestId('builder-deck-cinder_adept')).getByRole('button', { name: 'Ver Adepto del ascua' }),
    );
    expect(byTestId('card-sheet').textContent).toContain('2 en el mazo');
    click(byTestId('card-sheet'));
    click(byTestId('btn-builder-save'));
    expect(library.get('mine-1')?.featured).toBe('cinder_adept');
  });

  it('deletes a deck only after confirming', () => {
    const { library } = setup('decks', [deck(getDeck('emberwild').cards)]);
    click(byTestId('btn-delete-mine-1'));
    click(byTestId('btn-delete-no'));
    expect(library.decks).toHaveLength(1);
    click(byTestId('btn-delete-mine-1'));
    click(byTestId('btn-delete-yes'));
    expect(library.decks).toEqual([]);
    expect(screen.queryByTestId('my-deck-mine-1')).toBeNull();
  });

  it('marks a deck that cannot be played yet, and keeps it out of the pickers', () => {
    setup('start', [deck([{ card: 'forest', count: 1 }], 'A medias')]);
    expect(byTestId('btn-my-decks-status').textContent).toBe('1 mazo propio');
    click(byTestId('seat-0'));
    expect(screen.queryByTestId('deck-mine-1')).toBeNull();
    expect(screen.queryByTestId('picker-custom')).toBeNull();
    click(byTestId('btn-picker-done'));
    click(byTestId('btn-my-decks'));
    expect(byTestId('my-deck-mine-1').dataset.playable).toBe('false');
    expect(byTestId('my-deck-mine-1').textContent).toContain('1 carta · incompleto');
  });

  it('counts a small deck in the singular in the deck viewer', () => {
    const small = deck([
      { card: 'canopy_spider', count: 1 },
      { card: 'ember_snap', count: 1 },
      { card: 'forest', count: 1 },
    ]);
    render(<DeckViewer tabs={[{ key: small.id, label: small.name, deck: small }]} onClose={() => undefined} />);
    expect(byTestId('deck-stats').textContent).toBe('3 cartas · 1 criatura · 1 hechizo · 1 tierra');
  });
});

describe('playing your own decks', () => {
  it('plays one of your decks from your seat or the AI’s', () => {
    const { controller } = setup('start', [deck(getDeck('cindermaw').cards, 'Sangre y ceniza')]);
    click(byTestId('seat-0'));
    expect(byTestId('picker-custom').textContent).toBe('Mis mazos');
    click(byTestId('deck-mine-1'));
    expect(byTestId('seat-0').getAttribute('aria-label')).toBe('Tú: Sangre y ceniza');
    click(byTestId('seat-1'));
    click(byTestId('opponent-mine-1'));
    click(byTestId('btn-picker-done'));
    click(byTestId('btn-play'));
    expect(controller.matchupIds()).toEqual(['mine-1', 'mine-1']);
    expect(byTestId('deck-name-0').textContent).toContain('Sangre y ceniza');
    expect(byTestId('deck-name-1').textContent).toContain('Sangre y ceniza');
  });

  it('starts an Expedition with one of your decks', () => {
    const { expedition } = setup('expedition', [deck(getDeck('gloamwood').cards, 'Bosque oscuro')]);
    click(byTestId('expedition-deck-mine-1'));
    expect(byTestId('deck-detail').textContent).toContain('Bosque oscuro');
    click(byTestId('btn-expedition-start'));
    expect(expedition.run?.base).toMatchObject({ id: 'mine-1', name: 'Bosque oscuro' });
    expect(expedition.run?.rivals.map((rival) => rival.deck)).toHaveLength(7);
  });

  it('remembers your deck as a choice, and lets it go once the deck is deleted', () => {
    localStorage.setItem('manaDuel.decks', JSON.stringify({ deck: 'mine-1', opponent: 'duskmire' }));
    setup('start', [deck(getDeck('cindermaw').cards, 'Sangre y ceniza')]);
    expect(byTestId('seat-0').dataset.deck).toBe('mine-1');
    click(byTestId('btn-my-decks'));
    click(byTestId('btn-delete-mine-1'));
    click(byTestId('btn-delete-yes'));
    click(byTestId('btn-decks-back'));
    expect(byTestId('seat-0').dataset.deck).toBe('emberwild');
    expect(byTestId('seat-1').dataset.deck).toBe('duskmire');
  });
});
