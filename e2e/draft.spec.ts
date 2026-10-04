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

async function concede(page: Page): Promise<void> {
  await page.getByTestId('btn-menu').click();
  await page.getByTestId('menu-concede').click();
  await page.getByTestId('btn-mode-continue').click();
}

test('a sealed pool becomes a deck that plays a whole match', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?aiDelay=0');
  await page.getByTestId('btn-draft').click();
  await page.getByTestId('draft-format-sealed').click();
  await page.getByTestId('btn-draft-start').click();
  await expect(page.getByTestId('draft')).toHaveAttribute('data-stage', 'building');
  await expect(page.getByTestId('draft-pick-count')).toHaveText('72 cartas');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('btn-draft-build').click();
  await expect(page.getByTestId('builder-count')).toHaveText('40/40');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('btn-builder-save').click();
  await expect(page.getByTestId('draft-score')).toHaveText('Tú 0 – 0 IA');
  await page.getByTestId('btn-draft-play').click();
  await expect(page.getByTestId('duel-badge-1')).toHaveText('Draft · partida 1');
  expect(await page.evaluate(() => window.manaDuel.matchup())).toEqual(['draft', 'draft-ai']);
  await concede(page);
  await expect(page.getByTestId('draft-score')).toHaveText('Tú 0 – 1 IA');
  await page.getByTestId('btn-draft-play').click();
  await expect(page.getByTestId('duel-badge-1')).toHaveText('Draft · partida 2');
  await concede(page);
  await expect(page.getByTestId('draft')).toHaveAttribute('data-stage', 'done');
  await expect(page.getByTestId('draft-result-title')).toHaveText('Draft perdido');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('btn-draft-save').click();
  await expect(page.getByTestId('btn-draft-save')).toHaveText('Guardado en Mis mazos como Mi draft');
  await page.getByTestId('btn-draft-home').click();
  await expect(page.getByTestId('btn-draft-status')).toHaveText('Sellado terminado: perdiste 0-2');
  await expect(page.getByTestId('btn-my-decks-status')).toHaveText('1 mazo propio');
  expect(errors).toEqual([]);
});

test('draft picks are made with taps and survive a reload', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?aiDelay=0');
  await page.getByTestId('btn-draft').click();
  await page.getByTestId('btn-draft-start').click();
  await expect(page.getByTestId('draft-picking').getByRole('radio')).toHaveCount(12);
  await expectNoHorizontalOverflow(page);
  for (let pick = 1; pick <= 3; pick++) {
    await page.getByTestId('draft-picking').getByRole('radio').first().click();
    await page.getByTestId('btn-draft-pick').click();
    await expect(page.getByTestId('draft-pick-count')).toHaveText(pick === 1 ? '1 carta' : `${pick} cartas`);
  }
  await expect(page.getByTestId('draft-picking')).toContainText('carta 4 de 12');
  await page.reload();
  await page.getByTestId('btn-draft').click();
  await expect(page.getByTestId('draft-pick-count')).toHaveText('3 cartas');
  await expect(page.getByTestId('draft-picking').getByRole('radio')).toHaveCount(9);
  expect(errors).toEqual([]);
});
