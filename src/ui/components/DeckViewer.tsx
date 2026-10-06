import { useState } from 'preact/hooks';
import { deckSize, getCardDef, getCost, localizeDeck, manaValue, type DeckDef, type DeckEntry } from '../../engine';
import { cssVars, manaName } from '../cardInfo';
import { decksText } from '../text/decks';
import { MiniCard } from './Card';
import { CardDefSheet, CloseIcon } from './Overlays';

export interface DeckTab {
  key: string;
  label: string;
  deck: DeckDef;
}

interface DeckViewerProps {
  tabs: DeckTab[];
  initial?: string;
  onClose: () => void;
}

type GroupKind = 'creature' | 'spell' | 'land';

interface DeckGroup {
  kind: GroupKind;
  title: string;
  entries: DeckEntry[];
}

const CURVE_LABELS = ['1', '2', '3', '4', '5+'];
const CURVE_HEIGHT = 40;

function isLandEntry(entry: DeckEntry): boolean {
  return getCardDef(entry.card).types.includes('land');
}

function costOf(entry: DeckEntry): number {
  return manaValue(getCost(entry.card));
}

function countOf(entries: DeckEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.count, 0);
}

export function deckGroups(deck: DeckDef): DeckGroup[] {
  const text = decksText().viewer;
  const byCost = (entries: DeckEntry[]): DeckEntry[] => [...entries].sort((a, b) => costOf(a) - costOf(b));
  const kind = (entry: DeckEntry): GroupKind => {
    const def = getCardDef(entry.card);
    if (def.types.includes('land')) return 'land';
    return def.types.includes('creature') ? 'creature' : 'spell';
  };
  const groups: DeckGroup[] = [
    { kind: 'creature', title: text.creatures, entries: byCost(deck.cards.filter((entry) => kind(entry) === 'creature')) },
    { kind: 'spell', title: text.spells, entries: byCost(deck.cards.filter((entry) => kind(entry) === 'spell')) },
    { kind: 'land', title: text.lands, entries: deck.cards.filter((entry) => kind(entry) === 'land') },
  ];
  return groups.filter((group) => group.entries.length > 0);
}

export function manaCurve(deck: DeckDef): number[] {
  const buckets = CURVE_LABELS.map(() => 0);
  for (const entry of deck.cards) {
    if (isLandEntry(entry)) continue;
    const index = Math.min(Math.max(costOf(entry), 1), CURVE_LABELS.length) - 1;
    buckets[index] = (buckets[index] ?? 0) + entry.count;
  }
  return buckets;
}

export function ManaCurve({ deck }: { deck: DeckDef }) {
  const text = decksText().viewer;
  const curve = manaCurve(deck);
  const max = Math.max(1, ...curve);
  const steps = curve.map((count, index) => text.curveStep(count, CURVE_LABELS[index] ?? ''));
  return (
    <figure class="curve" data-testid="mana-curve" aria-label={text.curveLabel(steps)}>
      <figcaption>{text.curve}</figcaption>
      <div class="curve-plot" aria-hidden="true">
        {curve.map((count, index) => (
          <div key={CURVE_LABELS[index]} class="curve-col" title={text.curveBar(count, CURVE_LABELS[index] ?? '')}>
            <span class="curve-value num">{count}</span>
            <span class="curve-bar" style={{ height: `${Math.round((count / max) * CURVE_HEIGHT)}px` }} />
          </div>
        ))}
      </div>
      <div class="curve-axis num" aria-hidden="true">
        {CURVE_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </figure>
  );
}

export function ColorDots({ deck }: { deck: DeckDef }) {
  return (
    <span class="mana-dots" aria-label={decksText().viewer.colors(deck.colors.map(manaName))}>
      {deck.colors.map((color) => (
        <span key={color} style={cssVars({ '--dot': `var(--mana-${color})` })} />
      ))}
    </span>
  );
}

export function DeckStats({ deck }: { deck: DeckDef }) {
  const groups = deckGroups(deck);
  const count = (kind: GroupKind): number => countOf(groups.find((group) => group.kind === kind)?.entries ?? []);
  return (
    <p class="deck-stats num" data-testid="deck-stats">
      {decksText().viewer.stats(deckSize(deck), count('creature'), count('spell'), count('land'))}
    </p>
  );
}

export function DeckViewer({ tabs, initial, onClose }: DeckViewerProps) {
  const [key, setKey] = useState(initial ?? tabs[0]?.key ?? '');
  const [inspected, setInspected] = useState<string | null>(null);
  const tab = tabs.find((candidate) => candidate.key === key) ?? tabs[0];
  if (!tab) return null;
  const text = decksText().viewer;
  const deck = localizeDeck(tab.deck);
  const inspectedEntry = inspected ? deck.cards.find((entry) => entry.card === inspected) : undefined;

  return (
    <div class="deck-viewer" role="dialog" aria-label={text.dialog(deck.name)} data-testid="deck-viewer" data-deck={deck.id}>
      <header class="deck-viewer-bar">
        <button type="button" class="icon-btn" aria-label={text.close} data-testid="btn-deck-close" onClick={onClose}>
          <CloseIcon />
        </button>
        {tabs.length > 1 ? (
          <div class="segmented" role="tablist" aria-label={text.gameDecks}>
            {tabs.map((candidate) => (
              <button
                key={candidate.key}
                type="button"
                role="tab"
                aria-selected={candidate.key === tab.key}
                class={candidate.key === tab.key ? 'on' : ''}
                data-testid={`deck-tab-${candidate.key}`}
                onClick={() => {
                  setKey(candidate.key);
                  setInspected(null);
                }}
              >
                {candidate.label}
              </button>
            ))}
          </div>
        ) : (
          <span class="deck-viewer-title">{text.deck}</span>
        )}
      </header>

      <div class="deck-viewer-body">
        <div class="deck-intro">
          <div>
            <h2>
              {deck.name} <ColorDots deck={deck} />
            </h2>
            <p class="deck-description">{deck.description}</p>
            <DeckStats deck={deck} />
          </div>
          <ManaCurve deck={deck} />
        </div>

        {deckGroups(deck).map((group) => (
          <section key={group.kind} class="deck-section" aria-label={group.title}>
            <h3>
              {group.title} <span class="num">{countOf(group.entries)}</span>
            </h3>
            <div class="deck-grid">
              {group.entries.map((entry) => (
                <MiniCard
                  key={entry.card}
                  def={getCardDef(entry.card)}
                  label={`${entry.count} × ${getCardDef(entry.card).name}`}
                  testId={`deck-card-${entry.card}`}
                  count={entry.count}
                  onTap={() => setInspected(entry.card)}
                  onInspect={() => setInspected(entry.card)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {inspectedEntry && (
        <CardDefSheet
          def={getCardDef(inspectedEntry.card)}
          statuses={[{ text: text.copies(inspectedEntry.count, deck.name) }]}
          onClose={() => setInspected(null)}
        />
      )}
    </div>
  );
}
