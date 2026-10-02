import { useState } from 'preact/hooks';
import { deckSize, getCardDef, getCost, manaValue, type CardDef, type DeckDef, type DeckEntry } from '../../engine';
import { cardColorVar, cssVars, manaName } from '../cardInfo';
import { DetailFace, MiniFace } from './Card';
import { CardDetail, CloseIcon, Sheet } from './Overlays';

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

interface DeckGroup {
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
  const byCost = (entries: DeckEntry[]): DeckEntry[] => [...entries].sort((a, b) => costOf(a) - costOf(b));
  const kind = (entry: DeckEntry): 'creature' | 'spell' | 'land' => {
    const def = getCardDef(entry.card);
    if (def.types.includes('land')) return 'land';
    return def.types.includes('creature') ? 'creature' : 'spell';
  };
  return [
    { title: 'Criaturas', entries: byCost(deck.cards.filter((entry) => kind(entry) === 'creature')) },
    { title: 'Instantáneos y conjuros', entries: byCost(deck.cards.filter((entry) => kind(entry) === 'spell')) },
    { title: 'Tierras', entries: deck.cards.filter((entry) => kind(entry) === 'land') },
  ].filter((group) => group.entries.length > 0);
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

function ManaCurve({ deck }: { deck: DeckDef }) {
  const curve = manaCurve(deck);
  const max = Math.max(1, ...curve);
  const summary = curve.map((count, index) => `${count} de coste ${CURVE_LABELS[index]}`).join(', ');
  return (
    <figure class="curve" data-testid="mana-curve" aria-label={`Curva de maná de las cartas que no son tierras: ${summary}`}>
      <figcaption>Curva de maná</figcaption>
      <div class="curve-plot" aria-hidden="true">
        {curve.map((count, index) => (
          <div key={CURVE_LABELS[index]} class="curve-col" title={`${count} ${count === 1 ? 'carta' : 'cartas'} de coste ${CURVE_LABELS[index]}`}>
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
    <span class="mana-dots" aria-label={`Colores: ${deck.colors.map(manaName).join(' y ')}`}>
      {deck.colors.map((color) => (
        <span key={color} style={cssVars({ '--dot': `var(--mana-${color})` })} />
      ))}
    </span>
  );
}

function DeckStats({ deck }: { deck: DeckDef }) {
  const groups = deckGroups(deck);
  const count = (title: string): number => countOf(groups.find((group) => group.title === title)?.entries ?? []);
  return (
    <p class="deck-stats num" data-testid="deck-stats">
      {deckSize(deck)} cartas · {count('Criaturas')} criaturas · {count('Instantáneos y conjuros')} hechizos · {count('Tierras')} tierras
    </p>
  );
}

function DeckCard({ def, count, onTap }: { def: CardDef; count: number; onTap: () => void }) {
  return (
    <button
      type="button"
      class={`card mini deck-card${def.types.includes('land') ? ' land' : ''}`}
      style={cssVars({ '--card-color': cardColorVar(def) })}
      data-testid={`deck-card-${def.id}`}
      data-count={count}
      aria-label={`${count} × ${def.name}`}
      onClick={onTap}
    >
      <MiniFace def={def} />
      <span class="copies num" aria-hidden="true">
        ×{count}
      </span>
    </button>
  );
}

export function DeckViewer({ tabs, initial, onClose }: DeckViewerProps) {
  const [key, setKey] = useState(initial ?? tabs[0]?.key ?? '');
  const [inspected, setInspected] = useState<string | null>(null);
  const tab = tabs.find((candidate) => candidate.key === key) ?? tabs[0];
  if (!tab) return null;
  const { deck } = tab;
  const inspectedEntry = inspected ? deck.cards.find((entry) => entry.card === inspected) : undefined;

  return (
    <div class="deck-viewer" role="dialog" aria-label={`Mazo ${deck.name}`} data-testid="deck-viewer" data-deck={deck.id}>
      <header class="deck-viewer-bar">
        <button type="button" class="icon-btn" aria-label="Cerrar el mazo" data-testid="btn-deck-close" onClick={onClose}>
          <CloseIcon />
        </button>
        {tabs.length > 1 ? (
          <div class="segmented" role="tablist" aria-label="Mazos de esta partida">
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
          <span class="deck-viewer-title">Mazo</span>
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
          <section key={group.title} class="deck-section" aria-label={group.title}>
            <h3>
              {group.title} <span class="num">{countOf(group.entries)}</span>
            </h3>
            <div class="deck-grid">
              {group.entries.map((entry) => (
                <DeckCard key={entry.card} def={getCardDef(entry.card)} count={entry.count} onTap={() => setInspected(entry.card)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {inspectedEntry && (
        <Sheet label={getCardDef(inspectedEntry.card).name} onClose={() => setInspected(null)}>
          <CardDetail
            def={getCardDef(inspectedEntry.card)}
            face={<DetailFace def={getCardDef(inspectedEntry.card)} />}
            statuses={[{ text: `${inspectedEntry.count} ${inspectedEntry.count === 1 ? 'copia' : 'copias'} en ${deck.name}` }]}
          />
        </Sheet>
      )}
    </div>
  );
}
