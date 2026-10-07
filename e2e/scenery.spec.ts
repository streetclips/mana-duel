import { expect, test, type Page } from '@playwright/test';

const SCENES = ['plains', 'island', 'swamp', 'mountain', 'forest'] as const;
const THEMES = ['light', 'dark'] as const;
const GAME = '&seed=1&skipMulligan=1&aiDelay=0&fx=off';

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

interface BackdropLook {
  contrast99: number;
  cells: number[];
}

async function backdropLook(page: Page): Promise<BackdropLook> {
  await page.addStyleTag({
    content:
      '#app > :not([data-testid="backdrop"]) { visibility: hidden !important; } .backdrop * { animation: none !important; transition: none !important; }',
  });
  const png = (await page.screenshot({ scale: 'css' })).toString('base64');
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2d context');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const linear = (value: number): number => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (r: number, g: number, b: number): number =>
      0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    const [pr = 0, pg = 0, pb = 0] =
      getComputedStyle(document.documentElement).backgroundColor.match(/\d+/g)?.map(Number) ?? [];
    const background = luminance(pr, pg, pb);
    const contrasts: number[] = [];
    const columns = 12;
    const rows = 24;
    const sums = Array.from({ length: columns * rows * 4 }, () => 0);
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const at = (y * canvas.width + x) * 4;
        const rgb = [pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0] as const;
        const value = luminance(...rgb);
        contrasts.push((Math.max(value, background) + 0.05) / (Math.min(value, background) + 0.05));
        const cell = (Math.floor((y / canvas.height) * rows) * columns + Math.floor((x / canvas.width) * columns)) * 4;
        rgb.forEach((channel, index) => {
          sums[cell + index] = (sums[cell + index] ?? 0) + channel;
        });
        sums[cell + 3] = (sums[cell + 3] ?? 0) + 1;
      }
    }
    contrasts.sort((a, b) => a - b);
    const cells: number[] = [];
    for (let cell = 0; cell < sums.length; cell += 4) {
      const count = sums[cell + 3] || 1;
      cells.push((sums[cell] ?? 0) / count, (sums[cell + 1] ?? 0) / count, (sums[cell + 2] ?? 0) / count);
    }
    return { contrast99: contrasts[Math.floor(contrasts.length * 0.99)] ?? 1, cells };
  }, png);
}

function backdropAnimations(page: Page): Promise<number> {
  return page.getByTestId('backdrop').evaluate((element) => element.getAnimations({ subtree: true }).length);
}

function distance(a: readonly number[], b: readonly number[]): number {
  let total = 0;
  for (let index = 0; index < a.length; index += 3) {
    total += Math.hypot(
      (a[index] ?? 0) - (b[index] ?? 0),
      (a[index + 1] ?? 0) - (b[index + 1] ?? 0),
      (a[index + 2] ?? 0) - (b[index + 2] ?? 0),
    );
  }
  return total / (a.length / 3);
}

test('the backdrop paints each scene in light and dark behind the menus, and never takes a tap', async ({ page }) => {
  const errors = collectErrors(page);
  for (const theme of THEMES) {
    for (const scene of SCENES) {
      await page.goto(`/?scene=${scene}&theme=${theme}&music=off&sfx=off`);
      const backdrop = page.getByTestId('backdrop');
      await expect(backdrop).toHaveAttribute('data-scene', scene);
      await expect(backdrop).toHaveAttribute('data-mode', 'menu');
      await expect(backdrop.locator('.scene.on')).toHaveAttribute('data-scene-id', scene);
      await expect(backdrop.locator('.scene.on')).toHaveCSS('background-image', /linear-gradient/);
      const fills = await backdrop
        .locator('.scene.on .land path')
        .evaluateAll((paths) => paths.map((path) => getComputedStyle(path).fill));
      expect(new Set(fills).size, `${scene} in ${theme}`).toBeGreaterThanOrEqual(3);
      expect(fills, `${scene} in ${theme}`).not.toContain('rgb(0, 0, 0)');
      const others = await backdrop
        .locator('.scene:not(.on)')
        .evaluateAll((scenes) => scenes.map((other) => getComputedStyle(other).visibility));
      expect(others).toEqual(['hidden', 'hidden', 'hidden', 'hidden']);
    }
  }
  await expect(page.getByTestId('backdrop')).toHaveCSS('pointer-events', 'none');
  const play = await page.getByTestId('btn-play').boundingBox();
  const hit = await page.evaluate(
    ([x = 0, y = 0]) => document.elementFromPoint(x, y)?.closest('[data-testid]')?.getAttribute('data-testid'),
    [(play?.x ?? 0) + 12, (play?.y ?? 0) + 12],
  );
  expect(hit).toBe('btn-play');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('behind a game the backdrop stays quiet, behind the menus it shows, and no two scenes look alike', async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const theme of THEMES) {
    const menus: number[][] = [];
    for (const scene of SCENES) {
      await page.goto(`/?scene=${scene}&theme=${theme}&music=off&sfx=off`);
      const menu = await backdropLook(page);
      await page.goto(`/?scene=${scene}&theme=${theme}&music=off&sfx=off${GAME}`);
      await expect(page.getByTestId('backdrop')).toHaveAttribute('data-mode', 'game');
      const game = await backdropLook(page);
      expect(game.contrast99, `${scene} behind a ${theme} game`).toBeLessThan(1.6);
      expect(menu.contrast99, `${scene} behind a ${theme} menu`).toBeGreaterThan(1.3);
      menus.push(menu.cells);
    }
    menus.forEach((cells, a) => {
      for (let b = a + 1; b < menus.length; b++) {
        expect(distance(cells, menus[b] ?? []), `${SCENES[a]} and ${SCENES[b]} in ${theme}`).toBeGreaterThan(
          theme === 'light' ? 20 : 10,
        );
      }
    });
  }
});

test('the menus fade into the next scene and rest in between, and a game takes the one after it and quiets it', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem('manaDuel.scene', 'forest'));
  await page.goto('/?theme=light&music=off&sfx=off&aiDelay=0');
  const backdrop = page.getByTestId('backdrop');
  await expect(backdrop).toHaveAttribute('data-scene', 'plains');
  await expect(backdrop).toHaveAttribute('data-mode', 'menu');
  expect(await backdropAnimations(page)).toBe(0);
  await page.clock.runFor(16_000);
  await expect(backdrop).toHaveAttribute('data-scene', 'island');
  await expect.poll(() => backdropAnimations(page)).toBe(0);
  await page.getByTestId('btn-play').click();
  await expect(backdrop).toHaveAttribute('data-scene', 'swamp');
  await expect(backdrop).toHaveAttribute('data-mode', 'game');
  await expect(page.locator('.scene-veil')).toHaveCSS('opacity', '0.84');
  await expect(page.locator('.scene.on .sky')).toHaveCSS('opacity', '0.4');
  await expect(page.locator('.scene.on .motes')).toHaveCSS('visibility', 'hidden');
  await expect.poll(() => backdropAnimations(page)).toBe(0);
  await page.clock.runFor(48_000);
  await expect(backdrop).toHaveAttribute('data-scene', 'swamp');
  await page.getByTestId('btn-menu').click();
  await page.getByTestId('menu-home').click();
  await expect(backdrop).toHaveAttribute('data-mode', 'menu');
  await expect(backdrop).toHaveAttribute('data-scene', 'swamp');
  await expect(page.locator('.scene-veil')).toHaveCSS('opacity', '0.12');
  expect(await page.evaluate(() => localStorage.getItem('manaDuel.scene'))).toBe('swamp');
  expect(errors).toEqual([]);
});
