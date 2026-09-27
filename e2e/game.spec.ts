import { expect, test, type Page } from '@playwright/test';

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

test('the start screen leads into a game', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mana Duel' })).toBeVisible();
  await expect(page.getByTestId('start-screen')).toContainText('Emberwild');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('prompt')).toHaveText('Keep your opening hand?');
  await expect(page.getByTestId('hand').getByRole('button')).toHaveCount(7);
  expect(errors).toEqual([]);
});

test('a human turn can be played with taps only', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=7&first=you&aiDelay=0');
  await page.getByTestId('btn-keep').click();
  await expect(page.getByTestId('prompt')).toHaveText('Your main phase');

  const land = page.locator('[data-testid="hand"] [data-def="mountain"], [data-testid="hand"] [data-def="forest"]').first();
  const landId = await land.getAttribute('data-card');
  await land.click();
  await page.getByTestId('sheet-playLand').click();
  await expect(page.getByTestId('lands-0').locator(`[data-card="${landId}"]`)).toBeVisible();

  await page.getByTestId('btn-end-turn').click();
  await expect(page.getByTestId('phase')).toContainText('Turn 3', { timeout: 20_000 });
  await expect(page.getByTestId('phase')).toContainText('Your turn');
  expect(errors).toEqual([]);
});

test('spells, targets and combat work from the UI', async ({ page }) => {
  await page.goto('/?seed=1&aiDelay=0');
  await page.evaluate(() =>
    window.manaDuel.loadScenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain', { card: 'timberland_rhino', id: 'rhino' }] },
        { life: 20, battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      ],
    }),
  );
  await page.getByTestId('card-snap').click();
  await page.getByTestId('sheet-cast').click();
  await expect(page.getByTestId('prompt')).toHaveText('Choose any target');
  await page.getByTestId('card-elf').click();
  await expect(page.getByTestId('card-elf')).toHaveCount(0);

  await expect(page.getByTestId('prompt')).toHaveText('Choose attackers');
  await page.getByTestId('card-rhino').click();
  await page.getByTestId('btn-confirm-attack').click();
  await expect(page.getByTestId('life-1')).toContainText('16');
  await expectNoHorizontalOverflow(page);
});

test('the AI can finish a whole game and the result is shown', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=21&aiDelay=0&skipMulligan=1');
  const result = await page.evaluate(() => window.manaDuel.playToEnd());
  expect(result?.kind).toBe('gameOver');
  await expect(page.getByTestId('game-over')).toBeVisible();
  await expect(page.getByTestId('game-over-title')).toHaveText(/Victory|Defeat|Draw/);
  const log = await page.evaluate(() => window.manaDuel.log());
  expect(log.length).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('watching AI vs AI plays on its own', async ({ page }) => {
  await page.goto('/?seed=4&autoplay=1&aiDelay=20');
  await expect(page.getByTestId('game')).toHaveAttribute('data-turn', /^([3-9]|\d{2,})$/, { timeout: 30_000 });
});

test('every built-in feature check passes in the browser build', async ({ page }) => {
  await page.goto('/?seed=1&aiDelay=0');
  const results = await page.evaluate(() => window.manaDuel.runChecks());
  expect(results.length).toBeGreaterThan(20);
  expect(results.filter((result) => !result.ok)).toEqual([]);
});
