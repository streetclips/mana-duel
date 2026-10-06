import { useMemo, useState } from 'preact/hooks';
import {
  MAX_NAME,
  MIN_DECK,
  allowanceOf,
  buildDeck,
  canAdd,
  copiesIn,
  countCards,
  deckName,
  draftNotes,
  draftProblems,
  fillWithBasics,
  searchKey,
  withCount,
  type Allowance,
  type DeckDraft,
} from '../../app/deckBuilding';
import {
  COLORS,
  cardColors,
  getCardDef,
  getCost,
  manaValue,
  type CardDef,
  type Color,
  type DeckEntry,
} from '../../engine';
import { getLocale } from '../../i18n';
import { cssVars, manaName } from '../cardInfo';
import { decksText } from '../text/decks';
import { MiniCard } from './Card';
import { DeckBox } from './DeckBox';
import { ColorDots, DeckStats, ManaCurve, deckGroups } from './DeckViewer';
import { MinusIcon, PlusIcon } from './ModeIcons';
import { CardDefSheet } from './Overlays';
import { ScreenBar } from './ScreenBar';

type Tab = 'deck' | 'pool';
type Kind = 'all' | 'creature' | 'spell' | 'land';

const KINDS: Kind[] = ['all', 'creature', 'spell', 'land'];

interface DeckBuilderProps {
  initial: DeckDraft;
  pool: readonly Allowance[];
  title: string;
  saveLabel?: string;
  requireValid?: boolean;
  suggest?: () => DeckEntry[];
  onSave: (draft: DeckDraft) => void;
  onClose: () => void;
}

function kindOf(def: CardDef): Exclude<Kind, 'all'> {
  if (def.types.includes('land')) return 'land';
  return def.types.includes('creature') ? 'creature' : 'spell';
}

function byCostThenName(a: CardDef, b: CardDef): number {
  const lands = Number(a.types.includes('land')) - Number(b.types.includes('land'));
  if (lands !== 0) return lands;
  return manaValue(getCost(a.id)) - manaValue(getCost(b.id)) || a.name.localeCompare(b.name, getLocale());
}

interface TileProps {
  def: CardDef;
  count: number;
  max: number | null;
  addable: boolean;
  testId: string;
  onAdd: () => void;
  onRemove: () => void;
  onInspect: () => void;
}

function BuilderTile({ def, count, max, addable, testId, onAdd, onRemove, onInspect }: TileProps) {
  const text = decksText().builder;
  return (
    <div class={`builder-tile${count > 0 ? ' in-deck' : ''}`} data-testid={testId} data-count={count}>
      <MiniCard def={def} label={text.view(def.name)} onTap={onInspect} onInspect={onInspect} />
      <div class="stepper">
        <button
          type="button"
          class="step"
          aria-label={text.remove(def.name)}
          data-testid={`remove-${def.id}`}
          disabled={count === 0}
          onClick={onRemove}
        >
          <MinusIcon />
        </button>
        <span class="num" aria-label={text.inDeck(count)}>
          {count}
          {max !== null && <small>/{max}</small>}
        </span>
        <button
          type="button"
          class="step"
          aria-label={text.add(def.name)}
          data-testid={`add-${def.id}`}
          disabled={!addable}
          onClick={onAdd}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}

export function DeckBuilder({
  initial,
  pool,
  title,
  saveLabel,
  requireValid = false,
  suggest,
  onSave,
  onClose,
}: DeckBuilderProps) {
  const text = decksText().builder;
  const [draft, setDraft] = useState<DeckDraft>(initial);
  const [tab, setTab] = useState<Tab>(initial.cards.length > 0 ? 'deck' : 'pool');
  const [colors, setColors] = useState<Color[]>([]);
  const [kind, setKind] = useState<Kind>('all');
  const [query, setQuery] = useState('');
  const [inspected, setInspected] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const deck = buildDeck(draft, draft.id ?? 'draft');
  const size = countCards(draft.cards);
  const problems = draftProblems(draft, pool);
  const notes = draftNotes(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const setCount = (card: string, count: number): void =>
    setDraft((current) => ({ ...current, cards: withCount(current.cards, card, count) }));
  const add = (card: string): void => {
    if (canAdd(draft.cards, pool, card)) setCount(card, copiesIn(draft.cards, card) + 1);
  };
  const remove = (card: string): void => setCount(card, Math.max(0, copiesIn(draft.cards, card) - 1));

  const locale = getLocale();
  const poolDefs = useMemo(
    () => pool.map((allowance) => getCardDef(allowance.card)).sort(byCostThenName),
    [pool, locale],
  );
  const shown = poolDefs.filter((def) => {
    if (kind !== 'all' && kindOf(def) !== kind) return false;
    if (colors.length > 0 && !cardColors(def).some((color) => colors.includes(color))) return false;
    return !query.trim() || searchKey(def.name).includes(searchKey(query.trim()));
  });

  const tile = (def: CardDef, prefix: string) => (
    <BuilderTile
      key={def.id}
      def={def}
      count={copiesIn(draft.cards, def.id)}
      max={allowanceOf(pool, def.id)?.max ?? null}
      addable={canAdd(draft.cards, pool, def.id)}
      testId={`${prefix}-${def.id}`}
      onAdd={() => add(def.id)}
      onRemove={() => remove(def.id)}
      onInspect={() => setInspected(def.id)}
    />
  );

  const inspectedDef = inspected ? getCardDef(inspected) : null;
  const leave = (): void => (dirty ? setLeaving(true) : onClose());

  return (
    <div class="builder" role="dialog" aria-label={title} data-testid="deck-builder" data-tab={tab}>
      <ScreenBar
        title={
          <input
            class="builder-name"
            type="text"
            value={draft.name}
            maxLength={MAX_NAME}
            aria-label={text.name}
            data-testid="builder-name"
            spellcheck={false}
            onInput={(event) => {
              const name = event.currentTarget.value;
              setDraft((current) => ({ ...current, name }));
            }}
          />
        }
        backLabel={text.back}
        backTestId="btn-builder-back"
        onBack={leave}
      >
        <button
          type="button"
          class="btn builder-save"
          data-testid="btn-builder-save"
          disabled={!deckName(draft.name) || (requireValid && problems.length > 0)}
          onClick={() => onSave(draft)}
        >
          {saveLabel ?? text.save}
        </button>
      </ScreenBar>

      <section class="builder-summary" aria-label={text.summary}>
        <span class="builder-box">
          <DeckBox deck={deck} open={false} />
        </span>
        <div class="builder-figures">
          <p>
            <b class={`num${size < MIN_DECK ? ' short' : ''}`} data-testid="builder-count">
              {size}/{MIN_DECK}
            </b>{' '}
            {text.cards} {deck.colors.length > 0 && <ColorDots deck={deck} />}
          </p>
          <DeckStats deck={deck} />
        </div>
        <ManaCurve deck={deck} />
      </section>

      {(problems.length > 0 || notes.length > 0) && (
        <ul class="builder-problems" data-testid="builder-problems">
          {problems.map((problem) => (
            <li key={problem} class="problem">
              {problem}
            </li>
          ))}
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      <div class="segmented builder-tabs" role="tablist" aria-label={text.sections}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'deck'}
          class={tab === 'deck' ? 'on' : ''}
          data-testid="builder-tab-deck"
          onClick={() => setTab('deck')}
        >
          {text.deckTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'pool'}
          class={tab === 'pool' ? 'on' : ''}
          data-testid="builder-tab-pool"
          onClick={() => setTab('pool')}
        >
          {text.poolTab}
        </button>
      </div>

      <div class="builder-body">
        {tab === 'deck' ? (
          <>
            {suggest && (
              <button
                type="button"
                class="btn secondary builder-fill"
                data-testid="btn-builder-suggest"
                onClick={() => setDraft((current) => ({ ...current, cards: suggest() }))}
              >
                {text.suggest}
              </button>
            )}
            {size < MIN_DECK && deck.colors.length > 0 && (
              <button
                type="button"
                class="btn secondary builder-fill"
                data-testid="btn-builder-fill"
                onClick={() => setDraft((current) => ({ ...current, cards: fillWithBasics(current.cards) }))}
              >
                {text.fill}
              </button>
            )}
            {draft.cards.length === 0 && <p class="run-note">{text.empty}</p>}
            {deckGroups(deck).map((group) => (
              <section key={group.kind} class="deck-section" aria-label={group.title}>
                <h3>
                  {group.title} <span class="num">{countCards(group.entries)}</span>
                </h3>
                <div class="builder-grid">
                  {group.entries.map((entry) => tile(getCardDef(entry.card), 'builder-deck'))}
                </div>
              </section>
            ))}
          </>
        ) : (
          <>
            <div class="builder-filters">
              <input
                class="builder-search"
                type="search"
                placeholder={text.search}
                value={query}
                aria-label={text.search}
                data-testid="builder-search"
                onInput={(event) => setQuery(event.currentTarget.value)}
              />
              <div class="chips" role="group" aria-label={text.colors}>
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    class="chip color-chip"
                    aria-pressed={colors.includes(color)}
                    aria-label={manaName(color)}
                    style={cssVars({ '--dot': `var(--mana-${color})` })}
                    data-testid={`builder-color-${color}`}
                    onClick={() =>
                      setColors((current) =>
                        current.includes(color) ? current.filter((c) => c !== color) : [...current, color],
                      )
                    }
                  />
                ))}
              </div>
              <div class="chips" role="group" aria-label={text.types}>
                {KINDS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    class="chip"
                    aria-pressed={kind === option}
                    data-testid={`builder-kind-${option}`}
                    onClick={() => setKind(option)}
                  >
                    {text.kinds[option]}
                  </button>
                ))}
              </div>
            </div>
            <p class="run-note num" data-testid="builder-results">
              {text.results(shown.length)}
            </p>
            <div class="builder-grid">{shown.map((def) => tile(def, 'builder-pool'))}</div>
          </>
        )}
      </div>

      {inspectedDef && (
        <CardDefSheet
          def={inspectedDef}
          statuses={[{ text: text.inDeck(copiesIn(draft.cards, inspectedDef.id)) }]}
          raised
          onClose={() => setInspected(null)}
        >
          <div class="sheet-actions">
            <button
              type="button"
              class="btn"
              data-testid="sheet-add"
              disabled={!canAdd(draft.cards, pool, inspectedDef.id)}
              onClick={() => add(inspectedDef.id)}
            >
              {text.addCopy}
            </button>
            <button
              type="button"
              class="btn secondary"
              data-testid="sheet-remove"
              disabled={copiesIn(draft.cards, inspectedDef.id) === 0}
              onClick={() => remove(inspectedDef.id)}
            >
              {text.removeCopy}
            </button>
            {copiesIn(draft.cards, inspectedDef.id) > 0 &&
              !inspectedDef.types.includes('land') &&
              deck.featured !== inspectedDef.id && (
                <button
                  type="button"
                  class="btn secondary"
                  data-testid="sheet-feature"
                  onClick={() => setDraft((current) => ({ ...current, featured: inspectedDef.id }))}
                >
                  {text.feature}
                </button>
              )}
          </div>
        </CardDefSheet>
      )}

      {leaving && (
        <div class="scrim center-modal raised" data-testid="builder-leave" onClick={() => setLeaving(false)}>
          <div class="modal" role="dialog" aria-label={text.leave} onClick={(event) => event.stopPropagation()}>
            <h2 class="modal-title">{text.leaveQuestion}</h2>
            <p>{text.leaveWarning(draft.name.trim())}</p>
            <div class="sheet-actions">
              <button type="button" class="btn danger" data-testid="btn-builder-discard" onClick={onClose}>
                {text.leave}
              </button>
              <button
                type="button"
                class="btn secondary"
                data-testid="btn-builder-stay"
                onClick={() => setLeaving(false)}
              >
                {text.stay}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
