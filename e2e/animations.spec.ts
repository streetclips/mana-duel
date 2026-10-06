import { expect, test, type Page } from '@playwright/test';
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

function fxAnimationsOf(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluate((element) =>
    element
      .getAnimations({ subtree: true })
      .map((animation) => animation.id || (animation as CSSAnimation).animationName || '')
      .filter((name) => name.startsWith('fx-')),
  );
}

function runningFx(page: Page): Promise<{ name: string; state: string; progress: number }[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .map((animation) => ({
        name: animation.id || (animation as CSSAnimation).animationName || '',
        state: animation.playState,
        progress: Number(animation.currentTime ?? 0) / Number(animation.effect?.getComputedTiming().endTime ?? 1),
      }))
      .filter((animation) => animation.name.startsWith('fx-')),
  );
}

function finishFx(page: Page): Promise<void> {
  return page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      const name = animation.id || (animation as CSSAnimation).animationName || '';
      if (name.startsWith('fx-')) animation.finish();
    }
  });
}

function lidAngle(page: Page, selector: string): Promise<number> {
  return page.locator(`${selector} .box-hinge`).evaluate((hinge) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(hinge).transform);
    return Math.round((Math.atan2(matrix.m23, matrix.m22) * 180) / Math.PI);
  });
}

function boxTransitions(page: Page, selector: string): Promise<string[]> {
  return page
    .locator(`${selector} .deck-box`)
    .evaluate((box) =>
      box
        .getAnimations({ subtree: true })
        .map((animation) => (animation instanceof CSSTransition ? animation.transitionProperty : '')),
    );
}

const COMBAT: ScenarioSpec = {
  activePlayer: 1,
  players: [
    { hand: ['forest'], battlefield: [{ card: 'grove_tender', id: 'elf' }] },
    { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
  ],
};

const BURN: ScenarioSpec = {
  players: [
    {
      hand: [{ card: 'ember_snap', id: 'snap' }],
      battlefield: ['mountain'],
      library: [{ card: 'forest', id: 'top' }, 'forest'],
    },
    {},
  ],
};

async function blockTheRhino(page: Page): Promise<void> {
  await page.evaluate((spec) => window.manaDuel.loadScenario(spec), COMBAT);
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('prompt')).toHaveText('Elige las bloqueadoras');
  await page.getByTestId('card-elf').click();
  await page.getByTestId('btn-confirm-blocks').click();
}

async function burnTheAi(page: Page): Promise<void> {
  await page.evaluate((spec) => window.manaDuel.loadScenario(spec), BURN);
  await page.getByTestId('card-snap').click();
  await page.getByTestId('sheet-cast').click();
  await page.getByTestId('player-1').click();
}

test('in combat the creatures strike each other, the damage shows and the blocker fades out in its place', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0');
  await blockTheRhino(page);
  const frozen = await page.evaluate(async () => {
    window.manaDuel.settle();
    return window.manaDuel.freezeFx(0.4);
  });
  expect(frozen).toEqual(
    expect.arrayContaining(['fx-lunge', 'fx-shake', 'fx-dies', 'fx-collapse', 'fx-burst', 'fx-float', 'fx-hurt']),
  );
  const ghost = page.getByTestId('fx-ghost-elf');
  await expect(ghost).toBeVisible();
  await expect(ghost).toHaveAttribute('data-fx', /\bdies\b/);
  await expect(page.getByTestId('card-elf')).toHaveCount(0);
  expect(await fxAnimationsOf(page, '[data-testid="fx-ghost-elf"]')).toEqual(
    expect.arrayContaining(['fx-lunge', 'fx-dies']),
  );
  expect(await fxAnimationsOf(page, '[data-slot="rhino"]')).toEqual(expect.arrayContaining(['fx-lunge', 'fx-shake']));
  await expect(page.getByTestId('fx-float-rhino')).toHaveText('−1');
  await expect(page.getByTestId('fx-life-0')).toHaveText('−3');
  await expectNoHorizontalOverflow(page);
  await finishFx(page);
  await expect(ghost.locator('.permanent')).toHaveCSS('opacity', '0');
  await expect(ghost).toHaveCSS('width', '0px');
  expect(errors).toEqual([]);
});

test('the opponent’s spell is revealed, pops onto the stack and marks its target', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0');
  await page.evaluate(() =>
    window.manaDuel.loadScenario({
      activePlayer: 1,
      players: [
        {
          hand: [{ card: 'verdant_surge', id: 'surge' }],
          battlefield: ['forest', { card: 'grove_tender', id: 'elf' }],
        },
        { hand: [{ card: 'magma_lance', id: 'lance' }], battlefield: ['mountain', 'mountain', 'mountain'] },
      ],
    }),
  );
  await page.evaluate(() => window.manaDuel.settle());
  const reveal = page.getByTestId('fx-reveal');
  await expect(reveal).toHaveAttribute('data-def', 'magma_lance');
  await expect(reveal).toContainText('El rival lanza');
  await expect(reveal).toContainText('→ tu Elfa del soto');
  await expect(page.getByTestId('card-elf')).toHaveAttribute('data-aimed', 'true');
  await expect(page.locator('[data-testid^="stack-"][data-fx="play"]')).toHaveCount(1);
  expect(await fxAnimationsOf(page, '[data-testid="fx-reveal"]')).toContain('fx-reveal');
  await expectNoHorizontalOverflow(page);
  await expect(reveal).toHaveCSS('opacity', '0', { timeout: 5_000 });
  expect(errors).toEqual([]);
});

test('life changes pop beside the life total, and a new turn is announced and deals the drawn card', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0');
  await burnTheAi(page);
  await expect(page.getByTestId('life-1')).toHaveText('18');
  await expect(page.getByTestId('fx-life-1')).toHaveText('−2');
  expect(await fxAnimationsOf(page, '[data-testid="player-1"]')).toEqual(
    expect.arrayContaining(['fx-shake', 'fx-float', 'fx-chip']),
  );
  await page.getByTestId('btn-end-turn').click();
  await expect(page.getByTestId('phase')).toContainText('Tu turno', { timeout: 20_000 });
  await expect(page.getByTestId('fx-turn')).toContainText('Tu turno');
  await expect(page.getByTestId('card-top')).toHaveAttribute('data-fx', 'draw');
  expect(await page.evaluate(() => window.manaDuel.fx().some((cue) => cue.kind === 'draw' && cue.player === 1))).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('freezeFx holds the animations at one point for a screenshot, then lets them go on', async ({ page }) => {
  await page.goto('/?seed=1&aiDelay=0');
  await burnTheAi(page);
  const names = await page.evaluate(async () => {
    window.manaDuel.settle();
    return window.manaDuel.freezeFx(0.5);
  });
  expect(names).toContain('fx-float');
  const frozen = await runningFx(page);
  expect(frozen.length).toBeGreaterThan(0);
  expect(frozen.every((animation) => animation.state === 'paused' && Math.abs(animation.progress - 0.5) < 0.02)).toBe(
    true,
  );
  await page.waitForTimeout(400);
  expect((await runningFx(page)).every((animation) => animation.state === 'paused')).toBe(true);
  await page.evaluate(() => window.manaDuel.freezeFx(null));
  expect((await runningFx(page)).some((animation) => animation.state === 'running')).toBe(true);
});

test('?fx=off plays no animation but still records the cues', async ({ page }) => {
  await page.goto('/?seed=1&aiDelay=0&fx=off');
  await blockTheRhino(page);
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('game')).toHaveAttribute('data-fx-speed', '0');
  expect(await runningFx(page)).toEqual([]);
  await expect(page.locator('[data-fx]')).toHaveCount(0);
  expect(await page.evaluate(() => window.manaDuel.fx().map((cue) => cue.kind))).toEqual(
    expect.arrayContaining(['strike', 'dies']),
  );
});

test('?fx=slow plays the animations four times slower', async ({ page }) => {
  await page.goto('/?seed=1&aiDelay=0&fx=slow');
  await burnTheAi(page);
  const duration = await page
    .getByTestId('fx-life-1')
    .evaluate((element) => Number(element.getAnimations()[0]?.effect?.getComputedTiming().duration ?? 0));
  expect(duration).toBeCloseTo(4400, 0);
});

test('with reduced motion the hooks stay but nothing moves', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?seed=1&aiDelay=0');
  await blockTheRhino(page);
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('fx-ghost-elf')).toHaveAttribute('data-fx', /\bdies\b/);
  expect(
    (await runningFx(page)).filter((animation) => animation.name === 'fx-lunge' || animation.name === 'fx-shake'),
  ).toEqual([]);
});

test('a deck box opens when its seat is tapped, and the chosen deck’s box opens in its place', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  const seat = '[data-testid="seat-0"]';
  expect(await lidAngle(page, seat)).toBe(0);
  await page.getByTestId('seat-0').click();
  expect(await boxTransitions(page, seat)).toContain('transform');
  await expect.poll(() => lidAngle(page, seat)).toBe(116);
  const rise = await page
    .locator(`${seat} .box-cards i`)
    .evaluateAll((cards) => cards.map((card) => new DOMMatrixReadOnly(getComputedStyle(card).transform).m42));
  expect(rise).toHaveLength(3);
  expect(rise.every((offset) => offset < 0)).toBe(true);
  await expect.poll(() => lidAngle(page, '[data-testid="deck-emberwild"]')).toBe(116);
  expect(await lidAngle(page, '[data-testid="deck-mistgrave"]')).toBe(0);

  await page.getByTestId('deck-mistgrave').click();
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-deck', 'mistgrave');
  expect(await boxTransitions(page, seat)).toContain('transform');
  await expect.poll(() => lidAngle(page, seat)).toBe(116);
  await expect.poll(() => lidAngle(page, '[data-testid="deck-mistgrave"]')).toBe(116);
  await expect.poll(() => lidAngle(page, '[data-testid="deck-emberwild"]')).toBe(0);
  await expectNoHorizontalOverflow(page);

  await page.getByTestId('btn-picker-done').click();
  await expect.poll(() => lidAngle(page, seat)).toBe(0);
  expect(errors).toEqual([]);
});
