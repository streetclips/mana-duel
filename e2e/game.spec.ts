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

test('the deck selector sets up the chosen matchup', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  for (const name of ['Emberwild', 'Dawntide', 'Duskmire', 'Stormglass', 'Sunmeadow']) await expect(page.getByTestId('start-screen')).toContainText(name);
  await page.getByTestId('deck-dawntide').click();
  await expect(page.getByTestId('deck-dawntide')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('deck-emberwild')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('opponent-duskmire').click();
  await expect(page.getByTestId('opponent-duskmire')).toHaveAttribute('aria-checked', 'true');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('prompt')).toHaveText('Keep your opening hand?');
  await expect(page.getByTestId('deck-name-0')).toContainText('Dawntide');
  await expect(page.getByTestId('deck-name-1')).toContainText('Duskmire');
  expect(await page.evaluate(() => window.manaDuel.matchup())).toEqual(['dawntide', 'duskmire']);
  expect(errors).toEqual([]);
});

test('the deck viewer shows every card of a deck, with art and details', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.getByTestId('deck-view-duskmire').click();
  const viewer = page.getByTestId('deck-viewer');
  await expect(viewer).toHaveAttribute('data-deck', 'duskmire');
  const counts = await viewer.locator('[data-testid^="deck-card-"]').evaluateAll((cards) => cards.map((card) => Number(card.getAttribute('data-count'))));
  expect(counts.reduce((sum, count) => sum + count, 0)).toBe(40);
  const art = viewer.locator('.art img');
  await expect(art).toHaveCount(counts.length);
  await expect
    .poll(() => art.evaluateAll((images) => images.filter((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0).length))
    .toBe(counts.length);
  await expect(page.getByTestId('mana-curve')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('deck-card-dread_tyrant').click();
  await expect(page.getByTestId('card-sheet')).toContainText('1 copy in Duskmire');
  await page.getByTestId('card-sheet').click({ position: { x: 10, y: 10 } });
  await expect(page.getByTestId('card-sheet')).toHaveCount(0);
  await page.getByTestId('btn-deck-choose').click();
  await expect(viewer).toHaveCount(0);
  await expect(page.getByTestId('deck-duskmire')).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

test('URL parameters pick the decks, and a counterspell targets a spell on the stack', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=3&first=you&deck=dawntide&aiDeck=duskmire&aiDelay=0');
  await expect(page.getByTestId('deck-name-0')).toContainText('Dawntide');
  await expect(page.getByTestId('deck-name-1')).toContainText('Duskmire');
  await page.getByTestId('btn-menu').click();
  await page.getByTestId('menu-decks').click();
  await expect(page.getByTestId('deck-viewer')).toHaveAttribute('data-deck', 'dawntide');
  await page.getByTestId('deck-tab-1').click();
  await expect(page.getByTestId('deck-viewer')).toHaveAttribute('data-deck', 'duskmire');
  await page.getByTestId('btn-deck-close').click();
  await page.evaluate(() =>
    window.manaDuel.loadScenario({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'turn_the_tide', id: 'tide' }], battlefield: ['island', 'island', 'island'] },
        { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
      ],
    }),
  );
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('btn-resolve')).toHaveText('Let it resolve');
  await page.getByTestId('card-tide').click();
  await page.getByTestId('sheet-cast').click();
  await expect(page.getByTestId('prompt')).toHaveText('Choose target spell');
  await page.locator('[data-testid^="stack-"][data-targetable="true"]').click();
  await page.evaluate(() => window.manaDuel.settle());
  expect(await page.evaluate(() => window.manaDuel.state().cards.rhino?.zone)).toBe('graveyard');
  expect(await page.evaluate(() => window.manaDuel.log())).toContain("AI's Timberland Rhino is countered.");
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

test('auto-pass turns off from the URL or from the menu, which remembers it', async ({ page }) => {
  const errors = collectErrors(page);
  const aiTurn = (): Promise<void> =>
    page.evaluate(() => {
      window.manaDuel.loadScenario({ activePlayer: 1, players: [{ hand: ['ember_snap'], battlefield: ['mountain'] }, {}] });
      window.manaDuel.settle();
    });
  await page.goto('/?seed=1&aiDelay=0&autoPass=off');
  await aiTurn();
  await expect(page.getByTestId('prompt')).toHaveText("AI's main phase");
  await page.goto('/?seed=1&aiDelay=0');
  await aiTurn();
  await expect(page.getByTestId('prompt')).toHaveText('Your main phase');
  await page.getByTestId('btn-menu').click();
  await page.getByTestId('menu-autopass').click();
  await page.reload();
  await aiTurn();
  await expect(page.getByTestId('prompt')).toHaveText("AI's main phase");
  await page.getByTestId('btn-menu').click();
  await expect(page.getByTestId('menu-autopass')).toHaveAttribute('aria-checked', 'false');
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

test('Stormglass and Sunmeadow: a flash creature in the opponent’s turn, +1/+1 counters on a card', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=5&first=you&deck=stormglass&aiDeck=sunmeadow&aiDelay=0&autoPass=off');
  await expect(page.getByTestId('deck-name-0')).toContainText('Stormglass');
  await expect(page.getByTestId('deck-name-1')).toContainText('Sunmeadow');
  await page.evaluate(() => {
    window.manaDuel.loadScenario({ activePlayer: 1, players: [{ hand: [{ card: 'squall_skimmer', id: 'skimmer' }], battlefield: ['island', 'island'] }, {}] });
    window.manaDuel.settle();
  });
  await expect(page.getByTestId('prompt')).toHaveText("AI's main phase");
  await page.getByTestId('card-skimmer').click();
  await page.getByTestId('sheet-cast').click();
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('battlefield-0').locator('[data-card="skimmer"]')).toBeVisible();
  expect(await page.evaluate(() => window.manaDuel.log())).toContain('You cast Squall Skimmer.');

  await page.evaluate(() => {
    window.manaDuel.setAutoPass(true);
    window.manaDuel.loadScenario({
      players: [{ hand: [{ card: 'wild_blossom', id: 'blossom' }], battlefield: ['forest', 'forest', { card: 'bristleback_boar', id: 'boar' }] }, {}],
    });
  });
  await page.getByTestId('card-blossom').click();
  await page.getByTestId('sheet-cast').click();
  await expect(page.getByTestId('prompt')).toHaveText('Choose target creature');
  await page.getByTestId('card-boar').click();
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('pt-boar')).toHaveText('5/4');
  await page.getByTestId('card-boar').click({ button: 'right' });
  await expect(page.getByTestId('card-sheet')).toContainText('2 +1/+1 counters');
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('every card shows art that loads in the browser build', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0');
  const ids = await page.evaluate(() => {
    const cards = window.manaDuel.cards().map((card) => card.id);
    window.manaDuel.loadScenario({ players: [{ hand: cards }, {}] });
    return cards;
  });
  const art = page.getByTestId('hand').locator('.art img');
  await expect(art).toHaveCount(ids.length);
  await expect
    .poll(() =>
      art.evaluateAll((images) => images.filter((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0).length),
    )
    .toBe(ids.length);
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
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
