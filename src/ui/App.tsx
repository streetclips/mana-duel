import { useEffect, useState } from 'preact/hooks';
import { randomDeckId, type GameController } from '../app/controller';
import { getDeck, hasDeck } from '../engine';
import { DeckViewer } from './components/DeckViewer';
import { loadDeckChoice, resolveMatchup, saveDeckChoice, type DeckChoice } from './deckChoice';
import { Game } from './Game';
import { StartScreen } from './StartScreen';

export type Screen = 'start' | 'game';

interface AppProps {
  controller: GameController;
  initialScreen: Screen;
  onReady?: (showGame: () => void) => void;
}

export function App({ controller, initialScreen, onReady }: AppProps) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [choice, setChoice] = useState<DeckChoice>(loadDeckChoice);
  const [viewing, setViewing] = useState<string | null>(null);
  useEffect(() => {
    onReady?.(() => setScreen('game'));
  }, [onReady]);

  const change = (next: DeckChoice): void => {
    setChoice(next);
    saveDeckChoice(next);
  };

  const play = (autoplay: boolean): void => {
    controller.newGame({ autoplay, decks: resolveMatchup(choice, randomDeckId) });
    setViewing(null);
    setScreen('game');
  };

  if (screen === 'start') {
    const viewed = viewing && hasDeck(viewing) ? getDeck(viewing) : null;
    return (
      <>
        <StartScreen choice={choice} onChange={change} onView={setViewing} onPlay={() => play(false)} onWatch={() => play(true)} />
        {viewed && (
          <DeckViewer
            tabs={[{ key: viewed.id, label: viewed.name, deck: viewed }]}
            onClose={() => setViewing(null)}
            onChoose={(deck) => {
              change({ ...choice, deck: deck.id });
              setViewing(null);
            }}
          />
        )}
      </>
    );
  }
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
