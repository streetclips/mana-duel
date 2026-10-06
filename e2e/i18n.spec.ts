import { expect, test, type Page } from '@playwright/test';
import { spanishIn } from '../tests/i18n';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

function shownText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) =>
        node instanceof Element && node.hasAttribute('lang') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!(node instanceof Element)) parts.push(node.textContent ?? '');
      else for (const name of ['aria-label', 'title', 'placeholder', 'alt']) parts.push(node.getAttribute(name) ?? '');
    }
    return parts.join('\n');
  });
}

test.describe('a browser in English', () => {
  test.use({ locale: 'en-US' });

  test('opens the game in English and switches to Spanish from the settings, for good', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Mana Duel' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Mana Duel');
    await expect(page.getByTestId('seat-0')).toContainText('Emberwild');
    expect(spanishIn(await shownText(page))).toEqual([]);
    await page.getByTestId('btn-settings').click();
    await page.getByTestId('lang-es').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await page.getByTestId('btn-settings-close').click();
    await expect(page.getByRole('heading', { name: 'Duelo de Maná' })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('seat-0')).toContainText('Brasalvaje');
    await expect(page.getByTestId('btn-play')).toHaveText('Jugar contra la IA');
    expect(errors).toEqual([]);
  });
});

test('?lang=en plays a whole game in English, log included', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?lang=en&seed=3&aiDelay=0&fx=off');
  await expect(page.getByTestId('prompt')).toBeVisible();
  expect(spanishIn(await shownText(page))).toEqual([]);
  await page.evaluate(() => {
    window.manaDuel.setAutoplay(true);
    window.manaDuel.settle();
  });
  await expect(page.getByTestId('game-over')).toBeVisible();
  expect(spanishIn(await shownText(page))).toEqual([]);
  await page.getByTestId('btn-view-log').click();
  await expect(page.getByTestId('log-panel')).toBeVisible();
  const log = await page.evaluate(() => window.manaDuel.log().join('\n'));
  expect(log).toContain('Turn 1 — ');
  expect(spanishIn(log)).toEqual([]);
  expect(spanishIn(await shownText(page))).toEqual([]);
  expect(errors).toEqual([]);
});

test('every English card name fits two lines in hand, with no Spanish on the board', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?lang=en&seed=1&aiDelay=0');
  const cards = await page.evaluate(() => {
    const cards = window.manaDuel
      .cards()
      .filter((card) => !card.token)
      .map((card) => card.id);
    window.manaDuel.loadScenario({
      players: [{ hand: cards, battlefield: ['mountain', { card: 'crag_dragon', id: 'dragon' }] }, {}],
    });
    return cards;
  });
  await expect(page.getByTestId('hand').locator('.card .name')).toHaveCount(cards.length);
  const overflowingNames = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="hand"] .card .name')]
      .filter((name) => name.scrollHeight > name.clientHeight + 1)
      .map((name) => name.textContent),
  );
  expect(overflowingNames).toEqual([]);
  expect(spanishIn(await shownText(page))).toEqual([]);
  await page.getByTestId('card-dragon').click({ button: 'right' });
  await expect(page.getByTestId('card-sheet')).toContainText('Crag Dragon');
  await expect(page.getByTestId('card-sheet')).toContainText(': This creature gets +1/+0 until end of turn.');
  await expect(page.getByTestId('card-sheet')).toContainText(
    "Flying: Can't be blocked except by creatures with flying or reach.",
  );
  expect(spanishIn(await shownText(page))).toEqual([]);
  expect(errors).toEqual([]);
});
