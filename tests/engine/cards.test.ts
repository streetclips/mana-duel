import { describe, expect, it } from 'vitest';
import {
  BRIGHTFORGE,
  CINDERMAW,
  DECK_LIST,
  DEEPGROVE,
  EMBERWILD,
  EVOLVE_TRIGGER,
  GLOAMWOOD,
  MISTGRAVE,
  STORMGLASS,
  SUNMEADOW,
  VESPERHALL,
  cardSummary,
  costColors,
  deckSize,
  expandDeck,
  getCardDef,
  getCost,
  getDeck,
  hasDeck,
  registerCard,
  rulesText,
  triggerText,
  typeLine,
  UNDYING_TRIGGER,
  type CardDef,
} from '../../src/engine';
import { CORE_CARDS } from '../../src/engine/cards';

const isLandId = (id: string): boolean => getCardDef(id).types.includes('land');

describe('decks', () => {
  it('are Emberwild, Dawntide, Duskmire, Stormglass, Sunmeadow, Brightforge, Mistgrave, Gloamwood, Vesperhall, Cindermaw and Deepgrove', () => {
    expect(DECK_LIST.map((deck) => deck.id)).toEqual([
      'emberwild',
      'dawntide',
      'duskmire',
      'stormglass',
      'sunmeadow',
      'brightforge',
      'mistgrave',
      'gloamwood',
      'vesperhall',
      'cindermaw',
      'deepgrove',
    ]);
    expect(getDeck('emberwild')).toBe(EMBERWILD);
    expect(getDeck('stormglass')).toBe(STORMGLASS);
    expect(getDeck('sunmeadow')).toBe(SUNMEADOW);
    expect(getDeck('brightforge')).toBe(BRIGHTFORGE);
    expect(getDeck('mistgrave')).toBe(MISTGRAVE);
    expect(getDeck('gloamwood')).toBe(GLOAMWOOD);
    expect(getDeck('vesperhall')).toBe(VESPERHALL);
    expect(getDeck('cindermaw')).toBe(CINDERMAW);
    expect(getDeck('deepgrove')).toBe(DEEPGROVE);
  });

  it('cover every pair of colors once, and black on its own', () => {
    const combinations = DECK_LIST.map((deck) => [...deck.colors].sort().join(''));
    expect(new Set(combinations).size).toBe(DECK_LIST.length);
    expect(combinations.filter((colors) => colors.length === 2)).toHaveLength(10);
  });

  for (const deck of DECK_LIST) {
    describe(deck.name, () => {
      it('has 40 cards, 16 of them lands', () => {
        expect(deckSize(deck)).toBe(40);
        const cards = expandDeck(deck);
        expect(cards).toHaveLength(40);
        expect(cards.filter(isLandId)).toHaveLength(16);
      });

      it('only uses its own colors', () => {
        for (const id of new Set(expandDeck(deck))) {
          const def = getCardDef(id);
          for (const color of [...costColors(getCost(id)), ...(def.mana ?? [])]) expect(deck.colors, id).toContain(color);
        }
      });

      it('lists each card once and features one of its own cards', () => {
        const ids = deck.cards.map((entry) => entry.card);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain(deck.featured);
        expect(isLandId(deck.featured)).toBe(false);
      });
    });
  }

  it('share no card except basic lands', () => {
    const owners = new Map<string, string[]>();
    for (const deck of DECK_LIST) {
      for (const entry of deck.cards) owners.set(entry.card, [...(owners.get(entry.card) ?? []), deck.id]);
    }
    for (const [id, decks] of owners) {
      if (decks.length > 1) expect(getCardDef(id).supertypes, `${id} is in ${decks.join(', ')}`).toContain('Basic');
    }
  });

  it('use every card in the game, and every token is created by one of their cards', () => {
    const used = new Set(DECK_LIST.flatMap((deck) => deck.cards.map((entry) => entry.card)));
    expect(CORE_CARDS.filter((def) => !def.token && !used.has(def.id)).map((def) => def.id)).toEqual([]);
    const created = new Set(
      [...used].flatMap((id) => {
        const def = getCardDef(id);
        const abilities = [def.spell, ...(def.triggers ?? []), ...(def.activated ?? [])];
        return abilities.flatMap((ability) => (ability?.effects ?? []).flatMap((effect) => (effect.kind === 'createTokens' ? [effect.token] : [])));
      }),
    );
    expect([...created].sort()).toEqual(CORE_CARDS.filter((def) => def.token).map((def) => def.id).sort());
    for (const id of created) expect(getCardDef(id).token).toBe(true);
  });

  it('are looked up by id', () => {
    expect(hasDeck('dawntide')).toBe(true);
    expect(hasDeck('toString')).toBe(false);
    expect(() => getDeck('nope')).toThrow(/Unknown deck/);
  });
});

describe('rules text', () => {
  const expected: Record<string, { type: string; text: string[] }> = {
    forest: { type: 'Basic Land — Forest', text: ['{T}: Add {G}.'] },
    mountain: { type: 'Basic Land — Mountain', text: ['{T}: Add {R}.'] },
    grove_tender: { type: 'Creature — Elf Druid', text: ['{T}: Add {G}.'] },
    moss_viper: { type: 'Creature — Snake', text: ['Deathtouch'] },
    ember_hound: { type: 'Creature — Elemental Dog', text: ['Haste'] },
    canopy_spider: { type: 'Creature — Spider', text: ['Reach'] },
    ashen_duelist: { type: 'Creature — Human Warrior', text: ['First strike'] },
    cinder_adept: {
      type: 'Creature — Human Shaman',
      text: ['When this creature enters, it deals 1 damage to any target.'],
    },
    ridge_marauder: { type: 'Creature — Human Berserker', text: ['Menace'] },
    bramble_warden: { type: 'Creature — Plant Warrior', text: ['Vigilance'] },
    timberland_rhino: { type: 'Creature — Rhino', text: ['Trample'] },
    cinderwing_drake: { type: 'Creature — Drake', text: ['Flying'] },
    crag_dragon: { type: 'Creature — Dragon', text: ['Flying', '{R}: This creature gets +1/+0 until end of turn.'] },
    ember_snap: { type: 'Instant', text: ['Ember Snap deals 2 damage to any target.'] },
    magma_lance: { type: 'Sorcery', text: ['Magma Lance deals 4 damage to target creature.'] },
    verdant_surge: { type: 'Instant', text: ['Target creature gets +3/+3 until end of turn.'] },
    feral_clash: { type: 'Sorcery', text: ["Target creature you control fights target creature you don't control."] },
    read_the_roots: { type: 'Sorcery', text: ['Draw two cards.'] },
    plains: { type: 'Basic Land — Plains', text: ['{T}: Add {W}.'] },
    island: { type: 'Basic Land — Island', text: ['{T}: Add {U}.'] },
    swamp: { type: 'Basic Land — Swamp', text: ['{T}: Add {B}.'] },
    mist_sprite: { type: 'Creature — Faerie', text: ['Flying'] },
    dawn_acolyte: { type: 'Creature — Human Cleric', text: ['Lifelink'] },
    reefshell_crab: { type: 'Creature — Crab', text: ['Defender'] },
    beacon_squire: { type: 'Creature — Human Soldier', text: ['Vigilance'] },
    reef_scholar: { type: 'Creature — Merfolk Wizard', text: ['When this creature enters, draw a card.'] },
    galewing_falcon: { type: 'Creature — Bird', text: ['Flying'] },
    sunblade_paladin: { type: 'Creature — Human Knight', text: ['Double strike'] },
    cloudrider_knight: { type: 'Creature — Human Knight', text: ['Flying, vigilance'] },
    aurora_seraph: { type: 'Creature — Angel', text: ['Flying, lifelink'] },
    radiant_blessing: { type: 'Instant', text: ['Target creature gets +2/+2 until end of turn. You gain 2 life.'] },
    undertow: { type: 'Instant', text: ["Return target creature to its owner's hand."] },
    turn_the_tide: { type: 'Instant', text: ['Counter target spell.'] },
    tidal_insight: { type: 'Instant', text: ['Draw two cards.'] },
    dawns_verdict: { type: 'Instant', text: ['Destroy target tapped creature.'] },
    gloom_wisp: { type: 'Creature — Spirit', text: ['When this creature dies, draw a card.'] },
    duskwing_bat: { type: 'Creature — Bat', text: ['Flying, lifelink'] },
    mire_prowler: { type: 'Creature — Zombie', text: ['Menace'] },
    grave_hexer: {
      type: 'Creature — Human Warlock',
      text: ["When this creature enters, target creature you don't control gets -1/-1 until end of turn."],
    },
    bog_lurker: { type: 'Creature — Horror', text: ['Deathtouch'] },
    crypt_ghoul: { type: 'Creature — Zombie', text: ['When this creature dies, it deals 1 damage to target opponent.'] },
    duskmire_shade: { type: 'Creature — Shade', text: ['{B}: This creature gets +1/+1 until end of turn.'] },
    blood_reaver: { type: 'Creature — Vampire', text: ['Lifelink'] },
    nightveil_wraith: {
      type: 'Creature — Spirit',
      text: ['Flying', 'When this creature dies, it deals 2 damage to target opponent.'],
    },
    dread_tyrant: { type: 'Creature — Demon', text: ['Flying', 'When this creature enters, you lose 2 life.'] },
    withering_touch: { type: 'Instant', text: ['Target creature gets -2/-2 until end of turn.'] },
    nights_bargain: { type: 'Sorcery', text: ['Draw two cards. You lose 2 life.'] },
    soul_siphon: { type: 'Sorcery', text: ['Soul Siphon deals 2 damage to any target. You gain 2 life.'] },
    grave_sentence: { type: 'Instant', text: ['Destroy target creature.'] },
    kiln_sprite: {
      type: 'Creature — Elemental',
      text: ['Haste', 'Whenever you cast an instant or sorcery spell, it gets +1/+1 until end of turn.'],
    },
    squall_skimmer: { type: 'Creature — Bird', text: ['Flash, flying'] },
    arc_initiate: {
      type: 'Creature — Human Monk',
      text: ['Whenever you cast an instant or sorcery spell, it gets +1/+1 until end of turn.'],
    },
    glassreef_sentinel: { type: 'Creature — Merfolk Soldier', text: ['Flash'] },
    galvanic_channeler: {
      type: 'Creature — Human Shaman',
      text: ['Whenever you cast an instant or sorcery spell, it deals 1 damage to target opponent.'],
    },
    wavecrest_mystic: {
      type: 'Creature — Merfolk Wizard',
      text: ['Flash', "When this creature enters, return target creature you don't control to its owner's hand."],
    },
    stormglass_drake: {
      type: 'Creature — Drake',
      text: ['Flying', 'Whenever you cast an instant or sorcery spell, put a +1/+1 counter on it.'],
    },
    thunderhead_djinn: { type: 'Creature — Djinn', text: ['Flying', 'When this creature enters, it deals 2 damage to any target.'] },
    static_jolt: { type: 'Instant', text: ['Static Jolt deals 1 damage to any target. Draw a card.'] },
    stormflare: { type: 'Sorcery', text: ['Stormflare deals 3 damage to any target.'] },
    brine_rebuke: { type: 'Instant', text: ["Return target creature to its owner's hand. Draw a card."] },
    refracted_insight: { type: 'Instant', text: ['Draw two cards. Refracted Insight deals 1 damage to any target.'] },
    shattered_intent: { type: 'Instant', text: ['Counter target spell.'] },
    hopeful_squire: { type: 'Creature — Human Soldier', text: ['Whenever this creature attacks, put a +1/+1 counter on it.'] },
    warren_hare: {
      type: 'Creature — Rabbit',
      text: ['When this creature dies, put a +1/+1 counter on target creature you control.'],
    },
    bloomcaller_druid: {
      type: 'Creature — Elf Druid',
      text: ['When this creature enters, put a +1/+1 counter on target creature you control.'],
    },
    bristleback_boar: { type: 'Creature — Boar', text: ['Trample'] },
    sunmeadow_herald: {
      type: 'Creature — Human Soldier',
      text: ['Whenever this creature attacks, creatures you control get +1/+0 until end of turn.'],
    },
    hearthfield_cleric: { type: 'Creature — Human Cleric', text: ['When this creature enters, you gain 3 life.'] },
    thornglade_archer: { type: 'Creature — Elf Archer', text: ['Reach'] },
    mossbark_bear: {
      type: 'Creature — Bear',
      text: ['When this creature enters, put a +1/+1 counter on target creature you control.'],
    },
    skyguard_griffin: {
      type: 'Creature — Griffin',
      text: ['Flying', 'When this creature enters, put a +1/+1 counter on target creature you control.'],
    },
    sunantler_monarch: {
      type: 'Creature — Elk',
      text: ['Vigilance', 'When this creature enters, put a +1/+1 counter on each creature you control.'],
    },
    rally_the_meadow: { type: 'Instant', text: ['Creatures you control get +1/+1 until end of turn.'] },
    wild_blossom: { type: 'Instant', text: ['Put two +1/+1 counters on target creature.'] },
    pack_pounce: {
      type: 'Sorcery',
      text: ["Put a +1/+1 counter on target creature you control. It fights target creature you don't control."],
    },
    harvest_hymn: { type: 'Sorcery', text: ['Put a +1/+1 counter on each creature you control. You gain 2 life.'] },
    soldier_token: { type: 'Token Creature — Soldier', text: [] },
    elemental_token: { type: 'Token Creature — Elemental', text: ['Haste'] },
    saproling_token: { type: 'Token Creature — Saproling', text: [] },
    forge_cadet: {
      type: 'Creature — Human Soldier',
      text: ['Whenever another creature you control enters, put a +1/+1 counter on this creature.'],
    },
    muster_sergeant: { type: 'Creature — Human Soldier', text: ['When this creature enters, create a 1/1 white Soldier creature token.'] },
    sunsteel_lancer: { type: 'Creature — Human Knight', text: ['First strike'] },
    kindling_caller: {
      type: 'Creature — Human Shaman',
      text: ['When this creature enters, create a 1/1 red Elemental creature token with haste.'],
    },
    bannerguard_knight: {
      type: 'Creature — Human Knight',
      text: ['Vigilance', 'When this creature enters, create a 1/1 white Soldier creature token.'],
    },
    hammerfall_raider: {
      type: 'Creature — Human Warrior',
      text: ['Whenever this creature attacks, create a 1/1 red Elemental creature token with haste.'],
    },
    brightforge_marshal: { type: 'Creature — Human Soldier', text: ['When this creature enters, create two 1/1 white Soldier creature tokens.'] },
    forgewing_griffin: { type: 'Creature — Griffin', text: ['Flying', 'When this creature enters, create a 1/1 white Soldier creature token.'] },
    brightforge_warlord: {
      type: 'Creature — Human Knight',
      text: ['When this creature enters, creatures you control get +1/+0 and gain haste until end of turn.'],
    },
    raise_the_banners: { type: 'Instant', text: ['Create two 1/1 white Soldier creature tokens.'] },
    molten_rebuke: { type: 'Instant', text: ['Molten Rebuke deals 3 damage to target creature.'] },
    sunbrand: { type: 'Instant', text: ['Sunbrand deals 3 damage to any target. You gain 3 life.'] },
    charge_of_the_forge: { type: 'Instant', text: ['Creatures you control get +1/+0 and gain first strike until end of turn.'] },
    stoke_the_forge: { type: 'Sorcery', text: ['Create two 1/1 red Elemental creature tokens with haste.'] },
    gutterfang_rat: { type: 'Creature — Rat', text: ['Skulk, deathtouch'] },
    fogslip_thief: {
      type: 'Creature — Human Rogue',
      text: ['Skulk', 'Whenever this creature deals combat damage to a player, draw a card.'],
    },
    hushwing_bat: {
      type: 'Creature — Bat',
      text: ['Flying', 'Whenever this creature deals combat damage to a player, that player discards a card.'],
    },
    inkwell_scribe: { type: 'Creature — Human Wizard', text: ['When this creature enters, draw a card, then discard a card.'] },
    memory_leech: { type: 'Creature — Leech', text: ['When this creature enters, each opponent discards a card.'] },
    mistcloak_ambusher: { type: 'Creature — Human Rogue', text: ['Flash, skulk'] },
    veilborn_specter: {
      type: 'Creature — Specter',
      text: ['Flying', 'Whenever this creature deals combat damage to a player, draw a card.'],
    },
    mistgrave_revenant: {
      type: 'Creature — Zombie Horror',
      text: ['Skulk', 'Whenever this creature deals combat damage to a player, draw a card. That player discards a card.'],
    },
    rob_the_mind: { type: 'Sorcery', text: ['Each opponent discards two cards.'] },
    drag_below: {
      type: 'Instant',
      text: ["Return target creature you don't control to its owner's hand. Each opponent discards a card."],
    },
    choking_mist: { type: 'Instant', text: ['Target creature gets -3/-3 until end of turn.'] },
    sift_the_depths: { type: 'Instant', text: ['Draw two cards, then discard a card.'] },
    drown_the_truth: { type: 'Instant', text: ['Destroy target creature.'] },
    gravebloom_sprout: { type: 'Creature — Plant', text: ['Undying'] },
    rotwing_crow: {
      type: 'Creature — Bird',
      text: ['Flying', 'Whenever another creature you control dies, each opponent loses 1 life.'],
    },
    rootgnaw_boar: {
      type: 'Creature — Boar',
      text: ['Whenever another creature you control dies, put a +1/+1 counter on this creature.'],
    },
    bloodspore_thrall: { type: 'Creature — Fungus Zombie', text: ['Undying', 'Sacrifice this creature: Each opponent loses 1 life.'] },
    bonewood_stalker: {
      type: 'Creature — Zombie Beast',
      text: ['Sacrifice this creature: Target creature gets -2/-2 until end of turn.'],
    },
    sporecap_shambler: {
      type: 'Creature — Fungus',
      text: ['When this creature dies, create two 1/1 green Saproling creature tokens.'],
    },
    gloomsilk_spider: { type: 'Creature — Spider', text: ['Reach, deathtouch'] },
    rotbark_treefolk: { type: 'Creature — Treefolk', text: ['Undying'] },
    gloamwood_elder: {
      type: 'Creature — Treefolk Shaman',
      text: ['Reach', 'Whenever another creature you control dies, create a 1/1 green Saproling creature token.'],
    },
    venom_duel: {
      type: 'Sorcery',
      text: ["Target creature you control gains deathtouch until end of turn. It fights target creature you don't control."],
    },
    rot_into_loam: {
      type: 'Instant',
      text: ['Target creature gets -2/-2 until end of turn. Create a 1/1 green Saproling creature token.'],
    },
    sporecall: { type: 'Sorcery', text: ['Create two 1/1 green Saproling creature tokens.'] },
    nightshade_tonic: { type: 'Instant', text: ['Target creature gets +1/+1 and gains deathtouch until end of turn.'] },
    vesper_novice: { type: 'Creature — Human Cleric', text: ['Whenever you gain life, put a +1/+1 counter on this creature.'] },
    tithe_collector: {
      type: 'Creature — Human Rogue',
      text: ['When this creature enters, each opponent loses 1 life. You gain 1 life.'],
    },
    chantry_guard: { type: 'Creature — Human Soldier', text: ['Lifelink'] },
    ghostlit_penitent: { type: 'Creature — Spirit Cleric', text: ['Flying, lifelink'] },
    censer_bearer: {
      type: 'Creature — Human Cleric',
      text: ['When this creature enters, create a 1/1 white and black Spirit creature token with flying.'],
    },
    sanguine_chorister: { type: 'Creature — Vampire Cleric', text: ['Whenever you gain life, each opponent loses 1 life.'] },
    ashveil_executioner: { type: 'Creature — Human Assassin', text: ['Deathtouch, lifelink'] },
    lanternwing_angel: { type: 'Creature — Angel', text: ['Flying, lifelink'] },
    gilded_confessor: {
      type: 'Creature — Human Cleric',
      text: ["When this creature enters, target creature you don't control gets -1/-1 until end of turn. You gain 2 life."],
    },
    vesperhall_matriarch: {
      type: 'Creature — Vampire Noble',
      text: ['Flying', 'Whenever you gain life, put a +1/+1 counter on this creature.'],
    },
    penance: { type: 'Instant', text: ['Target creature gets -2/-2 until end of turn. You gain 2 life.'] },
    vesper_vow: { type: 'Instant', text: ['Target creature gets +2/+2 and gains lifelink until end of turn.'] },
    rite_of_lanterns: { type: 'Sorcery', text: ['Create two 1/1 white and black Spirit creature tokens with flying.'] },
    last_rites: { type: 'Sorcery', text: ['Destroy target creature. You gain 2 life.'] },
    blood_tithe: { type: 'Sorcery', text: ['Each opponent loses 2 life. You gain 2 life. Draw a card.'] },
    spirit_token: { type: 'Token Creature — Spirit', text: ['Flying'] },
    spitfire_imp: { type: 'Creature — Imp', text: ['Haste', 'When this creature dies, it deals 1 damage to any target.'] },
    bloodhungry_ghoul: {
      type: 'Creature — Zombie',
      text: ['When this creature enters, if an opponent was dealt damage this turn, put a +1/+1 counter on it.'],
    },
    pitfire_raider: { type: 'Creature — Human Berserker', text: ['Haste, menace'] },
    brimstone_skirmisher: {
      type: 'Creature — Goblin Warrior',
      text: ['Whenever this creature attacks, it deals 1 damage to target opponent.'],
    },
    blistering_hellion: {
      type: 'Creature — Hellion',
      text: ['When this creature enters, if an opponent was dealt damage this turn, put two +1/+1 counters on it.'],
    },
    pyre_ghast: { type: 'Creature — Zombie Spirit', text: ['When this creature dies, it deals 2 damage to any target.'] },
    gorehorn_minotaur: {
      type: 'Creature — Minotaur Berserker',
      text: ['Menace', 'When this creature enters, if an opponent was dealt damage this turn, put a +1/+1 counter on it.'],
    },
    scorchfang_hound: {
      type: 'Creature — Hound',
      text: ['Haste', 'Whenever this creature attacks, it deals 1 damage to target opponent.'],
    },
    cindermaw_demon: {
      type: 'Creature — Demon',
      text: ['Flying', 'When this creature enters, if an opponent was dealt damage this turn, put two +1/+1 counters on it.'],
    },
    splitting_flame: {
      type: 'Sorcery',
      text: ['Splitting Flame deals 2 damage to target creature and 2 damage to target opponent.'],
    },
    bloodfire_bolt: { type: 'Instant', text: ['Bloodfire Bolt deals 3 damage to any target.'] },
    rend_flesh: { type: 'Sorcery', text: ['Destroy target creature.'] },
    blood_frenzy: { type: 'Instant', text: ['Target creature gets +2/+0 and gains first strike until end of turn.'] },
    grim_kindling: { type: 'Sorcery', text: ['Draw two cards. Grim Kindling deals 1 damage to target opponent.'] },
    shoal_hatchling: { type: 'Creature — Frog', text: ['Evolve'] },
    reefwing_fledgling: { type: 'Creature — Bird', text: ['Flying, evolve'] },
    kelpweaver_druid: { type: 'Creature — Merfolk Druid', text: ['{T}: Add {G} or {U}.'] },
    tidecrest_mutant: { type: 'Creature — Lizard Mutant', text: ['Evolve, hexproof'] },
    mossfin_lurker: { type: 'Creature — Fish Beast', text: ['Hexproof'] },
    tanglejaw_croc: {
      type: 'Creature — Crocodile',
      text: ["When this creature enters, return target creature you don't control to its owner's hand."],
    },
    mistfin_drake: { type: 'Creature — Drake', text: ['Flying'] },
    coralhide_behemoth: { type: 'Creature — Beast', text: [] },
    deepgrove_leviathan: { type: 'Creature — Leviathan', text: ['Trample, hexproof'] },
    snapjaw_strike: {
      type: 'Sorcery',
      text: ["Target creature you control deals damage equal to its power to target creature you don't control."],
    },
    shell_of_the_deep: {
      type: 'Instant',
      text: ['Target creature you control gets +1/+1 and gains hexproof until end of turn.'],
    },
    adaptive_bloom: { type: 'Instant', text: ['Put a +1/+1 counter on target creature you control. Draw a card.'] },
    undertide_lore: { type: 'Sorcery', text: ['Draw two cards.'] },
    riptide_recall: { type: 'Instant', text: ["Return target creature you don't control to its owner's hand."] },
  };

  for (const [id, { type, text }] of Object.entries(expected)) {
    it(`describes ${id}`, () => {
      const def = getCardDef(id);
      expect(typeLine(def)).toBe(type);
      expect(rulesText(def)).toEqual(text);
    });
  }

  it('covers every card in every deck and every token', () => {
    for (const id of new Set(DECK_LIST.flatMap(expandDeck))) expect(Object.keys(expected)).toContain(id);
    for (const def of CORE_CARDS.filter((card) => card.token)) expect(Object.keys(expected)).toContain(def.id);
  });

  it('builds one-line summaries', () => {
    expect(cardSummary('timberland_rhino')).toBe('Timberland Rhino · {2}{G}{G} · Creature — Rhino · 4/4 · Trample');
    expect(cardSummary('turn_the_tide')).toBe('Turn the Tide · {1}{U}{U} · Instant · Counter target spell.');
    expect(cardSummary('squall_skimmer')).toBe('Squall Skimmer · {1}{U} · Creature — Bird · 2/1 · Flash, flying');
    expect(cardSummary('elemental_token')).toBe('Elemental · Token Creature — Elemental · 1/1 · Haste');
  });

  it('describes the undying return like a death trigger', () => {
    expect(triggerText(getCardDef('rotbark_treefolk'), UNDYING_TRIGGER)).toBe(
      "When this creature dies, if it had no +1/+1 counters on it, return it to the battlefield under its owner's control with a +1/+1 counter on it.",
    );
  });

  it('describes the evolve trigger like an "another creature you control enters" trigger', () => {
    expect(triggerText(getCardDef('shoal_hatchling'), EVOLVE_TRIGGER)).toBe(
      'Whenever another creature you control enters, if it has greater power or toughness than this creature, put a +1/+1 counter on this creature.',
    );
  });

  it('calls a target named earlier in the same ability "it"', () => {
    expect(rulesText(getCardDef('pack_pounce'))).toEqual([
      "Put a +1/+1 counter on target creature you control. It fights target creature you don't control.",
    ]);
    expect(rulesText(getCardDef('feral_clash'))).toEqual(["Target creature you control fights target creature you don't control."]);
  });
});

describe('card validation', () => {
  it('rejects broken definitions', () => {
    expect(() => registerCard({ id: 'bad1', name: 'Bad', types: ['creature'], cost: '{G}' })).toThrow(/power/);
    expect(() => registerCard({ id: 'bad2', name: 'Bad', types: ['instant'], cost: '{R}' })).toThrow(/spell ability/);
    expect(() =>
      registerCard({
        id: 'bad3',
        name: 'Bad',
        types: ['sorcery'],
        cost: '{R}',
        spell: { targets: [], effects: [{ kind: 'damage', amount: 1, to: 0 }] },
      }),
    ).toThrow(/missing target/);
    expect(() => registerCard({ id: 'bad4', name: 'Bad', types: ['land'], cost: '{1}' })).toThrow(/no mana cost/);
    expect(() =>
      registerCard({
        id: 'bad5',
        name: 'Bad',
        types: ['instant'],
        cost: '{U}',
        spell: { targets: [{ kind: 'creature' }], effects: [{ kind: 'counter', to: 0 }] },
      }),
    ).toThrow(/counter effects need a spell target/);
    expect(() =>
      registerCard({
        id: 'bad6',
        name: 'Bad',
        types: ['instant'],
        cost: '{R}',
        spell: { targets: [{ kind: 'spell' }], effects: [{ kind: 'damage', amount: 1, to: 0 }] },
      }),
    ).toThrow(/only counter effects/);
  });

  it('rejects "whenever you gain life" abilities that would gain life again', () => {
    for (const effect of [
      { kind: 'gainLife', amount: 1 },
      { kind: 'damage', amount: 1, to: 0 },
    ] as const) {
      expect(() =>
        registerCard({
          id: `bad_loop_${effect.kind}`,
          name: 'Bad',
          types: ['creature'],
          cost: '{W}',
          power: 1,
          toughness: 1,
          keywords: ['lifelink'],
          triggers: [{ on: 'lifeGain', targets: effect.kind === 'damage' ? [{ kind: 'any' }] : [], effects: [effect] }],
        }),
      ).toThrow(/cannot gain life or deal damage/);
    }
  });

  it('rejects tokens with a cost, discards before other effects, undying returns and sacrificed sources that affect themselves', () => {
    expect(() => registerCard({ id: 'bad7', name: 'Bad', types: ['creature'], cost: '{W}', token: true, power: 1, toughness: 1 })).toThrow(/tokens/);
    expect(() =>
      registerCard({
        id: 'bad8',
        name: 'Bad',
        types: ['sorcery'],
        cost: '{B}',
        spell: {
          targets: [],
          effects: [
            { kind: 'discard', amount: 1, who: 'opponent' },
            { kind: 'draw', amount: 1 },
          ],
        },
      }),
    ).toThrow(/discard must be the last effect/);
    expect(() =>
      registerCard({
        id: 'bad9',
        name: 'Bad',
        types: ['creature'],
        cost: '{G}',
        power: 1,
        toughness: 1,
        triggers: [{ on: 'dies', targets: [], effects: [{ kind: 'returnToBattlefield', counters: 1 }] }],
      }),
    ).toThrow(/undying only/);
    expect(() =>
      registerCard({
        id: 'bad10',
        name: 'Bad',
        types: ['creature'],
        cost: '{B}',
        power: 1,
        toughness: 1,
        activated: [{ cost: '{0}', sacrifice: true, targets: [], effects: [{ kind: 'pump', power: 1, toughness: 1, to: 'self' }] }],
      }),
    ).toThrow(/sacrifices its creature/);
  });
});

describe('card files', () => {
  const files = Object.entries(
    import.meta.glob<Record<string, CardDef>>('../../src/engine/cards/*.ts', { eager: true }),
  ).filter(([path]) => !path.endsWith('/index.ts'));

  it('each export one card named after the file', () => {
    for (const [path, exports] of files) {
      const defs = Object.values(exports);
      expect(defs, path).toHaveLength(1);
      expect(path).toBe(`../../src/engine/cards/${defs[0]?.id}.ts`);
    }
  });

  it('are all listed in the index', () => {
    const ids = (defs: readonly CardDef[]) => defs.map((def) => def.id).sort();
    expect(ids(CORE_CARDS)).toEqual(ids(files.flatMap(([, exports]) => Object.values(exports))));
  });
});
