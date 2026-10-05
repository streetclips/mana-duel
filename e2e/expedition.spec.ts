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

test('an expedition starts from the start screen, and a defeat ends it', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?aiDelay=0');
  await expect(page.getByTestId('btn-expedition-status')).toHaveText('Siete duelos seguidos con un mismo mazo');
  await page.getByTestId('btn-expedition').click();
  await expect(page.getByTestId('expedition')).toHaveAttribute('data-stage', 'new');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('expedition-deck-dawntide').click();
  await page.getByTestId('btn-expedition-start').click();
  await expect(page.getByTestId('expedition')).toHaveAttribute('data-stage', 'duel');
  await expect(page.getByTestId('expedition-map').getByRole('listitem')).toHaveCount(7);
  await expect(page.getByTestId('expedition-floor-1')).toHaveAttribute('data-state', 'current');
  await expectNoHorizontalOverflow(page);

  await page.getByTestId('btn-expedition-fight').click();
  await expect(page.getByTestId('duel-badge-1')).toHaveText('Duelo 1/7');
  await expect(page.getByTestId('life-1')).toHaveText('14');
  expect(await page.evaluate(() => window.manaDuel.matchup()?.[0])).toBe('expedition');
  await page.getByTestId('btn-menu').click();
  await expect(page.getByTestId('menu-new-game')).toHaveCount(0);
  await page.getByTestId('menu-concede').click();
  await expect(page.getByTestId('game-over')).toContainText('La expedición termina aquí.');
  await page.getByTestId('btn-mode-continue').click();
  await expect(page.getByTestId('expedition-result')).toHaveAttribute('data-result', 'lost');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('btn-expedition-home').click();
  await expect(page.getByTestId('btn-expedition-status')).toHaveText('Terminada en el duelo 1 de 7');
  expect(errors).toEqual([]);
});

test('a won duel brings a card into the expedition deck', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?aiDelay=0');
  const seed = await page.evaluate(() => {
    for (let candidate = 1; candidate < 60; candidate++) {
      window.manaDuel.expedition.start({ deck: 'emberwild', seed: candidate });
      window.manaDuel.expedition.fight();
      window.manaDuel.playToEnd();
      if (window.manaDuel.expedition.state()?.stage.kind === 'card') return candidate;
    }
    return null;
  });
  expect(seed).not.toBeNull();
  await expect(page.getByTestId('game-over-title')).toHaveText('Victoria');
  await expect(page.getByTestId('game-over')).toContainText('Duelo 1 de 7 superado');
  await page.getByTestId('btn-mode-continue').click();
  await expect(page.getByTestId('expedition')).toHaveAttribute('data-stage', 'card');
  await expectNoHorizontalOverflow(page);
  const offer = page.getByTestId('expedition-reward').getByRole('radio').first();
  const card = ((await offer.getAttribute('data-testid')) ?? '').replace('reward-card-', '');
  await offer.click();
  await page.getByTestId('btn-reward-take').click();
  await expect(page.getByTestId('expedition')).toHaveAttribute('data-stage', 'swap');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('swap-card-ember_snap').click();
  await page.getByTestId('btn-swap-confirm').click();
  await expect(page.getByTestId('expedition-floor-1')).toHaveAttribute('data-state', 'won');
  await expect(page.getByTestId('run-deck-size')).toHaveText('40 cartas · con 1 carta nueva');
  const deck = await page.evaluate(() => window.manaDuel.expedition.state()?.deck ?? []);
  expect(deck.some((entry) => entry.card === card)).toBe(true);
  await page.getByTestId('btn-expedition-deck').click();
  await expect(page.getByTestId('deck-viewer')).toHaveAttribute('data-deck', 'expedition');
  await expect(page.getByTestId(`deck-card-${card}`)).toBeVisible();
  expect(errors).toEqual([]);
});

test('a duel in progress survives a reload and resumes where it was', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?aiDelay=0');
  await page.evaluate(() => {
    window.manaDuel.expedition.start({ deck: 'cindermaw', seed: 7 });
    window.manaDuel.expedition.fight();
    const pending = window.manaDuel.pending();
    if (pending?.kind === 'mulligan' && pending.player === 0) window.manaDuel.dispatch({ type: 'keep', player: 0 });
    window.manaDuel.settle();
  });
  await expect(page.getByTestId('duel-badge-1')).toHaveText('Duelo 1/7');
  const before = await page.evaluate(() => JSON.stringify(window.manaDuel.state()));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.getByTestId('btn-menu').click();
  await expect(page.getByTestId('menu-home')).toHaveText('Volver a la expedición');
  await page.getByTestId('menu-home').click();
  await expect(page.getByTestId('btn-expedition-fight')).toHaveText('Continuar el duelo');
  await page.reload();
  await page.getByTestId('btn-expedition').click();
  await page.getByTestId('btn-expedition-fight').click();
  await expect(page.getByTestId('duel-badge-1')).toHaveText('Duelo 1/7');
  expect(await page.evaluate(() => JSON.stringify(window.manaDuel.state()))).toBe(before);
  expect(errors).toEqual([]);
});

test('the boss carries a boss relic, shown on the map and beside its bar in the duel', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?aiDelay=0');
  const boss = await page.evaluate(() => {
    const started = window.manaDuel.expedition.start({ deck: 'dawntide', seed: 7 });
    return started.ok ? (started.run?.rivals.at(-1) ?? null) : null;
  });
  expect(boss?.relics).toHaveLength(2);
  const special = boss?.relics[0] ?? '';
  const floor = page.getByTestId('expedition-floor-7');
  await expect(floor.locator('.relic-pill')).toHaveCount(2);
  await expect(floor.locator('.relic-pill.boss')).toHaveAttribute('data-testid', `rival-relic-${special}`);
  await expectNoHorizontalOverflow(page);
  await page.getByTestId(`rival-relic-${special}`).click();
  await expect(page.getByTestId('relic-sheet')).toContainText('Su habilidad especial: solo los jefes llevan esta reliquia.');
  await page.getByTestId('relic-sheet').click({ position: { x: 10, y: 10 } });
  await expect(page.getByTestId('relic-sheet')).toHaveCount(0);

  await page.evaluate(() => {
    const run = window.manaDuel.expedition.state();
    if (!run) return;
    run.wins = 6;
    run.history = run.rivals.slice(0, 6).map((rival) => ({ rival: rival.deck, result: 'won' as const, turns: 9 }));
    localStorage.setItem('manaDuel.expedition', JSON.stringify(run));
  });
  await page.reload();
  await page.getByTestId('btn-expedition').click();
  await expect(page.getByTestId('expedition-floor-7')).toHaveAttribute('data-state', 'current');
  await page.getByTestId('btn-expedition-fight').click();
  await expect(page.getByTestId('duel-badge-1')).toHaveText('Jefe');
  const inPlay = await page.evaluate(() => {
    const s = window.manaDuel.state();
    return s.players[1].command.map((id) => s.cards[id]?.def);
  });
  expect(inPlay[0]).toBe(special);
  const badges = page.getByTestId('relics-1').getByRole('button');
  await expect(badges).toHaveCount(inPlay.length);
  await expect(badges.first()).toHaveAttribute('data-def', special);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await badges.first().click();
  await expect(page.getByTestId('card-sheet')).toContainText('Reliquia del rival');
  expect(errors).toEqual([]);
});
