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
import { cssVars, manaName } from './cardInfo';
import { MiniCard } from './components/Card';
import { DeckBox } from './components/DeckBox';
import { DeckBuilder } from './components/DeckBuilder';
import { DeckViewer } from './components/DeckViewer';
import { CardDefSheet } from './components/Overlays';
import { ScreenBar } from './components/ScreenBar';
import { commonText } from './text/common';
import { draftText } from './text/draft';
import { useSubscription } from './useController';

interface DraftScreenProps {
  draft: DraftController;
  library: DeckLibrary;
  problem: string | null;
  onPlay: () => void;
  onHome: () => void;
}

function formats(): { format: DraftFormat; title: string; text: string }[] {
  const text = draftText();
  return [
    { format: 'draft', title: text.draftTitle, text: text.draftText(PACK_SIZE, ROUNDS) },
    { format: 'sealed', title: text.sealedTitle, text: text.sealedText(SEALED_PACKS, PACK_SIZE) },
  ];
}

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
  const text = draftText();
  return {
    id: 'draft-pool',
    name: text.poolName,
    description: text.poolDescription(run.picks[0].length),
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
  const text = draftText();
  if (!run) return text.statusNew;
  const format = text.formats[run.format];
  switch (run.stage) {
    case 'picking':
      return text.statusPicking(format, run.round + 1, ROUNDS);
    case 'building':
      return text.statusBuilding(format);
    case 'match':
      return text.statusMatch(format, score(run));
    case 'done':
      return text.statusDone(format, matchWinner(run) === 0, score(run));
  }
}

export function gameBadge(game: GameInfo): string {
  return draftText().gameBadge(game.number);
}

export function gameOutcome(game: GameInfo): string | null {
  if (game.result === null) return null;
  const text = draftText();
  const [mine, theirs] = game.wins;
  if (mine >= MATCH_WINS) return text.matchWon(mine, theirs);
  if (theirs >= MATCH_WINS) return text.matchLost(mine, theirs);
  if (game.result === 'draw') return text.gameDrawn(mine, theirs);
  return text.gameOver(game.result === 'won', mine, theirs, MATCH_WINS);
}

function NewDraft({ onStart }: { onStart: (format: DraftFormat) => void }) {
  const text = draftText();
  const [format, setFormat] = useState<DraftFormat>('draft');
  return (
    <>
      <div class="expedition-body" data-testid="draft-new">
        <p class="run-intro">{text.intro}</p>
        <div class="relic-options" role="radiogroup" aria-label={text.format}>
          {formats().map((option) => (
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
          {format === 'draft' ? text.openFirstPack : text.openPacks}
        </button>
      </div>
    </>
  );
}

function PickSummary({ run, onView }: { run: DraftRun; onView: () => void }) {
  const text = draftText();
  const picks = run.picks[0];
  return (
    <section class="run-panel draft-picks" aria-label={text.yourCards}>
      <div class="run-deck">
        <span class="floor-text">
          <b data-testid="draft-pick-count">{text.cardCount(picks.length)}</b>
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
            {text.viewYourCards}
          </button>
        )}
      </div>
    </section>
  );
}

function Picking({ run, onPick, onView }: { run: DraftRun; onPick: (card: string) => void; onView: () => void }) {
  const text = draftText();
  const [selected, setSelected] = useState<string | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const pack = run.packs[0];
  const choice = selected && pack.includes(selected) ? selected : null;
  return (
    <>
      <div class="expedition-body" data-testid="draft-picking">
        <header class="reward-head">
          <p class="eyebrow num">{text.pickEyebrow(run.round + 1, ROUNDS, pickNumber(run), PACK_SIZE)}</p>
          <h2>{text.chooseCard}</h2>
          <p class="run-note">{text.pickNote}</p>
        </header>
        <div class="draft-pack" role="radiogroup" aria-label={text.packCards}>
          {pack.map((card) => (
            <MiniCard
              key={card}
              def={getCardDef(card)}
              label={getCardDef(card).name}
              className="offer"
              testId={`draft-card-${card}`}
              checked={card === choice}
              onTap={() => setSelected(card)}
              onInspect={() => setInspected(card)}
            />
          ))}
        </div>
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
          {choice ? text.pick(getCardDef(choice).name) : text.tapCard}
        </button>
      </div>
      {inspected && <CardDefSheet def={getCardDef(inspected)} onClose={() => setInspected(null)} />}
    </>
  );
}

function GameHistory({ run }: { run: DraftRun }) {
  if (run.games.length === 0) return null;
  const text = draftText();
  return (
    <ol class="run-history" aria-label={text.games}>
      {run.games.map((game, index) => (
        <li key={index} data-result={game.winner === null ? 'draw' : game.winner === 0 ? 'won' : 'lost'}>
          <span>{text.game(index + 1)}</span>
          <span class="num">
            {game.winner === null ? text.draw : game.winner === 0 ? text.win : text.loss} · {text.turns(game.turns)}
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
  const text = draftText();
  const common = commonText();
  const deck = draftDeck(run);
  return (
    <>
      <div class="expedition-body" data-testid="draft-match">
        <header class="reward-head">
          <p class="eyebrow">{text.bestOfThree}</p>
          <h2 class="num" data-testid="draft-score">
            {common.you} {run.wins[0]} – {run.wins[1]} {common.ai}
          </h2>
        </header>
        <section class="run-panel" aria-label={text.yourDeck}>
          <div class="run-deck">
            <span class="floor-box">
              <DeckBox deck={deck} open={false} />
            </span>
            <span class="floor-text">
              <b>{deck.name}</b>
              <span class="num">{deck.description}</span>
            </span>
            <button type="button" class="btn secondary" data-testid="btn-draft-deck" onClick={() => onView(deck)}>
              {text.view}
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
          {text.changeDeck}
        </button>
        <button type="button" class="btn" data-testid="btn-draft-play" disabled={!!problem} onClick={onPlay}>
          {run.duel ? text.continueGame : text.playGame(run.games.length + 1)}
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
  const text = draftText();
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const won = matchWinner(run) === 0;
  return (
    <>
      <div class="expedition-body" data-testid="draft-done" data-result={won ? 'won' : 'lost'}>
        <header class="reward-head result-head">
          <h2 data-testid="draft-result-title">{won ? text.wonTitle : text.lostTitle}</h2>
          <p class="run-note num">{text.resultNote(won, run.wins[0], run.wins[1], run.name)}</p>
        </header>
        <GameHistory run={run} />
        <div class="draft-actions">
          <button type="button" class="btn secondary" data-testid="btn-draft-deck" onClick={() => onView(draftDeck(run))}>
            {text.viewYourDeck}
          </button>
          <button type="button" class="btn secondary" data-testid="btn-draft-ai-deck" onClick={() => onView(aiDraftDeck(run))}>
            {text.viewAiDeck}
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
            {savedAs ? text.savedAs(savedAs) : text.saveDeck}
          </button>
        </div>
      </div>
      <div class="start-actions">
        <button type="button" class="btn secondary" data-testid="btn-draft-home" onClick={onHome}>
          {text.mainMenu}
        </button>
        <button type="button" class="btn" data-testid="btn-draft-new" onClick={onNew}>
          {text.newDraft}
        </button>
      </div>
    </>
  );
}

export function DraftScreen({ draft, library, problem, onPlay, onHome }: DraftScreenProps) {
  useSubscription(draft);
  const text = draftText();
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
            <p class="eyebrow">{run.format === 'draft' ? text.draftOver : text.packsOpened}</p>
            <h2>{text.buildTitle}</h2>
            <p class="run-note">{text.buildNote}</p>
          </header>
          <PickSummary run={run} onView={() => setViewing(poolDeck(run))} />
        </div>
        <div class="start-actions">
          <button type="button" class="btn" data-testid="btn-draft-build" onClick={() => setBuilding(true)}>
            {text.build}
          </button>
        </div>
      </>
    );
  } else if (run.stage === 'match') {
    body = <Match run={run} problem={problem} onPlay={onPlay} onEdit={() => setBuilding(true)} onView={setViewing} />;
  } else {
    body = <Done run={run} library={library} onNew={() => setChoosing(true)} onHome={onHome} onView={setViewing} />;
  }

  const title = fresh || !run ? text.formats.draft : text.formats[run.format];
  const detail = !fresh && run && (run.stage === 'match' || run.stage === 'done') ? score(run) : undefined;
  return (
    <main class="expedition draft" data-testid="draft" data-stage={stage}>
      <ScreenBar title={title} detail={detail} backLabel={text.backToMenu} backTestId="btn-draft-back" onBack={onHome}>
        {!fresh && run && run.stage !== 'done' && (
          <button type="button" class="link-button" data-testid="btn-draft-abandon" onClick={() => setConfirming(true)}>
            {text.abandon}
          </button>
        )}
      </ScreenBar>
      {body}
      {building && run && (
        <DeckBuilder
          initial={{ id: null, name: run.name, featured: run.featured, cards: run.deck ?? suggestedDeck(run) }}
          pool={allowances(run)}
          title={text.builderTitle}
          saveLabel={text.builderSave}
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
          <div class="modal" role="dialog" aria-label={text.abandonDraft} onClick={(event) => event.stopPropagation()}>
            <h2 class="modal-title">{text.abandonTitle}</h2>
            <p>{text.abandonWarning}</p>
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
                {text.abandonDraft}
              </button>
              <button type="button" class="btn secondary" data-testid="btn-draft-abandon-no" onClick={() => setConfirming(false)}>
                {text.keepGoing}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewing && <DeckViewer tabs={[{ key: viewing.id, label: viewing.name, deck: viewing }]} onClose={() => setViewing(null)} />}
    </main>
  );
}
