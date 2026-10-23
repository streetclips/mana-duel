import { expect, test, type Page } from '@playwright/test';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function linked(page: Page, selector: string): Promise<{ status: number; type: string; body: string }> {
  return page.evaluate(async (query) => {
    const href = document.querySelector(query)?.getAttribute('href');
    if (!href) throw new Error(`No ${query}`);
    const response = await fetch(href);
    return { status: response.status, type: response.headers.get('content-type') ?? '', body: await response.text() };
  }, selector);
}

test('links a favicon, a touch icon and a manifest in the language of the page', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByTestId('btn-play')).toBeVisible();
  const icon = await linked(page, 'link[rel="icon"]');
  expect(icon.status).toBe(200);
  expect(icon.body).toContain('<svg');
  expect((await linked(page, 'link[rel="apple-touch-icon"]')).status).toBe(200);
  const spanish = await linked(page, 'link[rel="manifest"]');
  expect(spanish.status).toBe(200);
  expect(JSON.parse(spanish.body)).toMatchObject({ name: 'Duelo de Maná', display: 'standalone' });

  await page.goto('/?lang=en');
  await expect(page.getByTestId('btn-play')).toBeVisible();
  expect(JSON.parse((await linked(page, 'link[rel="manifest"]')).body)).toMatchObject({ name: 'Mana Duel' });
  expect(errors).toEqual([]);
});

test('installs a service worker that keeps the game playable offline', async ({ page, context }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.goto('/?seed=1&skipMulligan=1&aiDelay=0&fx=off&music=off&sfx=off');
  await expect(page.getByTestId('hand')).toBeVisible();
  const art = await page.evaluate(async () => (await fetch('cards/ember_snap.svg')).status);
  expect(art).toBe(200);
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
