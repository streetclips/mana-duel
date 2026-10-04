import { useEffect, useMemo, useState } from 'preact/hooks';
import { randomDeckId, type GameController } from '../app/controller';
import { ExpeditionController } from '../app/expeditionController';
import type { GameAudio } from '../audio';
import { getDeck, hasDeck } from '../engine';
import { SUGGESTED_MODELS, type ModelInfo } from '../llm/models';
import { saveAudioChoice } from './audioChoice';
import { DeckViewer } from './components/DeckViewer';
import type { AudioToggles } from './components/SoundToggles';
import { loadDeckChoice, resolveMatchup, saveDeckChoice, type DeckChoice } from './deckChoice';
import { ExpeditionScreen, duelBadge, duelOutcome, expeditionStatus } from './ExpeditionScreen';
import { Game, type ExpeditionDuelView } from './Game';
import {
  llmProblem,
  loadApiKey,
  loadOpponentChoice,
  opponentSetup,
  saveApiKey,
  saveOpponentChoice,
  type OpponentChoice,
} from './opponentChoice';
import { StartScreen } from './StartScreen';
import { useControllerSession, useSubscription } from './useController';

export type Screen = 'start' | 'game' | 'expedition';

interface AppProps {
  controller: GameController;
  initialScreen: Screen;
  onReady?: (show: (screen: Screen) => void) => void;
  llmProxy?: boolean;
  loadModels?: () => Promise<ModelInfo[]>;
  audio?: GameAudio;
  expedition?: ExpeditionController;
}

function audioToggles(audio: GameAudio | undefined): AudioToggles | undefined {
  if (!audio) return undefined;
  return {
    music: audio.music,
    sfx: audio.sfx,
    onToggleMusic: () => {
      saveAudioChoice({ music: !audio.music, sfx: audio.sfx });
      audio.setMusic(!audio.music);
    },
    onToggleSfx: () => {
      saveAudioChoice({ music: audio.music, sfx: !audio.sfx });
      audio.setSfx(!audio.sfx);
    },
  };
}

export function App({ controller, initialScreen, onReady, llmProxy = false, loadModels, audio, expedition: expeditionProp }: AppProps) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const expedition = useMemo(() => expeditionProp ?? new ExpeditionController(controller), [expeditionProp, controller]);
  useEffect(() => (expeditionProp ? undefined : () => expedition.dispose()), [expedition, expeditionProp]);
  useSubscription(expedition);
  useControllerSession(controller);
  const [choice, setChoice] = useState<DeckChoice>(loadDeckChoice);
  const [opponent, setOpponent] = useState<OpponentChoice>(loadOpponentChoice);
  const [apiKey, setApiKey] = useState<string>(loadApiKey);
  const [catalog, setCatalog] = useState<string[] | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  useSubscription(audio);
  useEffect(() => {
    onReady?.((next) => setScreen(next));
  }, [onReady]);

  useEffect(() => {
    audio?.setScene(screen === 'game' ? 'game' : 'title');
  }, [audio, screen]);

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

  const toggles = audioToggles(audio);
  const problem = llmProblem(opponent, apiKey, llmProxy);

  const fightExpedition = (): void => {
    expedition.fight(opponentSetup(opponent));
    setViewing(null);
    setScreen('game');
  };

  const leaveGame = (): void => {
    controller.pause();
    controller.setAutoplay(false);
    if (expedition.currentDuel) {
      expedition.flush();
      setScreen('expedition');
    } else setScreen('start');
  };

  if (screen === 'expedition') {
    return (
      <ExpeditionScreen
        expedition={expedition}
        initialDeck={choice.deck}
        problem={problem}
        onFight={fightExpedition}
        onHome={() => setScreen('start')}
      />
    );
  }

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
          audio={toggles}
          expedition={{ status: expeditionStatus(expedition.run), onOpen: () => setScreen('expedition') }}
        />
        {viewed && (
          <DeckViewer tabs={[{ key: viewed.id, label: viewed.name, deck: viewed }]} onClose={() => setViewing(null)} />
        )}
      </>
    );
  }
  const duel = expedition.currentDuel;
  const duelView: ExpeditionDuelView | undefined = duel
    ? { badge: duelBadge(duel.number, duel.total, duel.boss), outcome: duelOutcome(duel), onContinue: leaveGame }
    : undefined;
  return <Game controller={controller} audio={toggles} expedition={duelView} onHome={leaveGame} />;
}
