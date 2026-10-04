import { useState } from 'preact/hooks';
import { collectionPool, countCards, draftOf, type DeckDraft } from '../app/deckBuilding';
import { DEFAULT_DECK_NAME, type DeckLibrary } from '../app/deckLibrary';
import { DECK_LIST, type DeckDef } from '../engine';
import { DeckBox } from './components/DeckBox';
import { DeckBuilder } from './components/DeckBuilder';
import { DeckOption } from './components/DeckSelect';
import { TrashIcon } from './components/ModeIcons';
import { ScreenBar } from './components/ScreenBar';
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
  const count = library.decks.length;
  if (count === 0) return 'Crea mazos con las cartas de todos los mazos';
  return count === 1 ? '1 mazo propio' : `${count} mazos propios`;
}

export function DecksScreen({ library, onHome }: DecksScreenProps) {
  useSubscription(library);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<DeckDef | null>(null);
  const [pool] = useState(collectionPool);

  const startFrom = (deck: DeckDef): void => {
    const draft = draftOf(deck, true);
    setEditing({ draft: { ...draft, name: library.nextName(`Mi ${deck.name}`) }, title: `Copia de ${deck.name}` });
  };

  return (
    <main class="decks-screen" data-testid="decks-screen">
      <ScreenBar title="Mis mazos" backLabel="Volver al menú principal" backTestId="btn-decks-back" onBack={onHome} />
      <div class="expedition-body">
        {library.decks.length === 0 ? (
          <p class="run-intro">
            Construye tus propios mazos con las cartas de los catorce mazos del juego: al menos 40 cartas y hasta cuatro copias de cada una, salvo las
            tierras básicas. Los mazos listos para jugar aparecen al elegir tu mazo o el de la IA, y en la Expedición.
          </p>
        ) : (
          <ul class="my-decks" aria-label="Tus mazos">
            {library.decks.map((deck) => {
              const problems = library.problems(deck);
              return (
                <li key={deck.id} class="my-deck" data-testid={`my-deck-${deck.id}`} data-playable={problems.length === 0}>
                  <span class="floor-box">
                    <DeckBox deck={deck} open={false} />
                  </span>
                  <span class="floor-text">
                    <b>{deck.name}</b>
                    <span class={problems.length > 0 ? 'problem' : undefined}>
                      {countCards(deck.cards)} cartas · {problems.length > 0 ? 'incompleto' : 'listo para jugar'}
                    </span>
                  </span>
                  <button
                    type="button"
                    class="btn secondary"
                    data-testid={`btn-edit-${deck.id}`}
                    onClick={() => setEditing({ draft: draftOf(deck), title: deck.name })}
                  >
                    Editar
                  </button>
                  <button type="button" class="icon-btn" aria-label={`Borrar ${deck.name}`} data-testid={`btn-delete-${deck.id}`} onClick={() => setDeleting(deck)}>
                    <TrashIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <section class="picker run-picker" aria-label="Partir de un mazo del juego">
          <header class="picker-head">
            <h2 class="section-label">Partir de un mazo del juego</h2>
          </header>
          <p class="run-note">Toca uno para copiarlo y cambiar lo que quieras.</p>
          <div class="picker-grid" role="group" aria-label="Mazos del juego">
            {DECK_LIST.map((deck, index) => (
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
          onClick={() => setEditing({ draft: { id: null, name: library.nextName(DEFAULT_DECK_NAME), featured: null, cards: [] }, title: 'Nuevo mazo' })}
        >
          Nuevo mazo vacío
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
          <div class="modal" role="dialog" aria-label={`Borrar ${deleting.name}`} onClick={(event) => event.stopPropagation()}>
            <h2 class="modal-title">¿Borrar {deleting.name}?</h2>
            <p>El mazo desaparecerá de este navegador.</p>
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
                Borrar el mazo
              </button>
              <button type="button" class="btn secondary" data-testid="btn-delete-no" onClick={() => setDeleting(null)}>
                Conservarlo
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
