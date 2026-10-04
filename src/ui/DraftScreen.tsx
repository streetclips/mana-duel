import { useState } from 'preact/hooks';
import type { DeckLibrary } from '../app/deckLibrary';
import {
  MATCH_WINS,
  PACK_SIZE,
  ROUNDS,
  SEALED_PACKS,
  aiDraftDeck,
  allowances,
  draftDeck,
  matchWinner,
  pickNumber,
  suggestedDeck,
  type DraftFormat,
  type DraftRun,
} from '../app/draft';
import type { DraftController, GameInfo } from '../app/draftController';
import { cardColors, getCardDef, type Color, type DeckDef, type DeckEntry } from '../engine';
import { cardColorVar, cssVars, manaName } from './cardInfo';
import { MiniFace } from './components/Card';
import { DeckBox } from './components/DeckBox';
import { DeckBuilder } from './components/DeckBuilder';
import { DeckViewer } from './components/DeckViewer';
import { CardDetail } from './components/Overlays';
import { ScreenBar } from './components/ScreenBar';
import { useSubscription } from './useController';

interface DraftScreenProps {
  draft: DraftController;
  library: DeckLibrary;
  problem: string | null;
  onPlay: () => void;
  onHome: () => void;
}

const FORMATS: { format: DraftFormat; title: string; text: string }[] = [
  {
    format: 'draft',
    title: 'Draft contra la IA',
    text: `Abrís un sobre de ${PACK_SIZE} cartas cada uno, elegís una y os pasáis los sobres hasta vaciarlos; así ${ROUNDS} veces.`,
  },
  {
    format: 'sealed',
    title: 'Sellado',
    text: `Abres ${SEALED_PACKS} sobres de ${PACK_SIZE} cartas y construyes tu mazo con lo que te toque. La IA hace lo mismo.`,
  },
];

function entriesOf(cards: readonly string[]): DeckEntry[] {
  const entries: DeckEntry[] = [];
  for (const card of cards) {
    const entry = entries.find((candidate) => candidate.card === card);
    if (entry) entry.count += 1;
    else entries.push({ card, count: 1 });
  }
  return entries;
}

function poolDeck(run: DraftRun): DeckDef {
  return {
    id: 'draft-pool',
    name: 'Tus cartas',
    description: `Las ${run.picks[0].length} cartas que tienes para construir tu mazo, más las tierras básicas que quieras.`,
    colors: [],
    featured: run.picks[0][0] ?? 'forest',
    cards: entriesOf(run.picks[0]),
  };
}

function colorCounts(cards: readonly string[]): [Color, number][] {
  const counts = new Map<Color, number>();
  for (const card of cards) for (const color of cardColors(getCardDef(card))) counts.set(color, (counts.get(color) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function score(run: DraftRun): string {
  return `${run.wins[0]}-${run.wins[1]}`;
}

export function draftStatus(run: DraftRun | null): string {
  if (!run) return 'Elige cartas de sobres y juega con lo que construyas';
  const format = run.format === 'draft' ? 'Draft' : 'Sellado';
  switch (run.stage) {
    case 'picking':
      return `${format} en curso: sobre ${run.round + 1} de ${ROUNDS}`;
    case 'building':
      return `${format}: construye tu mazo`;
    case 'match':
      return `${format}: partida en curso, ${score(run)}`;
    case 'done':
      return `${format} terminado: ${matchWinner(run) === 0 ? 'ganaste' : 'perdiste'} ${score(run)}`;
  }
}

export function gameBadge(game: GameInfo): string {
  return `Draft · partida ${game.number}`;
}

export function gameOutcome(game: GameInfo): string | null {
  if (game.result === null) return null;
  const [mine, theirs] = game.wins;
  if (mine >= MATCH_WINS) return `¡Ganas el draft ${mine}-${theirs}!`;
  if (theirs >= MATCH_WINS) return `La IA gana el draft ${theirs}-${mine}.`;
  if (game.result === 'draw') return `Empate: el marcador sigue ${mine}-${theirs}.`;
  return `${game.result === 'won' ? 'Ganas' : 'Pierdes'} esta partida: ${mine}-${theirs}. Gana quien llegue a ${MATCH_WINS}.`;
}

function NewDraft({ onStart }: { onStart: (format: DraftFormat) => void }) {
  const [format, setFormat] = useState<DraftFormat>('draft');
  return (
    <>
      <div class="expedition-body" data-testid="draft-new">
        <p class="run-intro">
          Cartas nuevas en cada partida: consigue tus cartas de sobres al azar, construye un mazo de al menos 40 con las tierras básicas que quieras y
          enfréntate al mazo que la IA se haya construido, al mejor de tres partidas.
        </p>
        <div class="relic-options" role="radiogroup" aria-label="Formato">
          {FORMATS.map((option) => (
            <button
              key={option.format}
              type="button"
              role="radio"
              aria-checked={option.format === format}
              class="relic-option"
              data-testid={`draft-format-${option.format}`}
              onClick={() => setFormat(option.format)}
            >
              <span>
                <b>{option.title}</b>
                {option.text}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div class="start-actions">
        <button type="button" class="btn" data-testid="btn-draft-start" onClick={() => onStart(format)}>
          {format === 'draft' ? 'Abrir el primer sobre' : 'Abrir los sobres'}
        </button>
      </div>
    </>
  );
}

function PickSummary({ run, onView }: { run: DraftRun; onView: () => void }) {
  const picks = run.picks[0];
  return (
    <section class="run-panel draft-picks" aria-label="Tus cartas">
      <div class="run-deck">
        <span class="floor-text">
          <b data-testid="draft-pick-count">{picks.length === 1 ? '1 carta' : `${picks.length} cartas`}</b>
          <span class="color-counts">
            {colorCounts(picks).map(([color, count]) => (
              <span key={color} title={manaName(color)} style={cssVars({ '--dot': `var(--mana-${color})` })}>
                {count}
              </span>
            ))}
          </span>
        </span>
        {picks.length > 0 && (
          <button type="button" class="btn secondary" data-testid="btn-draft-picks" onClick={onView}>
            Ver tus cartas
          </button>
        )}
      </div>
    </section>
  );
}

function Picking({ run, onPick, onView }: { run: DraftRun; onPick: (card: string) => void; onView: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const pack = run.packs[0];
  const choice = selected && pack.includes(selected) ? selected : null;
  return (
    <>
      <div class="expedition-body" data-testid="draft-picking">
        <header class="reward-head">
          <p class="eyebrow num">
            Sobre {run.round + 1} de {ROUNDS} · carta {pickNumber(run)} de {PACK_SIZE}
          </p>
          <h2>Elige una carta</h2>
          <p class="run-note">La IA elige a la vez del otro sobre; después os los pasáis.</p>
        </header>
        <div class="draft-pack" role="radiogroup" aria-label="Cartas del sobre">
          {pack.map((card) => {
            const def = getCardDef(card);
            return (
              <button
                key={card}
                type="button"
                role="radio"
                aria-checked={card === choice}
                aria-label={def.name}
                class={`card mini deck-card offer${def.types.includes('land') ? ' land' : ''}`}
                style={cssVars({ '--card-color': cardColorVar(def) })}
                data-testid={`draft-card-${card}`}
                onClick={() => setSelected(card)}
              >
                <MiniFace def={def} />
              </button>
            );
          })}
        </div>
        {choice && (
          <div class="offer-detail" data-testid="draft-detail">
            <CardDetail def={getCardDef(choice)} face={null} />
          </div>
        )}
        <PickSummary run={run} onView={onView} />
      </div>
      <div class="start-actions">
        <button
          type="button"
          class="btn"
          data-testid="btn-draft-pick"
          disabled={!choice}
          onClick={() => {
            if (!choice) return;
            setSelected(null);
            onPick(choice);
          }}
        >
          {choice ? `Elegir ${getCardDef(choice).name}` : 'Toca una carta'}
        </button>
      </div>
    </>
  );
}

function GameHistory({ run }: { run: DraftRun }) {
  if (run.games.length === 0) return null;
  return (
    <ol class="run-history" aria-label="Partidas">
      {run.games.map((game, index) => (
        <li key={index} data-result={game.winner === null ? 'draw' : game.winner === 0 ? 'won' : 'lost'}>
          <span>Partida {index + 1}</span>
          <span class="num">
            {game.winner === null ? 'Empate' : game.winner === 0 ? 'Victoria' : 'Derrota'} · {game.turns} {game.turns === 1 ? 'turno' : 'turnos'}
          </span>
        </li>
      ))}
    </ol>
  );
}

interface MatchProps {
  run: DraftRun;
  problem: string | null;
  onPlay: () => void;
  onEdit: () => void;
  onView: (deck: DeckDef) => void;
}

function Match({ run, problem, onPlay, onEdit, onView }: MatchProps) {
  const deck = draftDeck(run);
  return (
    <>
      <div class="expedition-body" data-testid="draft-match">
        <header class="reward-head">
          <p class="eyebrow">Al mejor de tres</p>
          <h2 class="num" data-testid="draft-score">
            Tú {run.wins[0]} – {run.wins[1]} IA
          </h2>
        </header>
        <section class="run-panel" aria-label="Tu mazo">
          <div class="run-deck">
            <span class="floor-box">
              <DeckBox deck={deck} open={false} />
            </span>
            <span class="floor-text">
              <b>{deck.name}</b>
              <span class="num">{deck.description}</span>
            </span>
            <button type="button" class="btn secondary" data-testid="btn-draft-deck" onClick={() => onView(deck)}>
              Ver
            </button>
          </div>
        </section>
        <GameHistory run={run} />
        {problem && (
          <p class="field-hint problem" data-testid="draft-problem">
            {problem}
          </p>
        )}
      </div>
      <div class="start-actions">
        <button type="button" class="btn secondary" data-testid="btn-draft-edit" onClick={onEdit}>
          Cambiar mi mazo
        </button>
        <button type="button" class="btn" data-testid="btn-draft-play" disabled={!!problem} onClick={onPlay}>
          {run.duel ? 'Continuar la partida' : `Jugar la partida ${run.games.length + 1}`}
        </button>
      </div>
    </>
  );
}

interface DoneProps {
  run: DraftRun;
  library: DeckLibrary;
  onNew: () => void;
  onHome: () => void;
  onView: (deck: DeckDef) => void;
}

function Done({ run, library, onNew, onHome, onView }: DoneProps) {
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const won = matchWinner(run) === 0;
  return (
    <>
      <div class="expedition-body" data-testid="draft-done" data-result={won ? 'won' : 'lost'}>
        <header class="reward-head result-head">
          <h2 data-testid="draft-result-title">{won ? '¡Draft ganado!' : 'Draft perdido'}</h2>
          <p class="run-note num">
            {won ? `Ganaste ${run.wins[0]}-${run.wins[1]}` : `La IA ganó ${run.wins[1]}-${run.wins[0]}`} con {run.name}.
          </p>
        </header>
        <GameHistory run={run} />
        <div class="draft-actions">
          <button type="button" class="btn secondary" data-testid="btn-draft-deck" onClick={() => onView(draftDeck(run))}>
            Ver tu mazo
          </button>
          <button type="button" class="btn secondary" data-testid="btn-draft-ai-deck" onClick={() => onView(aiDraftDeck(run))}>
            Ver el mazo de la IA
          </button>
          <button
            type="button"
            class="btn secondary"
            data-testid="btn-draft-save"
            disabled={savedAs !== null}
            onClick={() => {
              const deck = draftDeck(run);
              const saved = library.save({ id: null, name: library.nextName(deck.name), featured: deck.featured, cards: deck.cards });
              setSavedAs(saved.name);
            }}
          >
            {savedAs ? `Guardado en Mis mazos como ${savedAs}` : 'Guardar tu mazo en Mis mazos'}
          </button>
        </div>
      </div>
      <div class="start-actions">
        <button type="button" class="btn secondary" data-testid="btn-draft-home" onClick={onHome}>
          Menú principal
        </button>
        <button type="button" class="btn" data-testid="btn-draft-new" onClick={onNew}>
          Nuevo draft
        </button>
      </div>
    </>
  );
}

export function DraftScreen({ draft, library, problem, onPlay, onHome }: DraftScreenProps) {
  useSubscription(draft);
  const run = draft.run;
  const [choosing, setChoosing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [viewing, setViewing] = useState<DeckDef | null>(null);
  const fresh = run === null || choosing;
  const stage = fresh ? 'new' : run.stage;

  let body;
  if (fresh) {
    body = (
      <NewDraft
        onStart={(format) => {
          draft.start(format);
          setChoosing(false);
        }}
      />
    );
  } else if (run.stage === 'picking') {
    body = <Picking run={run} onPick={(card) => draft.pick(card)} onView={() => setViewing(poolDeck(run))} />;
  } else if (run.stage === 'building') {
    body = (
      <>
        <div class="expedition-body" data-testid="draft-building">
          <header class="reward-head">
            <p class="eyebrow">{run.format === 'draft' ? 'Draft terminado' : 'Sobres abiertos'}</p>
            <h2>Construye tu mazo</h2>
            <p class="run-note">
              Al menos 40 cartas entre las tuyas y las tierras básicas que quieras. Te proponemos uno para empezar; cámbialo a tu gusto.
            </p>
          </header>
          <PickSummary run={run} onView={() => setViewing(poolDeck(run))} />
        </div>
        <div class="start-actions">
          <button type="button" class="btn" data-testid="btn-draft-build" onClick={() => setBuilding(true)}>
            Construir mi mazo
          </button>
        </div>
      </>
    );
  } else if (run.stage === 'match') {
    body = <Match run={run} problem={problem} onPlay={onPlay} onEdit={() => setBuilding(true)} onView={setViewing} />;
  } else {
    body = <Done run={run} library={library} onNew={() => setChoosing(true)} onHome={onHome} onView={setViewing} />;
  }

  const title = fresh || !run ? 'Draft' : run.format === 'draft' ? 'Draft' : 'Sellado';
  const detail = !fresh && run && (run.stage === 'match' || run.stage === 'done') ? score(run) : undefined;
  return (
    <main class="expedition draft" data-testid="draft" data-stage={stage}>
      <ScreenBar title={title} detail={detail} backLabel="Volver al menú principal" backTestId="btn-draft-back" onBack={onHome}>
        {!fresh && run && run.stage !== 'done' && (
          <button type="button" class="link-button" data-testid="btn-draft-abandon" onClick={() => setConfirming(true)}>
            Abandonar
          </button>
        )}
      </ScreenBar>
      {body}
      {building && run && (
        <DeckBuilder
          initial={{ id: null, name: run.name, featured: run.featured, cards: run.deck ?? suggestedDeck(run) }}
          pool={allowances(run)}
          title="Tu mazo de draft"
          saveLabel="Listo"
          requireValid
          suggest={() => suggestedDeck(run)}
          onSave={(deck) => {
            draft.saveDeck(deck);
            setBuilding(false);
          }}
          onClose={() => setBuilding(false)}
        />
      )}
      {confirming && run && (
        <div class="scrim center-modal" data-testid="draft-abandon" onClick={() => setConfirming(false)}>
          <div class="modal" role="dialog" aria-label="Abandonar el draft" onClick={(event) => event.stopPropagation()}>
            <h2 class="modal-title">¿Abandonar?</h2>
            <p>Perderás tus cartas y la partida al mejor de tres.</p>
            <div class="sheet-actions">
              <button
                type="button"
                class="btn danger"
                data-testid="btn-draft-abandon-yes"
                onClick={() => {
                  setConfirming(false);
                  draft.abandon();
                }}
              >
                Abandonar el draft
              </button>
              <button type="button" class="btn secondary" data-testid="btn-draft-abandon-no" onClick={() => setConfirming(false)}>
                Seguir
              </button>
            </div>
          </div>
        </div>
      )}
      {viewing && <DeckViewer tabs={[{ key: viewing.id, label: viewing.name, deck: viewing }]} onClose={() => setViewing(null)} />}
    </main>
  );
}
