// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameController } from '../../src/app/controller';
import { buildDeck } from '../../src/app/deckBuilding';
import { DeckLibrary } from '../../src/app/deckLibrary';
import { EMBERWILD, getDeck, type DeckDef } from '../../src/engine';
import { setLocale, withLocale } from '../../src/i18n';
import { App } from '../../src/ui/App';
import { DeckPicker, Versus } from '../../src/ui/components/DeckSelect';
import { DeckViewer } from '../../src/ui/components/DeckViewer';
import { DEFAULT_CHOICE, type DeckChoice } from '../../src/ui/deckChoice';
import { localDeckStore } from '../../src/ui/deckLibraryStore';
import { shownText, spanishIn } from '../i18n';

beforeEach(() => setLocale('en'));

afterEach(() => {
  cleanup();
  localStorage.clear();
  setLocale('es');
});

const byTestId = (id: string): HTMLElement => screen.getByTestId(id);

function click(element: HTMLElement): void {
  fireEvent.click(element);
}

function type(id: string, value: string): void {
  fireEvent.input(byTestId(id), { target: { value } });
}

function savedInSpanish(name: string): DeckDef {
  return withLocale('es', () => buildDeck({ id: 'mine-1', name, featured: null, cards: getDeck('cindermaw').cards }, 'mine-1'));
}

function openDecks(decks: DeckDef[] = []) {
  if (decks.length > 0) localDeckStore.save(decks);
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0 });
  const library = new DeckLibrary(localDeckStore);
  const view = render(<App controller={controller} initialScreen="decks" library={library} />);
  return { library, container: view.container };
}

describe('the deck pickers in English', () => {
  it('name the seats, the decks and the random choice in English', () => {
    const custom = savedInSpanish('Night Fire');
    const library = new DeckLibrary({ load: () => [custom], save: () => undefined });
    const choice: DeckChoice = { ...DEFAULT_CHOICE, opponent: 'mine-1' };
    const { container } = render(
      <>
        <Versus choice={choice} customs={library.decks} picking={0} names={['You', 'AI']} onPick={() => undefined} />
        <DeckPicker seat={0} choice={choice} customs={library.decks} onChange={() => undefined} onView={() => undefined} onDone={() => undefined} />
      </>,
    );
    expect(byTestId('seat-0').getAttribute('aria-label')).toBe('You: Emberwild');
    expect(byTestId('versus').getAttribute('aria-label')).toBe('Matchup');
    expect(byTestId('deck-picker').getAttribute('aria-label')).toBe('Your deck');
    expect(byTestId('deck-picker').textContent).toContain('15 decks');
    expect(byTestId('btn-picker-done').textContent).toBe('Done');
    expect(byTestId('deck-detail').textContent).toContain('Red and green: fast attackers');
    expect(byTestId('deck-view-emberwild').getAttribute('aria-label')).toBe('View the cards of Emberwild');
    expect(byTestId('deck-random').querySelector('.deck-option-name')?.textContent).toBe('Random');
    expect(byTestId('deck-dawntide').textContent).toBe('Dawntide');
    expect(byTestId('picker-custom').textContent).toBe('My decks');
    expect(library.decks[0]?.description).toBe('Custom deck: 16 creatures, 8 spells, and 16 lands.');
    expect(spanishIn(shownText(container))).toEqual([]);
  });

  it('describes the random choice', () => {
    render(<DeckPicker seat={1} choice={DEFAULT_CHOICE} onChange={() => undefined} onView={() => undefined} onDone={() => undefined} />);
    expect(byTestId('deck-picker').getAttribute('aria-label')).toBe("The AI's deck");
    expect(byTestId('deck-detail').textContent).toBe('RandomA different deck every game: one of the 14, chosen at the start.');
  });
});

describe('the deck viewer in English', () => {
  it('shows the groups, the counts and the mana curve of a deck, even from its Spanish definition', () => {
    const { container } = render(<DeckViewer tabs={[{ key: 'emberwild', label: 'Emberwild', deck: EMBERWILD }]} onClose={() => undefined} />);
    expect(byTestId('deck-viewer').getAttribute('aria-label')).toBe('Deck: Emberwild');
    expect(byTestId('deck-viewer').textContent).toContain('Red and green: fast attackers, direct damage, reach, and big creatures that trample.');
    expect(byTestId('deck-stats').textContent).toBe('40 cards · 17 creatures · 7 spells · 16 lands');
    expect([...container.querySelectorAll('.deck-section h3')].map((heading) => heading.textContent)).toEqual([
      'Creatures 17',
      'Instants and sorceries 7',
      'Lands 16',
    ]);
    expect(byTestId('mana-curve').getAttribute('aria-label')).toBe(
      'Mana curve of the nonland cards: 8 costing 1, 6 costing 2, 6 costing 3, 3 costing 4, 1 costing 5+',
    );
    expect(container.querySelector('.mana-dots')?.getAttribute('aria-label')).toBe('Colors: red and green');
    expect(byTestId('btn-deck-close').getAttribute('aria-label')).toBe('Close the deck');
    expect(spanishIn(shownText(container))).toEqual([]);
    click(byTestId('deck-card-ember_snap'));
    expect(screen.getByText('2 copies in Emberwild')).toBeTruthy();
  });

  it('names the tabs of a game in English', () => {
    render(
      <DeckViewer
        tabs={[
          { key: '0', label: 'You · Emberwild', deck: getDeck('emberwild') },
          { key: '1', label: 'AI · Duskmire', deck: getDeck('duskmire') },
        ]}
        initial="1"
        onClose={() => undefined}
      />,
    );
    expect(screen.getByRole('tablist').getAttribute('aria-label')).toBe('Decks in this game');
    expect(byTestId('deck-viewer').getAttribute('aria-label')).toBe('Deck: Duskmire');
  });
});

describe('your decks in English', () => {
  it('lists your decks and copies a deck of the game with an English name', () => {
    const { container, library } = openDecks([savedInSpanish('Night Fire')]);
    expect(screen.getByRole('heading', { name: 'My decks' })).toBeTruthy();
    expect(byTestId('btn-decks-back').getAttribute('aria-label')).toBe('Back to the main menu');
    expect(byTestId('my-deck-mine-1').textContent).toContain('40 cards · ready to play');
    expect(byTestId('btn-edit-mine-1').textContent).toBe('Edit');
    expect(byTestId('btn-delete-mine-1').getAttribute('aria-label')).toBe('Delete Night Fire');
    expect(byTestId('copy-gloamwood').textContent).toBe('Gloamwood');
    expect(byTestId('btn-new-deck').textContent).toBe('New empty deck');
    expect(spanishIn(shownText(container))).toEqual([]);
    click(byTestId('btn-delete-mine-1'));
    expect(byTestId('deck-delete').textContent).toBe('Delete Night Fire?The deck will disappear from this browser.Delete the deckKeep it');
    click(byTestId('btn-delete-no'));
    click(byTestId('copy-dawntide'));
    expect((byTestId('builder-name') as HTMLInputElement).value).toBe('My Dawntide');
    expect(byTestId('deck-builder').getAttribute('aria-label')).toBe('Copy of Dawntide');
    expect(library.decks).toHaveLength(1);
  });

  it('explains what to do when you have no decks yet', () => {
    const { container } = openDecks();
    expect(byTestId('decks-screen').textContent).toContain('at least 40 cards and up to four copies of each, except basic lands');
    expect(spanishIn(shownText(container))).toEqual([]);
    click(byTestId('btn-new-deck'));
    expect((byTestId('builder-name') as HTMLInputElement).value).toBe('My deck');
    expect(byTestId('deck-builder').getAttribute('aria-label')).toBe('New deck');
  });

  it('builds a deck with problems and notes in English, searching cards by their English names', () => {
    openDecks();
    click(byTestId('copy-dawntide'));
    click(byTestId('remove-mist_sprite'));
    expect(byTestId('builder-count').textContent).toBe('39/40');
    expect(byTestId('builder-problems').textContent).toBe('1 card short: a deck has at least 40.');
    expect(byTestId('deck-builder').querySelector('.builder-summary')?.getAttribute('aria-label')).toBe('Deck summary');
    expect(byTestId('builder-tab-deck').textContent).toBe('Your deck');
    expect(byTestId('builder-tab-pool').textContent).toBe('Add cards');
    expect(byTestId('btn-builder-save').textContent).toBe('Save');
    expect(spanishIn(shownText(byTestId('deck-builder')))).toEqual([]);
    click(byTestId('builder-tab-pool'));
    expect(byTestId('builder-search').getAttribute('placeholder')).toBe('Search by name');
    expect(['all', 'creature', 'spell', 'land'].map((kind) => byTestId(`builder-kind-${kind}`).textContent)).toEqual(['All', 'Creatures', 'Spells', 'Lands']);
    type('builder-search', 'crag dragon');
    expect(byTestId('builder-results').textContent).toBe('1 card');
    expect(byTestId('remove-crag_dragon').getAttribute('aria-label')).toBe('Remove Crag Dragon');
    click(byTestId('add-crag_dragon'));
    expect(byTestId('builder-problems').textContent).toBe("Nothing in the deck makes red mana: your red cards can't be paid for.");
    type('builder-search', 'dragon del risco');
    expect(byTestId('builder-results').textContent).toBe('0 cards');
    expect(spanishIn(shownText(byTestId('deck-builder')))).toEqual([]);
    click(byTestId('btn-builder-back'));
    expect(byTestId('builder-leave').textContent).toBe("Leave without saving?You'll lose the changes to My Dawntide.Leave without savingKeep editing");
  });

  it('counts your decks on the start screen', () => {
    const library = new DeckLibrary(localDeckStore);
    const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0 });
    render(<App controller={controller} initialScreen="start" library={library} />);
    expect(byTestId('btn-my-decks-status').textContent).toBe('Build decks with the cards of every deck');
    cleanup();
    localDeckStore.save([savedInSpanish('Night Fire')]);
    render(<App controller={controller} initialScreen="start" library={new DeckLibrary(localDeckStore)} />);
    expect(byTestId('btn-my-decks-status').textContent).toBe('1 custom deck');
  });
});
