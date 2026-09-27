import { render } from 'preact';
import { GameController, randomDeckId } from './app/controller';
import { createTestApi, type ManaDuelApi } from './app/testApi';
import { DEFAULT_DECK_ID, hasDeck } from './engine';
import { App, type Screen } from './ui/App';
import { RANDOM_DECK } from './ui/deckChoice';
import './ui/styles.css';

declare global {
  interface Window {
    manaDuel: ManaDuelApi;
  }
}

const params = new URLSearchParams(window.location.search);
const numberParam = (name: string): number | undefined => {
  const value = params.get(name);
  return value === null || value === '' || Number.isNaN(Number(value)) ? undefined : Number(value);
};

const theme = params.get('theme');
if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;

const deckParam = (name: string): string => {
  const value = params.get(name);
  if (value === RANDOM_DECK) return randomDeckId();
  return value && hasDeck(value) ? value : DEFAULT_DECK_ID;
};

const startingPlayer = params.get('first');
const controller = new GameController({
  seed: numberParam('seed'),
  aiDelayMs: numberParam('aiDelay'),
  autoplay: params.get('autoplay') === '1',
  skipMulligans: params.get('skipMulligan') === '1',
  startingPlayer: startingPlayer === 'you' ? 0 : startingPlayer === 'ai' ? 1 : undefined,
  decks: [deckParam('deck'), deckParam('aiDeck')],
});

const direct = ['seed', 'autoplay', 'skipMulligan', 'first', 'deck', 'aiDeck'].some((name) => params.has(name));
const initialScreen: Screen = direct ? 'game' : 'start';

let showGame = (): void => undefined;
window.manaDuel = createTestApi(controller, () => showGame());

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
render(
  <App
    controller={controller}
    initialScreen={initialScreen}
    onReady={(show) => {
      showGame = show;
    }}
  />,
  root,
);
