import { useEffect, useState } from 'preact/hooks';
import type { GameController } from '../app/controller';
import { EMBERWILD, getCardDef } from '../engine';
import { cardColorVar, cssVars } from './cardInfo';
import { Game } from './Game';

export type Screen = 'start' | 'game';

interface AppProps {
  controller: GameController;
  initialScreen: Screen;
  onReady?: (showGame: () => void) => void;
}

export function App({ controller, initialScreen, onReady }: AppProps) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  useEffect(() => {
    onReady?.(() => setScreen('game'));
  }, [onReady]);

  const play = (autoplay: boolean): void => {
    controller.newGame({ autoplay });
    setScreen('game');
  };

  if (screen === 'start') return <StartScreen onPlay={() => play(false)} onWatch={() => play(true)} />;
  return (
    <Game
      controller={controller}
      onHome={() => {
        controller.pause();
        controller.setAutoplay(false);
        setScreen('start');
      }}
    />
  );
}

function StartScreen({ onPlay, onWatch }: { onPlay: () => void; onWatch: () => void }) {
  const deck = EMBERWILD;
  return (
    <main class="start" data-testid="start-screen">
      <div>
        <h1>Mana Duel</h1>
        <p class="tagline">A minimalist card duel. One deck, one opponent.</p>
        <div class="mana-dots" aria-hidden="true">
          <span style="background: var(--mana-R)" />
          <span style="background: var(--mana-G)" />
        </div>
      </div>
      <section class="deck-tile" aria-label={`${deck.name} deck`}>
        <header>
          <h2>{deck.name}</h2>
          <span class="num">40 cards</span>
        </header>
        <p>{deck.description}</p>
        <ul class="deck-list">
          {deck.cards.map((entry) => {
            const def = getCardDef(entry.card);
            return (
              <li key={entry.card}>
                <span class="count num">{entry.count}</span>
                <span class="dot" style={cssVars({ '--dot': cardColorVar(def) })} />
                <span class="name">{def.name}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <div class="start-actions">
        <button type="button" class="btn" data-testid="btn-play" onClick={onPlay}>
          Play vs AI
        </button>
        <button type="button" class="btn secondary" data-testid="btn-watch" onClick={onWatch}>
          Watch AI vs AI
        </button>
      </div>
      <details class="rules">
        <summary>How to play</summary>
        <ul>
          <li>You both start at 20 life with the same 40-card deck. Bring the AI to 0 to win.</li>
          <li>Play one land per turn. Lands pay for spells automatically.</li>
          <li>Creatures can't attack the turn they arrive, unless they have haste.</li>
          <li>Attack with your creatures; the defender picks blockers. Damage happens all at once.</li>
          <li>Instants can be cast whenever you have priority, even in response to a spell.</li>
          <li>Tap a card to see what it does. Long-press or right-click to inspect any card.</li>
        </ul>
      </details>
    </main>
  );
}
