import { useEffect, useState } from 'preact/hooks';
import { randomDeckId, type GameController } from '../app/controller';
import { getDeck, hasDeck } from '../engine';
import { SUGGESTED_MODELS, type ModelInfo } from '../llm/models';
import { DeckViewer } from './components/DeckViewer';
import { loadDeckChoice, resolveMatchup, saveDeckChoice, type DeckChoice } from './deckChoice';
import { Game } from './Game';
import {
  loadApiKey,
  loadOpponentChoice,
  opponentSetup,
  saveApiKey,
  saveOpponentChoice,
  type OpponentChoice,
} from './opponentChoice';
import { StartScreen } from './StartScreen';

export type Screen = 'start' | 'game';

interface AppProps {
  controller: GameController;
  initialScreen: Screen;
  onReady?: (showGame: () => void) => void;
  llmProxy?: boolean;
  loadModels?: () => Promise<ModelInfo[]>;
}

export function App({ controller, initialScreen, onReady, llmProxy = false, loadModels }: AppProps) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [choice, setChoice] = useState<DeckChoice>(loadDeckChoice);
  const [opponent, setOpponent] = useState<OpponentChoice>(loadOpponentChoice);
  const [apiKey, setApiKey] = useState<string>(loadApiKey);
  const [catalog, setCatalog] = useState<string[] | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  useEffect(() => {
    onReady?.(() => setScreen('game'));
  }, [onReady]);

  useEffect(() => {
    if (opponent.kind !== 'llm' || catalog || !loadModels) return;
    let live = true;
    loadModels()
      .then((models) => {
        if (live) setCatalog(models.map((model) => model.id));
      })
      .catch(() => {
        if (live) setCatalog([]);
      });
    return () => {
      live = false;
    };
  }, [opponent.kind, catalog, loadModels]);

  const change = (next: DeckChoice): void => {
    setChoice(next);
    saveDeckChoice(next);
  };

  const changeOpponent = (next: OpponentChoice): void => {
    setOpponent(next);
    saveOpponentChoice(next);
  };

  const changeKey = (key: string): void => {
    setApiKey(key);
    saveApiKey(key);
  };

  const play = (autoplay: boolean): void => {
    controller.newGame({ autoplay, decks: resolveMatchup(choice, randomDeckId), opponent: opponentSetup(opponent) });
    setViewing(null);
    setScreen('game');
  };

  if (screen === 'start') {
    const viewed = viewing && hasDeck(viewing) ? getDeck(viewing) : null;
    const models = [...new Set([...SUGGESTED_MODELS, ...(catalog ?? [])])];
    return (
      <>
        <StartScreen
          choice={choice}
          onChange={change}
          onView={setViewing}
          onPlay={() => play(false)}
          onWatch={() => play(true)}
          llm={{ choice: opponent, apiKey, proxy: llmProxy, models, onChoice: changeOpponent, onApiKey: changeKey }}
        />
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
