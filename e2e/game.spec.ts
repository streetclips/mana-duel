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
  await expect(page.getByRole('heading', { name: 'Duelo de Maná' })).toBeVisible();
  await expect(page.getByTestId('start-screen')).toContainText('Brasalvaje');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('prompt')).toHaveText('¿Te quedas con tu mano inicial?');
  await expect(page.getByTestId('hand').getByRole('button')).toHaveCount(7);
  expect(errors).toEqual([]);
});

test('the deck selector sets up the chosen matchup', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-deck', 'emberwild');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-deck', 'random');
  await page.getByTestId('seat-0').click();
  const picker = page.getByTestId('deck-picker');
  for (const name of [
    'Brasalvaje',
    'Albamar',
    'Fangoscuro',
    'Cristormenta',
    'Pradosol',
    'Forjaluz',
    'Brumafosa',
    'Selvumbra',
    'Vesperia',
    'Fauceniza',
    'Sotohondo',
    'Crestafuego',
    'Tierrabrava',
    'Encrucijada',
  ]) {
    await expect(picker).toContainText(name);
  }
  await page.getByTestId('deck-dawntide').click();
  await expect(page.getByTestId('deck-dawntide')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('deck-emberwild')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-deck', 'dawntide');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('seat-1').click();
  await expect(picker).toHaveAttribute('data-seat', '1');
  await page.getByTestId('opponent-gloamwood').click();
  await page.getByTestId('opponent-duskmire').click();
  await expect(page.getByTestId('opponent-duskmire')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-deck', 'duskmire');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('btn-picker-done').click();
  await expect(picker).toHaveCount(0);
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('prompt')).toHaveText('¿Te quedas con tu mano inicial?');
  await expect(page.getByTestId('deck-name-0')).toContainText('Albamar');
  await expect(page.getByTestId('deck-name-1')).toContainText('Fangoscuro');
  expect(await page.evaluate(() => window.manaDuel.matchup())).toEqual(['dawntide', 'duskmire']);
  expect(errors).toEqual([]);
});

test('Random draws a deck for either seat when the game starts, and is remembered', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.getByTestId('seat-0').click();
  await expect(page.getByTestId('deck-picker').getByRole('radio').first()).toHaveAttribute('data-testid', 'deck-random');
  await page.getByTestId('deck-random').click();
  await expect(page.getByTestId('deck-random')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-deck', 'random');
  await expect(page.getByTestId('deck-detail')).toContainText('Un mazo distinto en cada partida');
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('btn-picker-done').click();
  await expect(page.getByTestId('seat-1')).toHaveAttribute('data-deck', 'random');
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('prompt')).toHaveText('¿Te quedas con tu mano inicial?');
  const matchup = await page.evaluate(() => window.manaDuel.matchup());
  const names = await page.evaluate(() => Object.fromEntries(window.manaDuel.decks().map((deck) => [deck.id, deck.name])));
  await expect(page.getByTestId('deck-name-0')).toContainText(names[matchup?.[0] ?? ''] ?? 'none');
  await expect(page.getByTestId('deck-name-1')).toContainText(names[matchup?.[1] ?? ''] ?? 'none');
  await page.reload();
  await expect(page.getByTestId('seat-0')).toHaveAttribute('data-deck', 'random');
  expect(errors).toEqual([]);
});

test('the deck viewer shows every card of a deck, with art and details', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.getByTestId('seat-0').click();
  await page.getByTestId('deck-duskmire').click();
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
  await expect(page.getByTestId('card-sheet')).toContainText('1 copia en Fangoscuro');
  await page.getByTestId('card-sheet').click({ position: { x: 10, y: 10 } });
  await expect(page.getByTestId('card-sheet')).toHaveCount(0);
  await page.getByTestId('btn-deck-close').click();
  await expect(viewer).toHaveCount(0);
  await expect(page.getByTestId('deck-picker')).toHaveAttribute('data-seat', '0');
  await expect(page.getByTestId('deck-duskmire')).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

test('every deck box shows its featured art in the browser build', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.getByTestId('seat-1').click();
  const art = page.getByTestId('deck-picker').locator('.box-art img');
  const decks = await page.evaluate(() => window.manaDuel.decks().length);
  await expect(art).toHaveCount(decks);
  await expect
    .poll(() => art.evaluateAll((images) => images.filter((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0).length))
    .toBe(decks);
  expect(errors).toEqual([]);
});

test('URL parameters pick the decks, and a counterspell targets a spell on the stack', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=3&first=you&deck=dawntide&aiDeck=duskmire&aiDelay=0');
  await expect(page.getByTestId('deck-name-0')).toContainText('Albamar');
  await expect(page.getByTestId('deck-name-1')).toContainText('Fangoscuro');
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
  await expect(page.getByTestId('btn-resolve')).toHaveText('Dejar que se resuelva');
  await page.getByTestId('card-tide').click();
  await page.getByTestId('sheet-cast').click();
  await expect(page.getByTestId('prompt')).toHaveText('Elige un hechizo objetivo');
  await page.locator('[data-testid^="stack-"][data-targetable="true"]').click();
  await page.evaluate(() => window.manaDuel.settle());
  expect(await page.evaluate(() => window.manaDuel.state().cards.rhino?.zone)).toBe('graveyard');
  expect(await page.evaluate(() => window.manaDuel.log())).toContain('Se contrarresta Rinoceronte forestal del rival.');
  expect(errors).toEqual([]);
});

test('a human turn can be played with taps only', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=7&first=you&aiDelay=0');
  await page.getByTestId('btn-keep').click();
  await expect(page.getByTestId('prompt')).toHaveText('Tu fase principal');

  const land = page.locator('[data-testid="hand"] [data-def="mountain"]').first();
  const landId = await land.getAttribute('data-card');
  await land.click();
  await page.getByTestId('sheet-playLand').click();
  await expect(page.getByTestId('lands-0').locator(`[data-card="${landId}"]`)).toBeVisible();

  await page.getByTestId('btn-end-turn').click();
  await expect(page.getByTestId('phase')).toContainText('Turno 3', { timeout: 20_000 });
  await expect(page.getByTestId('phase')).toContainText('Tu turno');
  expect(errors).toEqual([]);
});

test('the game log opens from the menu, and the cards it names open above it', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0');
  await expect(page.getByTestId('btn-menu')).toBeVisible();
  await expect(page.getByTestId('btn-log')).toHaveCount(0);
  await page.evaluate(() =>
    window.manaDuel.loadScenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
        { battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      ],
    }),
  );
  await page.getByTestId('card-snap').click();
  await page.getByTestId('sheet-cast').click();
  await page.getByTestId('card-elf').click();
  await page.evaluate(() => window.manaDuel.settle());
  await page.getByTestId('btn-menu').click();
  await page.getByTestId('menu-log').click();
  const log = page.getByTestId('log-panel');
  await log.evaluate((panel) => Promise.all(panel.getAnimations().map((animation) => animation.finished)));
  await expect(log).toContainText('Lanzas Chasquido de brasas sobre Elfa del soto del rival.');
  await expect(log).toContainText('Muere Elfa del soto del rival.');
  await expect(log.getByTestId('log-card-elf')).toHaveCount(3);
  await log.getByTestId('log-card-elf').last().click();
  const sheet = page.getByTestId('card-sheet');
  await expect(sheet.getByRole('dialog', { name: 'Elfa del soto' })).toBeVisible();
  await expect(sheet).toContainText('En el cementerio del rival');
  await sheet.getByRole('heading', { name: 'Elfa del soto' }).click();
  await expect(sheet).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await sheet.click({ position: { x: 10, y: 10 } });
  await expect(sheet).toHaveCount(0);
  await expect(log).toBeVisible();
  await log.getByTestId('log-card-snap').first().click();
  await expect(page.getByTestId('card-sheet')).toContainText('En tu cementerio');
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
  await expect(page.getByTestId('prompt')).toHaveText('Fase principal del rival');
  await page.goto('/?seed=1&aiDelay=0');
  await aiTurn();
  await expect(page.getByTestId('prompt')).toHaveText('Tu fase principal');
  await page.getByTestId('btn-menu').click();
  await page.getByTestId('menu-autopass').click();
  await page.reload();
  await aiTurn();
  await expect(page.getByTestId('prompt')).toHaveText('Fase principal del rival');
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
  await expect(page.getByTestId('prompt')).toHaveText('Elige cualquier objetivo');
  await page.getByTestId('card-elf').click();
  await expect(page.getByTestId('card-elf')).toHaveCount(0);

  await expect(page.getByTestId('prompt')).toHaveText('Elige las atacantes');
  await page.getByTestId('card-rhino').click();
  await page.getByTestId('btn-confirm-attack').click();
  await expect(page.getByTestId('life-1')).toContainText('16');
  await expectNoHorizontalOverflow(page);
});

test('Stormglass and Sunmeadow: a flash creature in the opponent’s turn, +1/+1 counters on a card', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=5&first=you&deck=stormglass&aiDeck=sunmeadow&aiDelay=0&autoPass=off');
  await expect(page.getByTestId('deck-name-0')).toContainText('Cristormenta');
  await expect(page.getByTestId('deck-name-1')).toContainText('Pradosol');
  await page.evaluate(() => {
    window.manaDuel.loadScenario({ activePlayer: 1, players: [{ hand: [{ card: 'squall_skimmer', id: 'skimmer' }], battlefield: ['island', 'island'] }, {}] });
    window.manaDuel.settle();
  });
  await expect(page.getByTestId('prompt')).toHaveText('Fase principal del rival');
  await page.getByTestId('card-skimmer').click();
  await page.getByTestId('sheet-cast').click();
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('battlefield-0').locator('[data-card="skimmer"]')).toBeVisible();
  expect(await page.evaluate(() => window.manaDuel.log())).toContain('Lanzas Ave de la borrasca.');

  await page.evaluate(() => {
    window.manaDuel.setAutoPass(true);
    window.manaDuel.loadScenario({
      players: [{ hand: [{ card: 'wild_blossom', id: 'blossom' }], battlefield: ['forest', 'forest', { card: 'bristleback_boar', id: 'boar' }] }, {}],
    });
  });
  await page.getByTestId('card-blossom').click();
  await page.getByTestId('sheet-cast').click();
  await expect(page.getByTestId('prompt')).toHaveText('Elige una criatura objetivo');
  await page.getByTestId('card-boar').click();
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('pt-boar')).toHaveText('5/4');
  await page.getByTestId('card-boar').click({ button: 'right' });
  await expect(page.getByTestId('card-sheet')).toContainText('2 contadores +1/+1');
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('every card shows art that loads in the browser build, tokens on the battlefield', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0');
  const { cards, tokens } = await page.evaluate(() => {
    const all = window.manaDuel.cards();
    const cards = all.filter((card) => !card.token).map((card) => card.id);
    const tokens = all.filter((card) => card.token).map((card) => card.id);
    window.manaDuel.loadScenario({ players: [{ hand: cards, battlefield: tokens }, {}] });
    return { cards, tokens };
  });
  expect(tokens.length).toBeGreaterThan(0);
  for (const [zone, count] of [['hand', cards.length], ['battlefield-0', tokens.length]] as const) {
    const art = page.getByTestId(zone).locator('.art img');
    await expect(art).toHaveCount(count);
    await expect
      .poll(() =>
        art.evaluateAll((images) => images.filter((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0).length),
      )
      .toBe(count);
  }
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('every card name fits two lines in hand, and ability pills fit their cards on the battlefield', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0');
  const cards = await page.evaluate(() => {
    const cards = window.manaDuel
      .cards()
      .filter((card) => !card.token)
      .map((card) => card.id);
    window.manaDuel.loadScenario({
      players: [
        {
          hand: cards,
          battlefield: [
            { card: 'crag_dragon', id: 'dragon' },
            { card: 'grove_tender', id: 'elf' },
            { card: 'kelpweaver_druid', id: 'druid', tapped: true },
            { card: 'duskmire_shade', id: 'shade' },
            'mountain',
          ],
        },
        {
          battlefield: [
            { card: 'bloodspore_thrall', id: 'thrall' },
            { card: 'bonewood_stalker', id: 'stalker' },
            { card: 'wayfarer_druid', id: 'wayfarer' },
            { card: 'tribe_elder', id: 'elder' },
          ],
        },
      ],
    });
    return cards;
  });
  const overflowingNames = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="hand"] .card .name')]
      .filter((name) => name.scrollHeight > name.clientHeight + 1)
      .map((name) => name.textContent),
  );
  expect(overflowingNames).toEqual([]);
  await expect(page.getByTestId('hand').locator('.card .name')).toHaveCount(cards.length);
  const pills = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.permanent .ability')].map((pill) => {
      const box = pill.getBoundingClientRect();
      const card = (pill.closest('.card') as HTMLElement).getBoundingClientRect();
      const inside = box.left >= card.left - 0.5 && box.right <= card.right + 0.5 && box.top >= card.top - 0.5 && box.bottom <= card.bottom + 0.5;
      return { pill: pill.dataset.testid, inside, fits: pill.scrollWidth <= pill.clientWidth + 1 };
    }),
  );
  expect(pills.map((pill) => pill.pill).sort()).toEqual(
    [
      'ability-dragon-0',
      'ability-druid-mana',
      'ability-elf-mana',
      'ability-shade-0',
      'ability-stalker-0',
      'ability-thrall-0',
      'ability-wayfarer-mana',
      'ability-elder-0',
    ].sort(),
  );
  expect(pills.filter((pill) => !pill.inside || !pill.fits)).toEqual([]);
  await expect(page.getByTestId('ability-dragon-0')).toHaveAttribute('data-usable', 'true');
  await expect(page.getByTestId('ability-shade-0')).not.toHaveAttribute('data-usable');
  await expect(page.getByTestId('ability-druid-mana')).toHaveAttribute('data-spent', 'true');
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('each card in a crowded hand lies over the one before it, playable or not', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0&fx=off');
  await page.evaluate(() =>
    window.manaDuel.loadScenario({
      players: [
        {
          hand: [
            { card: 'island', id: 'island1' },
            { card: 'mistcloak_ambusher', id: 'ambusher' },
            { card: 'island', id: 'island2' },
            { card: 'inkwell_scribe', id: 'scribe' },
            { card: 'choking_mist', id: 'mist' },
            { card: 'swamp', id: 'swamp1' },
            { card: 'swamp', id: 'swamp2' },
          ],
        },
        {},
      ],
    }),
  );
  await expect(page.getByTestId('card-ambusher')).not.toHaveAttribute('data-playable');
  await expect(page.getByTestId('card-island2')).toHaveAttribute('data-playable', 'true');
  const overlaps = await page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('[data-testid="hand"] .hand-card')];
    return cards.flatMap((card, index) => {
      const previous = cards[index - 1];
      if (!previous) return [];
      const before = previous.getBoundingClientRect();
      const box = card.getBoundingClientRect();
      const x = (box.left + before.right) / 2;
      const hits = [0.15, 0.5, 0.9].map((height) => document.elementFromPoint(x, box.top + box.height * height)?.closest<HTMLElement>('.hand-card')?.dataset.card);
      return [{ card: card.dataset.card, overlap: before.right - box.left, hits }];
    });
  });
  expect(overlaps.map((pair) => pair.card)).toEqual(['ambusher', 'island2', 'scribe', 'mist', 'swamp1', 'swamp2']);
  for (const pair of overlaps) {
    expect(pair.overlap).toBeGreaterThan(0);
    expect(pair.hits).toEqual([pair.card, pair.card, pair.card]);
  }
  expect(errors).toEqual([]);
});

test('mana symbols sit centred on the lowercase letters of the text around them, in hand and in the card sheet', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=1&aiDelay=0&fx=off');
  await page.evaluate(() =>
    window.manaDuel.loadScenario({
      players: [{ hand: [{ card: 'swamp', id: 'swamp' }], battlefield: [{ card: 'crag_dragon', id: 'dragon' }, 'mountain'] }, {}],
    }),
  );
  await page.getByTestId('card-dragon').click();
  await expect(page.getByTestId('sheet-activate')).toBeVisible();
  const symbols = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="hand"] .text .pip, .detail-info .pip, .sheet-actions .pip')].map((pip) => {
      const lowercase = document.createElement('span');
      lowercase.style.cssText = 'display: inline-block; width: 0; height: 1ex';
      pip.after(lowercase);
      const middle = lowercase.getBoundingClientRect();
      lowercase.remove();
      const box = pip.getBoundingClientRect();
      return { place: pip.closest('.text, .detail-info, .sheet-actions')?.className, offCentre: Math.abs(box.top + box.bottom - middle.top - middle.bottom) / 2 };
    }),
  );
  expect(symbols.map((symbol) => symbol.place)).toEqual(['text', 'text', 'detail-info', 'sheet-actions']);
  expect(symbols.filter((symbol) => symbol.offCentre > 0.5)).toEqual([]);
  expect(errors).toEqual([]);
});

test('Brightforge, Mistgrave and Gloamwood: tokens from a spell, a discard the AI forces, an undying creature sacrificed', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=5&first=you&deck=brightforge&aiDeck=mistgrave&aiDelay=0');
  await expect(page.getByTestId('deck-name-0')).toContainText('Forjaluz');
  await expect(page.getByTestId('deck-name-1')).toContainText('Brumafosa');
  await page.evaluate(() =>
    window.manaDuel.loadScenario({ players: [{ hand: [{ card: 'raise_the_banners', id: 'banners' }], battlefield: ['plains', 'plains'] }, {}] }),
  );
  await page.getByTestId('card-banners').click();
  await page.getByTestId('sheet-cast').click();
  await page.evaluate(() => window.manaDuel.settle());
  const soldiers = page.getByTestId('battlefield-0').locator('[data-def="soldier_token"]');
  await expect(soldiers).toHaveCount(2);
  await soldiers.first().click({ button: 'right' });
  await expect(page.getByTestId('card-sheet')).toContainText('Criatura ficha — Soldado');
  await page.getByTestId('card-sheet').click({ position: { x: 10, y: 10 } });

  await page.evaluate(() => {
    window.manaDuel.loadScenario({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'forest', id: 'f' }, { card: 'ember_snap', id: 'snap' }] },
        { hand: [{ card: 'memory_leech', id: 'leech' }], battlefield: ['swamp', 'swamp', 'swamp'] },
      ],
    });
    window.manaDuel.settle();
  });
  await expect(page.getByTestId('prompt')).toHaveText('Elige 1 carta para descartar');
  await expect(page.getByTestId('prompt-detail')).toHaveText('Sanguijuela mental · 0/1 elegida');
  await page.getByTestId('card-snap').click();
  await page.getByTestId('btn-confirm-cards').click();
  await page.evaluate(() => window.manaDuel.settle());
  expect(await page.evaluate(() => window.manaDuel.state().cards.snap?.zone)).toBe('graveyard');
  expect(await page.evaluate(() => window.manaDuel.log())).toContain('Descartas Chasquido de brasas.');

  await page.evaluate(() => window.manaDuel.loadScenario({ players: [{ battlefield: [{ card: 'bloodspore_thrall', id: 'thrall' }] }, {}] }));
  await page.getByTestId('card-thrall').click();
  await page.getByTestId('sheet-activate').click();
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('pt-thrall')).toHaveText('2/2');
  await expect(page.getByTestId('life-1')).toHaveText('19');
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('Vesperhall, Cindermaw and Deepgrove: hexproof hides a target, life gain and evolve grow creatures, bloodthirst after a hit', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=5&first=you&deck=vesperhall&aiDeck=deepgrove&aiDelay=0');
  await expect(page.getByTestId('deck-name-0')).toContainText('Vesperia');
  await expect(page.getByTestId('deck-name-1')).toContainText('Sotohondo');
  await page.evaluate(() =>
    window.manaDuel.loadScenario({
      players: [
        { hand: [{ card: 'penance', id: 'penance' }], battlefield: ['plains', 'swamp', { card: 'vesper_novice', id: 'novice' }] },
        { battlefield: [{ card: 'mossfin_lurker', id: 'lurker' }, { card: 'kelpweaver_druid', id: 'druid' }] },
      ],
    }),
  );
  await page.getByTestId('card-penance').click();
  await page.getByTestId('sheet-cast').click();
  await expect(page.getByTestId('prompt')).toHaveText('Elige una criatura objetivo');
  await expect(page.getByTestId('card-druid')).toHaveAttribute('data-targetable', 'true');
  await expect(page.getByTestId('card-lurker')).not.toHaveAttribute('data-targetable', 'true');
  await page.getByTestId('card-druid').click();
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('life-0')).toHaveText('22');
  await expect(page.getByTestId('pt-novice')).toHaveText('2/2');

  await page.evaluate(() =>
    window.manaDuel.loadScenario({
      players: [{ hand: [{ card: 'kelpweaver_druid', id: 'druid' }], battlefield: ['forest', 'forest', { card: 'shoal_hatchling', id: 'hatchling' }] }, {}],
    }),
  );
  await page.getByTestId('card-druid').click();
  await page.getByTestId('sheet-cast').click();
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('pt-hatchling')).toHaveText('2/2');

  await page.evaluate(() =>
    window.manaDuel.loadScenario({
      players: [
        {
          hand: [{ card: 'bloodfire_bolt', id: 'bolt' }, { card: 'blistering_hellion', id: 'hellion' }],
          battlefield: ['swamp', 'mountain', 'mountain', 'mountain', 'mountain'],
        },
        {},
      ],
    }),
  );
  await page.getByTestId('card-bolt').click();
  await page.getByTestId('sheet-cast').click();
  await page.getByTestId('player-1').click();
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('life-1')).toHaveText('17');
  await page.getByTestId('card-hellion').click();
  await page.getByTestId('sheet-cast').click();
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('pt-hellion')).toHaveText('5/4');
  await page.getByTestId('card-hellion').click({ button: 'right' });
  await expect(page.getByTestId('card-sheet')).toContainText('2 contadores +1/+1');
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('Flamecrest, Wildland and Crossroads: prowess on an instant, landfall on a land drop, a tri-land that enters tapped', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=5&first=you&deck=flamecrest&aiDeck=crossroads&aiDelay=0');
  await expect(page.getByTestId('deck-name-0')).toContainText('Crestafuego');
  await expect(page.getByTestId('deck-name-1')).toContainText('Encrucijada');
  await page.evaluate(() =>
    window.manaDuel.loadScenario({
      players: [{ hand: [{ card: 'spark_volley', id: 'volley' }], battlefield: ['mountain', { card: 'cloister_lancer', id: 'lancer' }] }, {}],
    }),
  );
  await expect(page.getByTestId('card-lancer').locator('.icon[data-icon="prowess"]')).toHaveCount(1);
  await page.getByTestId('card-volley').click();
  await page.getByTestId('sheet-cast').click();
  await page.getByTestId('player-1').click();
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('life-1')).toHaveText('19');
  await expect(page.getByTestId('pt-lancer')).toHaveText('3/3');

  await page.evaluate(() =>
    window.manaDuel.loadScenario({
      players: [{ hand: [{ card: 'forest', id: 'land' }], battlefield: [{ card: 'cliff_lynx', id: 'lynx' }, { card: 'quake_boar', id: 'boar' }] }, {}],
    }),
  );
  await page.getByTestId('card-land').click();
  await page.getByTestId('sheet-playLand').click();
  await page.evaluate(() => window.manaDuel.settle());
  await expect(page.getByTestId('pt-lynx')).toHaveText('3/3');
  await expect(page.getByTestId('pt-boar')).toHaveText('2/3');
  expect(await page.evaluate(() => window.manaDuel.log())).toContain('Se dispara tu Lince del risco.');

  await page.evaluate(() =>
    window.manaDuel.loadScenario({
      players: [{ hand: [{ card: 'silver_spire', id: 'spire' }, { card: 'sky_messenger', id: 'messenger' }], battlefield: ['plains'] }, {}],
    }),
  );
  await expect(page.getByTestId('card-spire').locator('.text .pip')).toHaveCount(3);
  await page.getByTestId('card-spire').click();
  await page.getByTestId('sheet-playLand').click();
  await expect(page.getByTestId('card-spire')).toHaveAttribute('data-tapped', 'true');
  await expect(page.getByTestId('card-spire')).toHaveClass(/multi/);
  await expect(page.getByTestId('card-messenger')).not.toHaveAttribute('data-playable');
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test('the AI can finish a whole game and the result is shown', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?seed=21&aiDelay=0&skipMulligan=1');
  const result = await page.evaluate(() => window.manaDuel.playToEnd());
  expect(result?.kind).toBe('gameOver');
  await expect(page.getByTestId('game-over')).toBeVisible();
  await expect(page.getByTestId('game-over-title')).toHaveText(/Victoria|Derrota|Empate/);
  const log = await page.evaluate(() => window.manaDuel.log());
  expect(log.length).toBeGreaterThan(20);
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('btn-home').click();
  await expect(page.getByTestId('start-screen')).toBeVisible();
  await expect(page.getByTestId('game')).toHaveCount(0);
  await page.getByTestId('btn-play').click();
  await expect(page.getByTestId('prompt')).toHaveText('¿Te quedas con tu mano inicial?');
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
