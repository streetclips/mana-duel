import { render } from 'preact';
import { GameController, randomDeckId, type LlmFactory, type OpponentSetup } from './app/controller';
import { DeckLibrary } from './app/deckLibrary';
import { DraftController } from './app/draftController';
import { ExpeditionController } from './app/expeditionController';
import { createTestApi, type ManaDuelApi } from './app/testApi';
import { GameAudio, bindAudioDataset } from './audio';
import { DEFAULT_DECK_ID, hasDeck, type DeckSpec } from './engine';
import { lazyLlmPlayer } from './llm/lazy';
import { DEFAULT_MODEL, fetchModels, isModelId, isReasoningEffort } from './llm/models';
import { App, type Screen } from './ui/App';
import { audioChoiceFrom, loadAudioChoice } from './ui/audioChoice';
import { loadAutoPass } from './ui/autoPassChoice';
import { RANDOM_DECK } from './ui/deckChoice';
import { localDeckStore } from './ui/deckLibraryStore';
import { localDraftStore } from './ui/draftStore';
import { localRunStore } from './ui/expeditionStore';
import { applyLocale, loadLocaleChoice, localeFrom } from './ui/localeChoice';
import { freezeFx } from './ui/motion';
import { loadApiKey, loadOpponentChoice } from './ui/opponentChoice';
import './ui/styles.css';

declare global {
  interface Window {
    manaDuel: ManaDuelApi;
  }
}

const params = new URLSearchParams(window.location.search);
applyLocale(localeFrom(params, loadLocaleChoice(), navigator.languages));
const numberParam = (name: string): number | undefined => {
  const value = params.get(name);
  return value === null || value === '' || Number.isNaN(Number(value)) ? undefined : Number(value);
};

const theme = params.get('theme');
if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;

const library = new DeckLibrary(localDeckStore);

const deckParam = (name: string): DeckSpec => {
  const value = params.get(name);
  if (value === RANDOM_DECK) return randomDeckId();
  if (!value) return DEFAULT_DECK_ID;
  return hasDeck(value) ? value : (library.playable().find((deck) => deck.id === value) ?? DEFAULT_DECK_ID);
};

const fxParam = params.get('fx');
const fxSpeed = fxParam === 'off' ? 0 : fxParam === 'slow' ? 0.25 : numberParam('fx');

const proxyPath: unknown = import.meta.env.VITE_OPENROUTER_PROXY;
const proxyUrl = typeof proxyPath === 'string' && proxyPath ? new URL(proxyPath, window.location.href).href : null;

const storedOpponent = loadOpponentChoice();
const modelParam = (params.get('model') ?? storedOpponent.model).trim();
const effortParam = params.get('effort') ?? storedOpponent.effort;
const opponent: OpponentSetup =
  params.get('ai') === 'llm'
    ? {
        kind: 'llm',
        model: isModelId(modelParam) ? modelParam : DEFAULT_MODEL,
        ...(isReasoningEffort(effortParam) ? { effort: effortParam } : {}),
      }
    : { kind: 'classic' };

const llmFactory: LlmFactory = (setup) =>
  lazyLlmPlayer(setup.model, async () => {
    const { openRouterFactory } = await import('./app/llmFactory');
    return openRouterFactory({ apiKey: loadApiKey, proxyUrl })(setup);
  });

const startingPlayer = params.get('first');
const autoPass = params.get('autoPass');
const controller = new GameController({
  seed: numberParam('seed'),
  aiDelayMs: numberParam('aiDelay'),
  fxSpeed,
  autoPass: autoPass === 'on' ? true : autoPass === 'off' ? false : loadAutoPass(),
  autoplay: params.get('autoplay') === '1',
  skipMulligans: params.get('skipMulligan') === '1',
  startingPlayer: startingPlayer === 'you' ? 0 : startingPlayer === 'ai' ? 1 : undefined,
  decks: [deckParam('deck'), deckParam('aiDeck')],
  opponent,
  llmFactory,
});

const direct = ['seed', 'autoplay', 'skipMulligan', 'first', 'deck', 'aiDeck', 'ai', 'model', 'effort'].some((name) =>
  params.has(name),
);
const initialScreen: Screen = direct ? 'game' : 'start';

const audio = new GameAudio({
  ...audioChoiceFrom(params, loadAudioChoice()),
  scene: initialScreen === 'start' ? 'title' : 'game',
});
audio.attach(controller);
audio.listen(window);
bindAudioDataset(audio, document.documentElement);

const expedition = new ExpeditionController(controller, localRunStore);
const draft = new DraftController(controller, localDraftStore);
const saveModes = (): void => {
  expedition.flush();
  draft.flush();
};
window.addEventListener('pagehide', saveModes);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveModes();
});

let show = (_screen: Screen): void => undefined;
window.manaDuel = createTestApi(controller, () => show('game'), {
  freezeFx,
  audio,
  expedition,
  showExpedition: () => show('expedition'),
  draft,
  showDraft: () => show('draft'),
  library,
});

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
render(
  <App
    controller={controller}
    initialScreen={initialScreen}
    onReady={(next) => {
      show = next;
    }}
    llmProxy={proxyUrl !== null}
    loadModels={fetchModels}
    audio={audio}
    expedition={expedition}
    draft={draft}
    library={library}
  />,
  root,
);
