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

test('a deck built from nothing on the phone is played from your seat', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?aiDelay=0');
  await page.getByTestId('btn-my-decks').click();
  await expect(page.getByTestId('decks-screen')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('btn-new-deck').click();
  await expect(page.getByTestId('deck-builder')).toHaveAttribute('data-tab', 'pool');
  await page.getByTestId('builder-color-R').click();
  await page.getByTestId('builder-kind-creature').click();
  const tiles = page.getByTestId('deck-builder').locator('[data-testid^="builder-pool-"]');
  const cards = (await tiles.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? ''))).map((id) =>
    id.replace('builder-pool-', ''),
  );
  for (const card of cards.slice(0, 6)) {
    for (let i = 0; i < 4; i++) await page.getByTestId(`add-${card}`).click();
  }
  await expect(page.getByTestId('builder-count')).toHaveText('24/40');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('builder-tab-deck').click();
  await page.getByTestId('btn-builder-fill').click();
  await expect(page.getByTestId('builder-count')).toHaveText('40/40');
  await expect(page.getByTestId('deck-builder').getByTestId('deck-stats')).toContainText('24 criaturas · 0 hechizos · 16 tierras');
  await expect(page.getByTestId('builder-deck-mountain')).toBeVisible();
  await page.getByTestId('btn-builder-save').click();
  await expect(page.getByTestId('my-deck-mine-1')).toHaveAttribute('data-playable', 'true');
  await page.getByTestId('btn-decks-back').click();
  await expect(page.getByTestId('btn-my-decks-status')).toHaveText('1 mazo propio');
  await page.getByTestId('seat-0').click();
  await page.getByTestId('deck-mine-1').click();
  await page.getByTestId('btn-picker-done').click();
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('deck-name-0')).toContainText('Mi mazo');
  expect(await page.evaluate(() => window.manaDuel.matchup()?.[0])).toBe('mine-1');
  expect(errors).toEqual([]);
});

test('a copied deck stays after a reload and can start an Expedition', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?aiDelay=0');
  await page.getByTestId('btn-my-decks').click();
  await page.getByTestId('copy-sunmeadow').click();
  await page.getByTestId('builder-name').fill('Prado salvaje');
  await page.getByTestId('btn-builder-save').click();
  await page.reload();
  await page.getByTestId('btn-my-decks').click();
  await expect(page.getByTestId('my-deck-mine-1')).toContainText('Prado salvaje');
  await page.getByTestId('btn-decks-back').click();
  await page.getByTestId('btn-expedition').click();
  await page.getByTestId('expedition-deck-mine-1').click();
  await page.getByTestId('btn-expedition-start').click();
  await expect(page.getByTestId('expedition')).toHaveAttribute('data-stage', 'duel');
  expect(await page.evaluate(() => window.manaDuel.expedition.state()?.base.name)).toBe('Prado salvaje');
  expect(errors).toEqual([]);
});
