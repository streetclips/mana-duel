import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({
  launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
  viewport: { width: 555, height: 600 },
  isMobile: false,
  hasTouch: false,
});

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

function boxes(cards: Locator): Promise<number[][]> {
  return cards.evaluateAll((elements) =>
    elements.map((element) => {
      const card = element as HTMLElement;
      return [card.offsetLeft, card.offsetTop, card.offsetWidth, card.offsetHeight];
    }),
  );
}

async function widths(cards: Locator): Promise<Set<number>> {
  return new Set(await cards.evaluateAll((elements) => elements.map((element) => (element as HTMLElement).offsetWidth)));
}

test('a draft pack keeps its cards in place and their size, and a long press opens one', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?aiDelay=0');
  await page.getByTestId('btn-draft').click();
  await page.getByTestId('btn-draft-start').click();
  const cards = page.getByTestId('draft-picking').getByRole('radio');
  const before = await boxes(cards);
  await cards.nth(1).click();
  await expect(cards.nth(1)).toHaveAttribute('aria-checked', 'true');
  expect(await boxes(cards)).toEqual(before);
  const name = (await cards.nth(2).getAttribute('aria-label')) ?? '';
  await cards.nth(2).click({ delay: 600 });
  await expect(page.getByTestId('card-sheet').getByRole('dialog')).toHaveAttribute('aria-label', name);
  await expect(cards.nth(2)).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('card-sheet').click({ position: { x: 10, y: 10 } });
  await expect(page.getByTestId('card-sheet')).toHaveCount(0);
  for (let pick = 2; pick <= 12; pick++) {
    await cards.first().click();
    await page.getByTestId('btn-draft-pick').click();
    await expect(page.getByTestId('draft-picking')).toContainText(`carta ${pick} de 12`);
    expect(await widths(cards)).toEqual(new Set([before[0]?.[2]]));
  }
  expect(errors).toEqual([]);
});

test('the deck builder keeps the size of its cards while a search shortens the list', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 555, height: 800 });
  await page.goto('/?aiDelay=0');
  await page.getByTestId('btn-my-decks').click();
  await page.getByTestId('btn-new-deck').click();
  const tiles = page.getByTestId('deck-builder').locator('[data-testid^="builder-pool-"]');
  const before = await widths(tiles);
  expect(before.size).toBe(1);
  await page.getByTestId('builder-search').fill('dragon');
  await expect(tiles).toHaveCount(4);
  expect(await widths(tiles)).toEqual(before);
  expect(errors).toEqual([]);
});
