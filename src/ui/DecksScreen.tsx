import { useState } from 'preact/hooks';
import { collectionPool, countCards, draftOf, type DeckDraft } from '../app/deckBuilding';
import { defaultDeckName, type DeckLibrary } from '../app/deckLibrary';
import { DECK_LIST, localizeDeck, type DeckDef } from '../engine';
import { DeckBox } from './components/DeckBox';
import { DeckBuilder } from './components/DeckBuilder';
import { DeckOption } from './components/DeckSelect';
import { TrashIcon } from './components/ModeIcons';
import { ScreenBar } from './components/ScreenBar';
import { decksText } from './text/decks';
import { useSubscription } from './useController';

interface DecksScreenProps {
  library: DeckLibrary;
  onHome: () => void;
}

interface Editing {
  draft: DeckDraft;
  title: string;
}

export function myDecksStatus(library: DeckLibrary): string {
  return decksText().screen.status(library.decks.length);
}

export function DecksScreen({ library, onHome }: DecksScreenProps) {
  useSubscription(library);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<DeckDef | null>(null);
  const [pool] = useState(collectionPool);
  const text = decksText().screen;

  const startFrom = (deck: DeckDef): void => {
    const draft = draftOf(deck, true);
    setEditing({ draft: { ...draft, name: library.nextName(text.copyName(deck.name)) }, title: text.copyTitle(deck.name) });
  };

  return (
    <main class="decks-screen" data-testid="decks-screen">
      <ScreenBar title={text.title} backLabel={text.back} backTestId="btn-decks-back" onBack={onHome} />
      <div class="expedition-body">
        {library.decks.length === 0 ? (
          <p class="run-intro">{text.intro}</p>
        ) : (
          <ul class="my-decks" aria-label={text.yourDecks}>
            {library.decks.map((deck) => {
              const problems = library.problems(deck);
              return (
                <li key={deck.id} class="my-deck" data-testid={`my-deck-${deck.id}`} data-playable={problems.length === 0}>
                  <span class="floor-box">
                    <DeckBox deck={deck} open={false} />
                  </span>
                  <span class="floor-text">
                    <b>{deck.name}</b>
                    <span class={problems.length > 0 ? 'problem' : undefined}>{text.deckLine(countCards(deck.cards), problems.length === 0)}</span>
                  </span>
                  <button
                    type="button"
                    class="btn secondary"
                    data-testid={`btn-edit-${deck.id}`}
                    onClick={() => setEditing({ draft: draftOf(deck), title: deck.name })}
                  >
                    {text.edit}
                  </button>
                  <button type="button" class="icon-btn" aria-label={text.deleteDeck(deck.name)} data-testid={`btn-delete-${deck.id}`} onClick={() => setDeleting(deck)}>
                    <TrashIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <section class="picker run-picker" aria-label={text.startFrom}>
          <header class="picker-head">
            <h2 class="section-label">{text.startFrom}</h2>
          </header>
          <p class="run-note">{text.startFromNote}</p>
          <div class="picker-grid" role="group" aria-label={text.gameDecks}>
            {DECK_LIST.map(localizeDeck).map((deck, index) => (
              <DeckOption key={deck.id} deck={deck} index={index} checked={false} testId={`copy-${deck.id}`} onSelect={() => startFrom(deck)} />
            ))}
          </div>
        </section>
      </div>
      <div class="start-actions">
        <button
          type="button"
          class="btn"
          data-testid="btn-new-deck"
          onClick={() => setEditing({ draft: { id: null, name: library.nextName(defaultDeckName()), featured: null, cards: [] }, title: text.newTitle })}
        >
          {text.newDeck}
        </button>
      </div>

      {editing && (
        <DeckBuilder
          key={editing.draft.id ?? editing.title}
          initial={editing.draft}
          pool={pool}
          title={editing.title}
          onSave={(draft) => {
            library.save(draft);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <div class="scrim center-modal" data-testid="deck-delete" onClick={() => setDeleting(null)}>
          <div class="modal" role="dialog" aria-label={text.deleteDeck(deleting.name)} onClick={(event) => event.stopPropagation()}>
            <h2 class="modal-title">{text.deleteQuestion(deleting.name)}</h2>
            <p>{text.deleteWarning}</p>
            <div class="sheet-actions">
              <button
                type="button"
                class="btn danger"
                data-testid="btn-delete-yes"
                onClick={() => {
                  library.remove(deleting.id);
                  setDeleting(null);
                }}
              >
                {text.confirmDelete}
              </button>
              <button type="button" class="btn secondary" data-testid="btn-delete-no" onClick={() => setDeleting(null)}>
                {text.keep}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
