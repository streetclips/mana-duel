import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { randomDeckId, type GameController } from '../app/controller';
import { DeckLibrary } from '../app/deckLibrary';
import { DraftController } from '../app/draftController';
import { ExpeditionController } from '../app/expeditionController';
import type { GameAudio } from '../audio';
import { getLocale, type Locale } from '../i18n';
import { SUGGESTED_MODELS, type ModelInfo } from '../llm/models';
import { saveAudioChoice } from './audioChoice';
import { Backdrop } from './components/Backdrop';
import { DeckViewer } from './components/DeckViewer';
import type { AudioToggles } from './components/SoundToggles';
import { chosenDeck, knownChoice, loadDeckChoice, resolveMatchup, saveDeckChoice, type DeckChoice } from './deckChoice';
import { DecksScreen, myDecksStatus } from './DecksScreen';
import { DraftScreen, draftStatus, gameBadge, gameOutcome } from './DraftScreen';
import { ExpeditionScreen, duelBadge, duelOutcome, expeditionStatus } from './ExpeditionScreen';
import { Game, type ModeView } from './Game';
import { applyLocale, saveLocaleChoice } from './localeChoice';
import { prefersReducedMotion } from './motion';
import {
  llmProblem,
  loadApiKey,
  loadOpponentChoice,
  opponentSetup,
  saveApiKey,
  saveOpponentChoice,
  type OpponentChoice,
} from './opponentChoice';
import { SCENE_MS, firstScene, loadScene, nextScene, saveScene, type SceneId } from './scenery';
import { StartScreen } from './StartScreen';
import { commonText } from './text/common';
import { useControllerSession, useSubscription } from './useController';

export type Screen = 'start' | 'game' | 'expedition' | 'decks' | 'draft';

interface AppProps {
  controller: GameController;
  initialScreen: Screen;
  onReady?: (show: (screen: Screen) => void) => void;
  llmProxy?: boolean;
  loadModels?: () => Promise<ModelInfo[]>;
  audio?: GameAudio;
  expedition?: ExpeditionController;
  draft?: DraftController;
  library?: DeckLibrary;
  pinnedScene?: SceneId | null;
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

export function App({
  controller,
  initialScreen,
  onReady,
  llmProxy = false,
  loadModels,
  audio,
  expedition: expeditionProp,
  draft: draftProp,
  library: libraryProp,
  pinnedScene = null,
}: AppProps) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [scenery, setScenery] = useState<SceneId>(() => firstScene(pinnedScene, loadScene()));
  const sceneSession = useRef<number | null>(initialScreen === 'game' ? controller.session : null);
  const expedition = useMemo(
    () => expeditionProp ?? new ExpeditionController(controller),
    [expeditionProp, controller],
  );
  useEffect(() => (expeditionProp ? undefined : () => expedition.dispose()), [expedition, expeditionProp]);
  useSubscription(expedition);
  const draft = useMemo(() => draftProp ?? new DraftController(controller), [draftProp, controller]);
  useEffect(() => (draftProp ? undefined : () => draft.dispose()), [draft, draftProp]);
  useSubscription(draft);
  const session = useControllerSession(controller);
  const library = useMemo(() => libraryProp ?? new DeckLibrary(), [libraryProp]);
  useSubscription(library);
  const customs = library.playable();
  const [storedChoice, setChoice] = useState<DeckChoice>(() => loadDeckChoice(library.playable()));
  const choice = knownChoice(storedChoice, customs);
  const [opponent, setOpponent] = useState<OpponentChoice>(loadOpponentChoice);
  const [apiKey, setApiKey] = useState<string>(loadApiKey);
  const [catalog, setCatalog] = useState<string[] | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>(getLocale);
  useSubscription(audio);
  useEffect(() => {
    onReady?.((next) => setScreen(next));
  }, [onReady]);

  useEffect(() => {
    audio?.setScene(screen === 'game' ? 'game' : 'title');
  }, [audio, screen]);

  const inGame = screen === 'game';

  useEffect(() => {
    if (!pinnedScene) saveScene(scenery);
  }, [scenery, pinnedScene]);

  useEffect(() => {
    if (!inGame || sceneSession.current === session) return;
    sceneSession.current = session;
    if (!pinnedScene) setScenery(nextScene);
  }, [inGame, session, pinnedScene]);

  useEffect(() => {
    if (inGame || pinnedScene || prefersReducedMotion()) return;
    const timer = setInterval(() => setScenery(nextScene), SCENE_MS);
    return () => clearInterval(timer);
  }, [inGame, pinnedScene]);

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

  const changeLocale = (next: Locale): void => {
    applyLocale(next);
    saveLocaleChoice(next);
    setLocale(next);
  };

  const play = (autoplay: boolean): void => {
    controller.newGame({
      autoplay,
      decks: resolveMatchup(choice, randomDeckId, customs),
      opponent: opponentSetup(opponent),
    });
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

  const playDraft = (): void => {
    draft.play(opponentSetup(opponent));
    setViewing(null);
    setScreen('game');
  };

  const leaveGame = (): void => {
    controller.pause();
    controller.setAutoplay(false);
    if (expedition.currentDuel) {
      expedition.flush();
      setScreen('expedition');
    } else if (draft.currentGame) {
      draft.flush();
      setScreen('draft');
    } else setScreen('start');
  };

  const backdrop = <Backdrop scene={scenery} mode={inGame ? 'game' : 'menu'} />;

  if (screen === 'decks') {
    return (
      <>
        {backdrop}
        <DecksScreen library={library} onHome={() => setScreen('start')} />
      </>
    );
  }

  if (screen === 'draft') {
    return (
      <>
        {backdrop}
        <DraftScreen
          draft={draft}
          library={library}
          problem={problem}
          onPlay={playDraft}
          onHome={() => setScreen('start')}
        />
      </>
    );
  }

  if (screen === 'expedition') {
    return (
      <>
        {backdrop}
        <ExpeditionScreen
          expedition={expedition}
          customs={customs}
          initialDeck={choice.deck}
          problem={problem}
          onFight={fightExpedition}
          onHome={() => setScreen('start')}
        />
      </>
    );
  }

  if (screen === 'start') {
    const viewed = viewing ? chosenDeck(viewing, customs) : null;
    const models = [...new Set([...SUGGESTED_MODELS, ...(catalog ?? [])])];
    return (
      <>
        {backdrop}
        <StartScreen
          choice={choice}
          onChange={change}
          onView={setViewing}
          onPlay={() => play(false)}
          onWatch={() => play(true)}
          llm={{ choice: opponent, apiKey, proxy: llmProxy, models, onChoice: changeOpponent, onApiKey: changeKey }}
          language={{ locale, onChange: changeLocale }}
          audio={toggles}
          customs={customs}
          expedition={{ status: expeditionStatus(expedition.run), onOpen: () => setScreen('expedition') }}
          draft={{ status: draftStatus(draft.run), onOpen: () => setScreen('draft') }}
          myDecks={{ status: myDecksStatus(library), onOpen: () => setScreen('decks') }}
        />
        {viewed && (
          <DeckViewer tabs={[{ key: viewed.id, label: viewed.name, deck: viewed }]} onClose={() => setViewing(null)} />
        )}
      </>
    );
  }
  const duel = expedition.currentDuel;
  const draftGame = draft.currentGame;
  const common = commonText();
  let mode: ModeView | undefined;
  if (duel) {
    mode = {
      badge: duelBadge(duel.number, duel.total, duel.boss),
      outcome: duelOutcome(duel),
      continueLabel: common.continueExpedition,
      homeLabel: common.backToExpedition,
      onContinue: leaveGame,
    };
  } else if (draftGame) {
    mode = {
      badge: gameBadge(draftGame),
      outcome: gameOutcome(draftGame),
      continueLabel: common.continueDraft,
      homeLabel: common.backToDraft,
      onContinue: leaveGame,
    };
  }
  return (
    <>
      {backdrop}
      <Game controller={controller} audio={toggles} mode={mode} onHome={leaveGame} />
    </>
  );
}
