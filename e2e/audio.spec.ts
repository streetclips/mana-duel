import { expect, test, type Locator, type Page } from '@playwright/test';
import type { ScenarioSpec } from '../src/engine';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const root = (page: Page): Locator => page.locator('html');
const level = (page: Page): Promise<number> => page.evaluate(() => window.manaDuel.audio.level().rms);
const notes = (page: Page): Promise<number> => page.evaluate(() => window.manaDuel.audio.state().music.notes);
const played = (page: Page, since?: number): Promise<string[]> =>
  page.evaluate((seq) => window.manaDuel.audio.played(seq ?? undefined).map((sound) => sound.sound), since ?? null);

function setVisibility(page: Page, state: 'visible' | 'hidden'): Promise<void> {
  return page.evaluate((visibility) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

const BURN: ScenarioSpec = {
  players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'], library: ['forest', 'forest'] }, {}],
};

const LETHAL: ScenarioSpec = {
  players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, { life: 2 }],
};

const COMBAT: ScenarioSpec = {
  activePlayer: 1,
  players: [
    { hand: ['forest'], battlefield: [{ card: 'grove_tender', id: 'elf' }] },
    { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
  ],
};

const LOW_LIFE_COMBAT: ScenarioSpec = {
  activePlayer: 1,
  players: [
    { life: 9, hand: ['forest'], battlefield: [{ card: 'grove_tender', id: 'elf' }] },
    { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
  ],
};

async function castSnapAtTheAi(page: Page): Promise<void> {
  await page.getByTestId('card-snap').click();
  await page.getByTestId('sheet-cast').click();
  await page.getByTestId('player-1').click();
}

test('nothing sounds before the first tap, which starts the title music', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(root(page)).toHaveAttribute('data-audio', 'none');
  await expect(root(page)).toHaveAttribute('data-music', 'title');
  expect(await notes(page)).toBe(0);
  await page.getByTestId('seat-0').click();
  await expect(root(page)).toHaveAttribute('data-audio', 'running');
  await expect.poll(() => notes(page)).toBeGreaterThan(4);
  await expect.poll(() => level(page)).toBeGreaterThan(0.002);
  expect(errors).toEqual([]);
});

test('an agent starts the audio without a tap through manaDuel.audio.unlock()', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0');
  await page.evaluate(() => window.manaDuel.pass());
  await expect(root(page)).toHaveAttribute('data-audio', 'none');
  expect(await page.evaluate(async () => (await window.manaDuel.audio.unlock()).context)).toBe('running');
  await expect(root(page)).toHaveAttribute('data-audio', 'running');
  await expect.poll(() => notes(page)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a game plays the theme of your deck, and combat and low life change its mood', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.getByTestId('seat-0').click();
  await page.getByTestId('deck-duskmire').click();
  await page.getByTestId('btn-picker-done').click();
  await page.getByTestId('btn-play').click();
  await expect(root(page)).toHaveAttribute('data-music', 'duskmire');
  await expect(root(page)).toHaveAttribute('data-mood', 'calm');
  await page.evaluate((spec) => {
    window.manaDuel.setAiDelay(0);
    window.manaDuel.loadScenario(spec);
    window.manaDuel.settle();
  }, LOW_LIFE_COMBAT);
  await expect(root(page)).toHaveAttribute('data-music', 'neutral');
  await expect(root(page)).toHaveAttribute('data-mood', 'combat');
  await expect.poll(() => page.evaluate(() => window.manaDuel.audio.state().music.heard)).toBe('combat');
  await page.getByTestId('btn-confirm-blocks').click();
  await expect(page.getByTestId('life-0')).toHaveText('5');
  await expect(root(page)).toHaveAttribute('data-mood', 'danger');
  await expect.poll(() => level(page)).toBeGreaterThan(0.002);
  expect(errors).toEqual([]);
});

test('every action plays its sound, on the beat of its animation', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0');
  await page.evaluate((spec) => window.manaDuel.loadScenario(spec), BURN);
  await page.getByTestId('card-snap').click();
  await expect(root(page)).toHaveAttribute('data-audio', 'running');
  const cast = await page.evaluate(() => window.manaDuel.fxSeq());
  await page.getByTestId('sheet-cast').click();
  await page.getByTestId('player-1').click();
  await expect(page.getByTestId('life-1')).toHaveText('18');
  await expect.poll(async () => (await played(page, cast)).slice(0, 2)).toEqual(['cast', 'drain']);
  expect(await page.evaluate((since) => window.manaDuel.audio.played(since)[0]?.color, cast)).toBe('R');

  await page.evaluate((spec) => {
    window.manaDuel.loadScenario(spec);
    window.manaDuel.settle();
  }, COMBAT);
  const block = await page.evaluate(() => window.manaDuel.fxSeq());
  await page.getByTestId('card-elf').click();
  await page.getByTestId('btn-confirm-blocks').click();
  await page.evaluate(() => window.manaDuel.settle());
  const combat = await page.evaluate((since) => window.manaDuel.audio.played(since), block);
  expect(combat.map((sound) => sound.sound)).toEqual(expect.arrayContaining(['block', 'strike', 'dies', 'hurt']));
  const at = (name: string): number => combat.find((sound) => sound.sound === name)?.at ?? Number.NaN;
  expect(at('hurt')).toBeCloseTo(at('strike'), 3);
  expect(at('dies') - at('strike')).toBeCloseTo(0.08, 2);
  expect(at('strike')).toBeGreaterThan(at('block'));
  expect(errors).toEqual([]);
});

test('every sound and every theme renders audible, finite and unclipped through the Web Audio API', async ({ page }) => {
  await page.goto('/?seed=1&aiDelay=0');
  const renders = await page.evaluate(async () => {
    const audio = window.manaDuel.audio;
    const results: { name: string; peak: number; tail: number; finite: boolean }[] = [];
    for (const sound of audio.sounds()) results.push({ name: sound, ...(await audio.render(sound)) });
    for (const color of ['W', 'U', 'B', 'R', 'G'] as const) results.push({ name: `cast ${color}`, ...(await audio.render({ sound: 'cast', color })) });
    for (const theme of audio.themes()) {
      for (const mood of ['calm', 'danger', 'combat', 'over'] as const) {
        results.push({ name: `${theme.id} ${mood}`, ...(await audio.render({ theme: theme.id, mood })) });
      }
    }
    return { results, sounds: audio.sounds().length, themes: audio.themes().length };
  });
  expect(renders.results).toHaveLength(renders.sounds + 5 + renders.themes * 4);
  for (const render of renders.results) {
    expect.soft(render.finite, render.name).toBe(true);
    expect.soft(render.peak, render.name).toBeGreaterThan(0.02);
    expect.soft(render.peak, render.name).toBeLessThan(1);
    expect.soft(render.tail, render.name).toBeLessThan(0.001);
  }
});

test('music and sound effects turn off from the menu, stay off after a reload, and follow the URL', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0');
  await page.getByTestId('btn-menu').click();
  await expect(root(page)).toHaveAttribute('data-audio', 'running');
  await page.getByTestId('menu-music').click();
  await expect(root(page)).toHaveAttribute('data-music', 'off');
  await page.getByTestId('btn-menu').click();
  await page.getByTestId('menu-sfx').click();
  await expect(root(page)).toHaveAttribute('data-audio', 'suspended');
  expect(await level(page)).toBe(0);
  await page.reload();
  await page.getByTestId('btn-menu').click();
  await expect(page.getByTestId('menu-music')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('menu-sfx')).toHaveAttribute('aria-checked', 'false');
  await expect(root(page)).toHaveAttribute('data-audio', 'none');

  await page.goto('/?seed=1&aiDelay=0&music=on&sfx=off');
  await expect(root(page)).toHaveAttribute('data-music', 'emberwild');
  await page.evaluate((spec) => window.manaDuel.loadScenario(spec), BURN);
  await castSnapAtTheAi(page);
  await expect(root(page)).toHaveAttribute('data-audio', 'running');
  await expect(page.getByTestId('life-1')).toHaveText('18');
  await expect.poll(() => notes(page)).toBeGreaterThan(0);
  expect(await played(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('the start screen turns music and sound effects off and on', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  const music = page.getByTestId('btn-music');
  const sfx = page.getByTestId('btn-sfx');
  await expect(music).toHaveAttribute('aria-pressed', 'true');
  await expect(sfx).toHaveAttribute('aria-pressed', 'true');
  await expectNoHorizontalOverflow(page);
  await music.click();
  await expect(music).toHaveAttribute('aria-pressed', 'false');
  await expect(root(page)).toHaveAttribute('data-music', 'off');
  await sfx.click();
  await expect(sfx).toHaveAttribute('aria-pressed', 'false');
  await music.click();
  await expect(root(page)).toHaveAttribute('data-music', 'title');
  await expect(root(page)).toHaveAttribute('data-audio', 'running');
  await expect.poll(() => level(page)).toBeGreaterThan(0.002);
  expect(errors).toEqual([]);
});

test('the audio pauses while the page is hidden and goes on when it shows again', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0');
  await page.getByTestId('btn-menu').click();
  await expect(root(page)).toHaveAttribute('data-audio', 'running');
  await expect.poll(() => notes(page)).toBeGreaterThan(0);
  await setVisibility(page, 'hidden');
  await expect(root(page)).toHaveAttribute('data-audio', 'suspended');
  const paused = await notes(page);
  await page.waitForTimeout(600);
  expect(await notes(page)).toBe(paused);
  await setVisibility(page, 'visible');
  await expect(root(page)).toHaveAttribute('data-audio', 'running');
  await expect.poll(() => notes(page)).toBeGreaterThan(paused);
  expect(errors).toEqual([]);
});

test('a game ends with a victory jingle, or a defeat one when you concede', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0');
  await page.evaluate((spec) => window.manaDuel.loadScenario(spec), LETHAL);
  await castSnapAtTheAi(page);
  await expect(page.getByTestId('game-over-title')).toHaveText('Victory');
  await expect(root(page)).toHaveAttribute('data-mood', 'over');
  await expect.poll(() => played(page)).toContain('victory');
  await page.getByTestId('btn-play-again').click();
  await expect(root(page)).toHaveAttribute('data-mood', 'calm');
  await expect(page.getByTestId('prompt')).toHaveText('Keep your opening hand?');
  const seq = await page.evaluate(() => window.manaDuel.fxSeq());
  await page.getByTestId('btn-menu').click();
  await page.getByTestId('menu-concede').click();
  await expect(page.getByTestId('game-over-title')).toHaveText('Defeat');
  await expect.poll(() => played(page, seq)).toEqual(['defeat']);
  expect(errors).toEqual([]);
});
