import { describe, expect, it } from 'vitest';
import {
  BRIGHTFORGE,
  CINDERMAW,
  CROSSROADS,
  DECK_LIST,
  DEEPGROVE,
  EMBERWILD,
  EVOLVE_TRIGGER,
  FLAMECREST,
  GLOAMWOOD,
  MISTGRAVE,
  STORMGLASS,
  SUNMEADOW,
  VESPERHALL,
  WILDLAND,
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
  it('are Emberwild, Dawntide, Duskmire, Stormglass, Sunmeadow, Brightforge, Mistgrave, Gloamwood, Vesperhall, Cindermaw, Deepgrove, Flamecrest, Wildland and Crossroads', () => {
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
      'flamecrest',
      'wildland',
      'crossroads',
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
    expect(getDeck('flamecrest')).toBe(FLAMECREST);
    expect(getDeck('wildland')).toBe(WILDLAND);
    expect(getDeck('crossroads')).toBe(CROSSROADS);
  });

  it('cover every pair of colors once, black, red and green on their own, and all five colors together', () => {
    const combinations = DECK_LIST.map((deck) => [...deck.colors].sort().join(''));
    expect(new Set(combinations).size).toBe(DECK_LIST.length);
    expect(combinations.filter((colors) => colors.length === 2)).toHaveLength(10);
    expect(combinations.filter((colors) => colors.length === 1).sort()).toEqual(['B', 'G', 'R']);
    expect(combinations.filter((colors) => colors.length > 2)).toEqual(['BGRUW']);
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
    forest: { type: 'Tierra básica — Bosque', text: ['{T}: Agrega {G}.'] },
    mountain: { type: 'Tierra básica — Montaña', text: ['{T}: Agrega {R}.'] },
    grove_tender: { type: 'Criatura — Druida elfo', text: ['{T}: Agrega {G}.'] },
    moss_viper: { type: 'Criatura — Víbora', text: ['Toque mortal.'] },
    ember_hound: { type: 'Criatura — Perro elemental', text: ['Prisa.'] },
    canopy_spider: { type: 'Criatura — Araña', text: ['Alcance.'] },
    ashen_duelist: { type: 'Criatura — Guerrero humano', text: ['Daña primero.'] },
    cinder_adept: {
      type: 'Criatura — Chamán humano',
      text: ['Cuando esta criatura entre, hace 1 punto de daño a cualquier objetivo.'],
    },
    ridge_marauder: { type: 'Criatura — Berserker humano', text: ['Amenaza.'] },
    bramble_warden: { type: 'Criatura — Guerrero planta', text: ['Vigilancia.'] },
    timberland_rhino: { type: 'Criatura — Rinoceronte', text: ['Arrolla.'] },
    cinderwing_drake: { type: 'Criatura — Draco', text: ['Vuela.'] },
    crag_dragon: { type: 'Criatura — Dragón', text: ['Vuela.', '{R}: Esta criatura obtiene +1/+0 hasta el final del turno.'] },
    ember_snap: { type: 'Instantáneo', text: ['Chasquido de brasas hace 2 puntos de daño a cualquier objetivo.'] },
    magma_lance: { type: 'Conjuro', text: ['Lanza de magma hace 4 puntos de daño a la criatura objetivo.'] },
    verdant_surge: { type: 'Instantáneo', text: ['La criatura objetivo obtiene +3/+3 hasta el final del turno.'] },
    feral_clash: {
      type: 'Conjuro',
      text: ['La criatura objetivo que controlas lucha contra la criatura objetivo que no controlas.'],
    },
    read_the_roots: { type: 'Conjuro', text: ['Roba dos cartas.'] },
    plains: { type: 'Tierra básica — Llanura', text: ['{T}: Agrega {W}.'] },
    island: { type: 'Tierra básica — Isla', text: ['{T}: Agrega {U}.'] },
    swamp: { type: 'Tierra básica — Pantano', text: ['{T}: Agrega {B}.'] },
    mist_sprite: { type: 'Criatura — Hada', text: ['Vuela.'] },
    dawn_acolyte: { type: 'Criatura — Clérigo humano', text: ['Vínculo vital.'] },
    reefshell_crab: { type: 'Criatura — Cangrejo', text: ['Defensor.'] },
    beacon_squire: { type: 'Criatura — Soldado humano', text: ['Vigilancia.'] },
    reef_scholar: { type: 'Criatura — Hechicero tritón', text: ['Cuando esta criatura entre, roba una carta.'] },
    galewing_falcon: { type: 'Criatura — Ave', text: ['Vuela.'] },
    sunblade_paladin: { type: 'Criatura — Caballero humano', text: ['Daña dos veces.'] },
    cloudrider_knight: { type: 'Criatura — Caballero humano', text: ['Vuela, vigilancia.'] },
    aurora_seraph: { type: 'Criatura — Ángel', text: ['Vuela, vínculo vital.'] },
    radiant_blessing: {
      type: 'Instantáneo',
      text: ['La criatura objetivo obtiene +2/+2 hasta el final del turno. Ganas 2 vidas.'],
    },
    undertow: { type: 'Instantáneo', text: ['Regresa la criatura objetivo a la mano de su propietario.'] },
    turn_the_tide: { type: 'Instantáneo', text: ['Contrarresta el hechizo objetivo.'] },
    tidal_insight: { type: 'Instantáneo', text: ['Roba dos cartas.'] },
    dawns_verdict: { type: 'Instantáneo', text: ['Destruye la criatura girada objetivo.'] },
    gloom_wisp: { type: 'Criatura — Espíritu', text: ['Cuando esta criatura muera, roba una carta.'] },
    duskwing_bat: { type: 'Criatura — Murciélago', text: ['Vuela, vínculo vital.'] },
    mire_prowler: { type: 'Criatura — Zombie', text: ['Amenaza.'] },
    grave_hexer: {
      type: 'Criatura — Brujo humano',
      text: ['Cuando esta criatura entre, la criatura objetivo que no controlas obtiene -1/-1 hasta el final del turno.'],
    },
    bog_lurker: { type: 'Criatura — Horror', text: ['Toque mortal.'] },
    crypt_ghoul: { type: 'Criatura — Zombie', text: ['Cuando esta criatura muera, hace 1 punto de daño al oponente objetivo.'] },
    duskmire_shade: { type: 'Criatura — Sombra', text: ['{B}: Esta criatura obtiene +1/+1 hasta el final del turno.'] },
    blood_reaver: { type: 'Criatura — Vampiro', text: ['Vínculo vital.'] },
    nightveil_wraith: {
      type: 'Criatura — Espíritu',
      text: ['Vuela.', 'Cuando esta criatura muera, hace 2 puntos de daño al oponente objetivo.'],
    },
    dread_tyrant: { type: 'Criatura — Demonio', text: ['Vuela.', 'Cuando esta criatura entre, pierdes 2 vidas.'] },
    withering_touch: { type: 'Instantáneo', text: ['La criatura objetivo obtiene -2/-2 hasta el final del turno.'] },
    nights_bargain: { type: 'Conjuro', text: ['Roba dos cartas. Pierdes 2 vidas.'] },
    soul_siphon: { type: 'Conjuro', text: ['Sifón de almas hace 2 puntos de daño a cualquier objetivo. Ganas 2 vidas.'] },
    grave_sentence: { type: 'Instantáneo', text: ['Destruye la criatura objetivo.'] },
    kiln_sprite: { type: 'Criatura — Elemental', text: ['Prisa, destreza.'] },
    squall_skimmer: { type: 'Criatura — Ave', text: ['Destello, vuela.'] },
    arc_initiate: { type: 'Criatura — Monje humano', text: ['Destreza.'] },
    glassreef_sentinel: { type: 'Criatura — Soldado tritón', text: ['Destello.'] },
    galvanic_channeler: {
      type: 'Criatura — Chamán humano',
      text: [
        'Siempre que lances un hechizo de instantáneo o de conjuro, esta criatura hace 1 punto de daño al oponente objetivo.',
      ],
    },
    wavecrest_mystic: {
      type: 'Criatura — Hechicero tritón',
      text: [
        'Destello.',
        'Cuando esta criatura entre, regresa la criatura objetivo que no controlas a la mano de su propietario.',
      ],
    },
    stormglass_drake: {
      type: 'Criatura — Draco',
      text: ['Vuela.', 'Siempre que lances un hechizo de instantáneo o de conjuro, pon un contador +1/+1 sobre esta criatura.'],
    },
    thunderhead_djinn: {
      type: 'Criatura — Djinn',
      text: ['Vuela.', 'Cuando esta criatura entre, hace 2 puntos de daño a cualquier objetivo.'],
    },
    static_jolt: { type: 'Instantáneo', text: ['Descarga estática hace 1 punto de daño a cualquier objetivo. Roba una carta.'] },
    stormflare: { type: 'Conjuro', text: ['Fulgor de tormenta hace 3 puntos de daño a cualquier objetivo.'] },
    brine_rebuke: { type: 'Instantáneo', text: ['Regresa la criatura objetivo a la mano de su propietario. Roba una carta.'] },
    refracted_insight: {
      type: 'Instantáneo',
      text: ['Roba dos cartas. Visión refractada hace 1 punto de daño a cualquier objetivo.'],
    },
    shattered_intent: { type: 'Instantáneo', text: ['Contrarresta el hechizo objetivo.'] },
    hopeful_squire: {
      type: 'Criatura — Soldado humano',
      text: ['Siempre que esta criatura ataque, pon un contador +1/+1 sobre ella.'],
    },
    warren_hare: {
      type: 'Criatura — Conejo',
      text: ['Cuando esta criatura muera, pon un contador +1/+1 sobre la criatura objetivo que controlas.'],
    },
    bloomcaller_druid: {
      type: 'Criatura — Druida elfo',
      text: ['Cuando esta criatura entre, pon un contador +1/+1 sobre la criatura objetivo que controlas.'],
    },
    bristleback_boar: { type: 'Criatura — Jabalí', text: ['Arrolla.'] },
    sunmeadow_herald: {
      type: 'Criatura — Soldado humano',
      text: ['Siempre que esta criatura ataque, las criaturas que controlas obtienen +1/+0 hasta el final del turno.'],
    },
    hearthfield_cleric: { type: 'Criatura — Clérigo humano', text: ['Cuando esta criatura entre, ganas 3 vidas.'] },
    thornglade_archer: { type: 'Criatura — Arquero elfo', text: ['Alcance.'] },
    mossbark_bear: {
      type: 'Criatura — Oso',
      text: ['Cuando esta criatura entre, pon un contador +1/+1 sobre la criatura objetivo que controlas.'],
    },
    skyguard_griffin: {
      type: 'Criatura — Grifo',
      text: ['Vuela.', 'Cuando esta criatura entre, pon un contador +1/+1 sobre la criatura objetivo que controlas.'],
    },
    sunantler_monarch: {
      type: 'Criatura — Alce',
      text: ['Vigilancia.', 'Cuando esta criatura entre, pon un contador +1/+1 sobre cada criatura que controlas.'],
    },
    rally_the_meadow: { type: 'Instantáneo', text: ['Las criaturas que controlas obtienen +1/+1 hasta el final del turno.'] },
    wild_blossom: { type: 'Instantáneo', text: ['Pon dos contadores +1/+1 sobre la criatura objetivo.'] },
    pack_pounce: {
      type: 'Conjuro',
      text: [
        'Pon un contador +1/+1 sobre la criatura objetivo que controlas. Esa criatura lucha contra la criatura objetivo que no controlas.',
      ],
    },
    harvest_hymn: { type: 'Conjuro', text: ['Pon un contador +1/+1 sobre cada criatura que controlas. Ganas 2 vidas.'] },
    soldier_token: { type: 'Criatura ficha — Soldado', text: [] },
    elemental_token: { type: 'Criatura ficha — Elemental', text: ['Prisa.'] },
    saproling_token: { type: 'Criatura ficha — Saprolín', text: [] },
    forge_cadet: {
      type: 'Criatura — Soldado humano',
      text: ['Siempre que otra criatura que controlas entre, pon un contador +1/+1 sobre esta criatura.'],
    },
    muster_sergeant: {
      type: 'Criatura — Soldado humano',
      text: ['Cuando esta criatura entre, crea una ficha de criatura Soldado blanca 1/1.'],
    },
    sunsteel_lancer: { type: 'Criatura — Caballero humano', text: ['Daña primero.'] },
    kindling_caller: {
      type: 'Criatura — Chamán humano',
      text: ['Cuando esta criatura entre, crea una ficha de criatura Elemental roja 1/1 con la habilidad de prisa.'],
    },
    bannerguard_knight: {
      type: 'Criatura — Caballero humano',
      text: ['Vigilancia.', 'Cuando esta criatura entre, crea una ficha de criatura Soldado blanca 1/1.'],
    },
    hammerfall_raider: {
      type: 'Criatura — Guerrero humano',
      text: ['Siempre que esta criatura ataque, crea una ficha de criatura Elemental roja 1/1 con la habilidad de prisa.'],
    },
    brightforge_marshal: {
      type: 'Criatura — Soldado humano',
      text: ['Cuando esta criatura entre, crea dos fichas de criatura Soldado blancas 1/1.'],
    },
    forgewing_griffin: {
      type: 'Criatura — Grifo',
      text: ['Vuela.', 'Cuando esta criatura entre, crea una ficha de criatura Soldado blanca 1/1.'],
    },
    brightforge_warlord: {
      type: 'Criatura — Caballero humano',
      text: [
        'Cuando esta criatura entre, las criaturas que controlas obtienen +1/+0 y ganan la habilidad de prisa hasta el final del turno.',
      ],
    },
    raise_the_banners: { type: 'Instantáneo', text: ['Crea dos fichas de criatura Soldado blancas 1/1.'] },
    molten_rebuke: { type: 'Instantáneo', text: ['Reprimenda fundida hace 3 puntos de daño a la criatura objetivo.'] },
    sunbrand: { type: 'Instantáneo', text: ['Marca solar hace 3 puntos de daño a cualquier objetivo. Ganas 3 vidas.'] },
    charge_of_the_forge: {
      type: 'Instantáneo',
      text: ['Las criaturas que controlas obtienen +1/+0 y ganan la habilidad de dañar primero hasta el final del turno.'],
    },
    stoke_the_forge: { type: 'Conjuro', text: ['Crea dos fichas de criatura Elemental rojas 1/1 con la habilidad de prisa.'] },
    gutterfang_rat: { type: 'Criatura — Rata', text: ['Escurridizo, toque mortal.'] },
    fogslip_thief: {
      type: 'Criatura — Bribón humano',
      text: ['Escurridizo.', 'Siempre que esta criatura haga daño de combate a un jugador, roba una carta.'],
    },
    hushwing_bat: {
      type: 'Criatura — Murciélago',
      text: ['Vuela.', 'Siempre que esta criatura haga daño de combate a un jugador, ese jugador descarta una carta.'],
    },
    inkwell_scribe: {
      type: 'Criatura — Hechicero humano',
      text: ['Cuando esta criatura entre, roba una carta y luego descarta una carta.'],
    },
    memory_leech: { type: 'Criatura — Sanguijuela', text: ['Cuando esta criatura entre, cada oponente descarta una carta.'] },
    mistcloak_ambusher: { type: 'Criatura — Bribón humano', text: ['Destello, escurridizo.'] },
    veilborn_specter: {
      type: 'Criatura — Espectro',
      text: ['Vuela.', 'Siempre que esta criatura haga daño de combate a un jugador, roba una carta.'],
    },
    mistgrave_revenant: {
      type: 'Criatura — Horror zombie',
      text: [
        'Escurridizo.',
        'Siempre que esta criatura haga daño de combate a un jugador, roba una carta. Ese jugador descarta una carta.',
      ],
    },
    rob_the_mind: { type: 'Conjuro', text: ['Cada oponente descarta dos cartas.'] },
    drag_below: {
      type: 'Instantáneo',
      text: ['Regresa la criatura objetivo que no controlas a la mano de su propietario. Cada oponente descarta una carta.'],
    },
    choking_mist: { type: 'Instantáneo', text: ['La criatura objetivo obtiene -3/-3 hasta el final del turno.'] },
    sift_the_depths: { type: 'Instantáneo', text: ['Roba dos cartas y luego descarta una carta.'] },
    drown_the_truth: { type: 'Instantáneo', text: ['Destruye la criatura objetivo.'] },
    gravebloom_sprout: { type: 'Criatura — Planta', text: ['Resiliencia.'] },
    rotwing_crow: {
      type: 'Criatura — Ave',
      text: ['Vuela.', 'Siempre que otra criatura que controlas muera, cada oponente pierde 1 vida.'],
    },
    rootgnaw_boar: {
      type: 'Criatura — Jabalí',
      text: ['Siempre que otra criatura que controlas muera, pon un contador +1/+1 sobre esta criatura.'],
    },
    bloodspore_thrall: {
      type: 'Criatura — Zombie hongo',
      text: ['Resiliencia.', 'Sacrificar esta criatura: Cada oponente pierde 1 vida.'],
    },
    bonewood_stalker: {
      type: 'Criatura — Bestia zombie',
      text: ['Sacrificar esta criatura: La criatura objetivo obtiene -2/-2 hasta el final del turno.'],
    },
    sporecap_shambler: {
      type: 'Criatura — Hongo',
      text: ['Cuando esta criatura muera, crea dos fichas de criatura Saprolín verdes 1/1.'],
    },
    gloomsilk_spider: { type: 'Criatura — Araña', text: ['Alcance, toque mortal.'] },
    rotbark_treefolk: { type: 'Criatura — Pueblo-arbóreo', text: ['Resiliencia.'] },
    gloamwood_elder: {
      type: 'Criatura — Chamán pueblo-arbóreo',
      text: ['Alcance.', 'Siempre que otra criatura que controlas muera, crea una ficha de criatura Saprolín verde 1/1.'],
    },
    venom_duel: {
      type: 'Conjuro',
      text: [
        'La criatura objetivo que controlas gana la habilidad de toque mortal hasta el final del turno. Esa criatura lucha contra la criatura objetivo que no controlas.',
      ],
    },
    rot_into_loam: {
      type: 'Instantáneo',
      text: ['La criatura objetivo obtiene -2/-2 hasta el final del turno. Crea una ficha de criatura Saprolín verde 1/1.'],
    },
    sporecall: { type: 'Conjuro', text: ['Crea dos fichas de criatura Saprolín verdes 1/1.'] },
    nightshade_tonic: {
      type: 'Instantáneo',
      text: ['La criatura objetivo obtiene +1/+1 y gana la habilidad de toque mortal hasta el final del turno.'],
    },
    vesper_novice: {
      type: 'Criatura — Clérigo humano',
      text: ['Siempre que ganes vidas, pon un contador +1/+1 sobre esta criatura.'],
    },
    tithe_collector: {
      type: 'Criatura — Bribón humano',
      text: ['Cuando esta criatura entre, cada oponente pierde 1 vida. Ganas 1 vida.'],
    },
    chantry_guard: { type: 'Criatura — Soldado humano', text: ['Vínculo vital.'] },
    ghostlit_penitent: { type: 'Criatura — Clérigo espíritu', text: ['Vuela, vínculo vital.'] },
    censer_bearer: {
      type: 'Criatura — Clérigo humano',
      text: ['Cuando esta criatura entre, crea una ficha de criatura Espíritu blanca y negra 1/1 con la habilidad de volar.'],
    },
    sanguine_chorister: { type: 'Criatura — Clérigo vampiro', text: ['Siempre que ganes vidas, cada oponente pierde 1 vida.'] },
    ashveil_executioner: { type: 'Criatura — Asesino humano', text: ['Toque mortal, vínculo vital.'] },
    lanternwing_angel: { type: 'Criatura — Ángel', text: ['Vuela, vínculo vital.'] },
    gilded_confessor: {
      type: 'Criatura — Clérigo humano',
      text: [
        'Cuando esta criatura entre, la criatura objetivo que no controlas obtiene -1/-1 hasta el final del turno. Ganas 2 vidas.',
      ],
    },
    vesperhall_matriarch: {
      type: 'Criatura — Noble vampiro',
      text: ['Vuela.', 'Siempre que ganes vidas, pon un contador +1/+1 sobre esta criatura.'],
    },
    penance: { type: 'Instantáneo', text: ['La criatura objetivo obtiene -2/-2 hasta el final del turno. Ganas 2 vidas.'] },
    vesper_vow: {
      type: 'Instantáneo',
      text: ['La criatura objetivo obtiene +2/+2 y gana la habilidad de vínculo vital hasta el final del turno.'],
    },
    rite_of_lanterns: {
      type: 'Conjuro',
      text: ['Crea dos fichas de criatura Espíritu blancas y negras 1/1 con la habilidad de volar.'],
    },
    last_rites: { type: 'Conjuro', text: ['Destruye la criatura objetivo. Ganas 2 vidas.'] },
    blood_tithe: { type: 'Conjuro', text: ['Cada oponente pierde 2 vidas. Ganas 2 vidas. Roba una carta.'] },
    spirit_token: { type: 'Criatura ficha — Espíritu', text: ['Vuela.'] },
    spitfire_imp: {
      type: 'Criatura — Diablillo',
      text: ['Prisa.', 'Cuando esta criatura muera, hace 1 punto de daño a cualquier objetivo.'],
    },
    bloodhungry_ghoul: {
      type: 'Criatura — Zombie',
      text: ['Cuando esta criatura entre, si un oponente recibió daño este turno, pon un contador +1/+1 sobre ella.'],
    },
    pitfire_raider: { type: 'Criatura — Berserker humano', text: ['Prisa, amenaza.'] },
    brimstone_skirmisher: {
      type: 'Criatura — Guerrero trasgo',
      text: ['Siempre que esta criatura ataque, hace 1 punto de daño al oponente objetivo.'],
    },
    blistering_hellion: {
      type: 'Criatura — Infernal',
      text: ['Cuando esta criatura entre, si un oponente recibió daño este turno, pon dos contadores +1/+1 sobre ella.'],
    },
    pyre_ghast: {
      type: 'Criatura — Espíritu zombie',
      text: ['Cuando esta criatura muera, hace 2 puntos de daño a cualquier objetivo.'],
    },
    gorehorn_minotaur: {
      type: 'Criatura — Berserker minotauro',
      text: ['Amenaza.', 'Cuando esta criatura entre, si un oponente recibió daño este turno, pon un contador +1/+1 sobre ella.'],
    },
    scorchfang_hound: {
      type: 'Criatura — Sabueso',
      text: ['Prisa.', 'Siempre que esta criatura ataque, hace 1 punto de daño al oponente objetivo.'],
    },
    cindermaw_demon: {
      type: 'Criatura — Demonio',
      text: ['Vuela.', 'Cuando esta criatura entre, si un oponente recibió daño este turno, pon dos contadores +1/+1 sobre ella.'],
    },
    splitting_flame: {
      type: 'Conjuro',
      text: ['Llama bífida hace 2 puntos de daño a la criatura objetivo y 2 puntos de daño al oponente objetivo.'],
    },
    bloodfire_bolt: { type: 'Instantáneo', text: ['Rayo de sangre hace 3 puntos de daño a cualquier objetivo.'] },
    rend_flesh: { type: 'Conjuro', text: ['Destruye la criatura objetivo.'] },
    blood_frenzy: {
      type: 'Instantáneo',
      text: ['La criatura objetivo obtiene +2/+0 y gana la habilidad de dañar primero hasta el final del turno.'],
    },
    grim_kindling: { type: 'Conjuro', text: ['Roba dos cartas. Yesca siniestra hace 1 punto de daño al oponente objetivo.'] },
    shoal_hatchling: { type: 'Criatura — Rana', text: ['Evolucionar.'] },
    reefwing_fledgling: { type: 'Criatura — Ave', text: ['Vuela, evolucionar.'] },
    kelpweaver_druid: { type: 'Criatura — Druida tritón', text: ['{T}: Agrega {G} o {U}.'] },
    tidecrest_mutant: { type: 'Criatura — Mutante lagarto', text: ['Evolucionar, antimaleficio.'] },
    mossfin_lurker: { type: 'Criatura — Bestia pez', text: ['Antimaleficio.'] },
    tanglejaw_croc: {
      type: 'Criatura — Cocodrilo',
      text: ['Cuando esta criatura entre, regresa la criatura objetivo que no controlas a la mano de su propietario.'],
    },
    mistfin_drake: { type: 'Criatura — Draco', text: ['Vuela.'] },
    coralhide_behemoth: { type: 'Criatura — Bestia', text: [] },
    deepgrove_leviathan: { type: 'Criatura — Leviatán', text: ['Arrolla, antimaleficio.'] },
    snapjaw_strike: {
      type: 'Conjuro',
      text: [
        'La criatura objetivo que controlas hace una cantidad de daño igual a su fuerza a la criatura objetivo que no controlas.',
      ],
    },
    shell_of_the_deep: {
      type: 'Instantáneo',
      text: ['La criatura objetivo que controlas obtiene +1/+1 y gana la habilidad de antimaleficio hasta el final del turno.'],
    },
    adaptive_bloom: {
      type: 'Instantáneo',
      text: ['Pon un contador +1/+1 sobre la criatura objetivo que controlas. Roba una carta.'],
    },
    undertide_lore: { type: 'Conjuro', text: ['Roba dos cartas.'] },
    riptide_recall: { type: 'Instantáneo', text: ['Regresa la criatura objetivo que no controlas a la mano de su propietario.'] },
    cloister_lancer: { type: 'Criatura — Monje humano', text: ['Prisa, destreza.'] },
    temple_blade: { type: 'Criatura — Monje humano', text: ['Daña primero, destreza.'] },
    brazier_disciple: {
      type: 'Criatura — Monje humano',
      text: [
        'Destreza.',
        'Siempre que lances un hechizo de instantáneo o de conjuro, esta criatura gana la habilidad de dañar primero hasta el final del turno.',
      ],
    },
    ashwing_kestrel: { type: 'Criatura — Ave', text: ['Vuela, destreza.'] },
    flamecrest_mentor: {
      type: 'Criatura — Monje humano',
      text: [
        'Destreza.',
        'Siempre que lances un hechizo de instantáneo o de conjuro, crea una ficha de criatura Monje roja 1/1 con la habilidad de destreza.',
      ],
    },
    thousand_blows_monk: { type: 'Criatura — Monje humano', text: ['Daña dos veces, destreza.'] },
    crater_elemental: { type: 'Criatura — Elemental', text: ['Prisa, destreza.'] },
    temple_dragon: { type: 'Criatura — Dragón', text: ['Vuela, destreza.'] },
    palm_strike: { type: 'Instantáneo', text: ['La criatura objetivo obtiene +1/+0 hasta el final del turno. Roba una carta.'] },
    spark_volley: {
      type: 'Instantáneo',
      text: [
        'Ráfaga de chispas hace 1 punto de daño a cualquier objetivo. Las criaturas que controlas obtienen +1/+0 hasta el final del turno.',
      ],
    },
    lava_fist: {
      type: 'Instantáneo',
      text: ['La criatura objetivo que controlas hace una cantidad de daño igual a su fuerza a la criatura objetivo que no controlas.'],
    },
    twin_strike: { type: 'Instantáneo', text: ['La criatura objetivo gana la habilidad de dañar dos veces hasta el final del turno.'] },
    dragons_breath: { type: 'Instantáneo', text: ['Aliento del dragón hace 3 puntos de daño a cualquier objetivo.'] },
    flame_cut: { type: 'Instantáneo', text: ['Corte de llama hace 2 puntos de daño a la criatura objetivo.'] },
    cliff_lynx: {
      type: 'Criatura — Felino',
      text: ['Aterrizaje — Siempre que una tierra que controlas entre, esta criatura obtiene +2/+2 hasta el final del turno.'],
    },
    trail_scout: {
      type: 'Criatura — Explorador elfo',
      text: [
        'Cuando esta criatura entre, busca en tu biblioteca una carta de Bosque básico, ponla en el campo de batalla girada y luego baraja.',
      ],
    },
    tribe_elder: {
      type: 'Criatura — Chamán elfo',
      text: [
        'Sacrificar esta criatura: Busca en tu biblioteca una carta de Bosque básico, ponla en el campo de batalla girada y luego baraja.',
      ],
    },
    quake_boar: {
      type: 'Criatura — Jabalí',
      text: ['Aterrizaje — Siempre que una tierra que controlas entre, pon un contador +1/+1 sobre esta criatura.'],
    },
    springhorn_stag: { type: 'Criatura — Ciervo', text: ['Aterrizaje — Siempre que una tierra que controlas entre, ganas 2 vidas.'] },
    boulder_spider: { type: 'Criatura — Araña', text: ['Alcance.'] },
    territorial_beast: {
      type: 'Criatura — Bestia',
      text: ['Aterrizaje — Siempre que una tierra que controlas entre, esta criatura obtiene +2/+2 hasta el final del turno.'],
    },
    peak_giant: {
      type: 'Criatura — Gigante',
      text: [
        'Cuando esta criatura entre, busca en tu biblioteca una carta de Bosque básico, ponla en el campo de batalla girada y luego baraja.',
      ],
    },
    wildland_colossus: {
      type: 'Criatura — Bestia elemental',
      text: ['Arrolla.', 'Aterrizaje — Siempre que una tierra que controlas entre, crea una ficha de criatura Bestia verde 3/3.'],
    },
    open_path: { type: 'Conjuro', text: ['Puedes jugar una tierra adicional este turno. Roba una carta.'] },
    deep_sowing: {
      type: 'Conjuro',
      text: [
        'Busca en tu biblioteca dos cartas de Bosque básico, pon una en el campo de batalla girada y la otra en tu mano, y luego baraja.',
      ],
    },
    fertile_rift: {
      type: 'Instantáneo',
      text: ['Busca en tu biblioteca una carta de Bosque básico, ponla en el campo de batalla girada y luego baraja.'],
    },
    avalanche_fury: {
      type: 'Conjuro',
      text: [
        'La criatura objetivo que controlas obtiene +2/+2 hasta el final del turno. Esa criatura lucha contra la criatura objetivo que no controlas.',
      ],
    },
    sure_swipe: {
      type: 'Instantáneo',
      text: ['La criatura objetivo que controlas hace una cantidad de daño igual a su fuerza a la criatura objetivo que no controlas.'],
    },
    herd_roar: {
      type: 'Conjuro',
      text: ['Las criaturas que controlas obtienen +2/+2 y ganan la habilidad de arrollar hasta el final del turno.'],
    },
    silver_spire: { type: 'Tierra', text: ['Esta tierra entra girada.', '{T}: Agrega {W}, {U} o {B}.'] },
    ash_harbor: { type: 'Tierra', text: ['Esta tierra entra girada.', '{T}: Agrega {U}, {B} o {R}.'] },
    smoldering_jungle: { type: 'Tierra', text: ['Esta tierra entra girada.', '{T}: Agrega {B}, {R} o {G}.'] },
    sunlit_canyon: { type: 'Tierra', text: ['Esta tierra entra girada.', '{T}: Agrega {R}, {G} o {W}.'] },
    misty_meadow: { type: 'Tierra', text: ['Esta tierra entra girada.', '{T}: Agrega {G}, {W} o {U}.'] },
    prismatic_fount: { type: 'Tierra', text: ['Esta tierra entra girada.', '{T}: Agrega un maná de cualquier color.'] },
    wayfarer_druid: { type: 'Criatura — Druida elfo', text: ['{T}: Agrega un maná de cualquier color.'] },
    sky_messenger: { type: 'Criatura — Espíritu', text: ['Vuela.'] },
    smoke_warlock: { type: 'Criatura — Brujo humano', text: ['Cuando esta criatura entre, hace 1 punto de daño a cualquier objetivo.'] },
    root_warden: { type: 'Criatura — Guerrero elfo', text: ['Vigilancia.'] },
    meadow_griffin: { type: 'Criatura — Grifo', text: ['Vuela, vigilancia.'] },
    smoldering_devourer: { type: 'Criatura — Bestia', text: ['Prisa, arrolla.'] },
    canyon_titan: { type: 'Criatura — Gigante', text: ['Vigilancia, arrolla.'] },
    prismatic_dragon: { type: 'Criatura — Dragón', text: ['Vuela, vínculo vital.'] },
    spire_judgment: { type: 'Instantáneo', text: ['Destruye la criatura objetivo. Roba una carta.'] },
    ash_storm: { type: 'Conjuro', text: ['Tormenta de ceniza hace 2 puntos de daño a cualquier objetivo. Roba una carta.'] },
    council_veto: { type: 'Instantáneo', text: ['Contrarresta el hechizo objetivo. Ganas 2 vidas.'] },
    convergent_vision: { type: 'Instantáneo', text: ['Roba dos cartas.'] },
    purifying_fire: { type: 'Instantáneo', text: ['Fuego purificador hace 2 puntos de daño a cualquier objetivo. Ganas 2 vidas.'] },
    monk_token: { type: 'Criatura ficha — Monje', text: ['Destreza.'] },
    beast_token: { type: 'Criatura ficha — Bestia', text: [] },
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
    expect(cardSummary('timberland_rhino')).toBe('Rinoceronte forestal · {2}{G}{G} · Criatura — Rinoceronte · 4/4 · Arrolla.');
    expect(cardSummary('turn_the_tide')).toBe('Cambio de marea · {1}{U}{U} · Instantáneo · Contrarresta el hechizo objetivo.');
    expect(cardSummary('squall_skimmer')).toBe('Ave de la borrasca · {1}{U} · Criatura — Ave · 2/1 · Destello, vuela.');
    expect(cardSummary('elemental_token')).toBe('Elemental · Criatura ficha — Elemental · 1/1 · Prisa.');
  });

  it('describes the undying return like a death trigger', () => {
    expect(triggerText(getCardDef('rotbark_treefolk'), UNDYING_TRIGGER)).toBe(
      'Cuando esta criatura muera, si no tenía contadores +1/+1 sobre ella, regrésala al campo de batalla bajo el control de su propietario con un contador +1/+1.',
    );
  });

  it('describes the evolve trigger like an "another creature you control enters" trigger', () => {
    expect(triggerText(getCardDef('shoal_hatchling'), EVOLVE_TRIGGER)).toBe(
      'Siempre que otra criatura que controlas entre, si la fuerza o la resistencia de esa criatura es mayor que la de esta criatura, pon un contador +1/+1 sobre esta criatura.',
    );
  });

  it('calls a target named earlier in the same ability "esa criatura"', () => {
    expect(rulesText(getCardDef('pack_pounce'))).toEqual([
      'Pon un contador +1/+1 sobre la criatura objetivo que controlas. Esa criatura lucha contra la criatura objetivo que no controlas.',
    ]);
    expect(rulesText(getCardDef('feral_clash'))).toEqual(['La criatura objetivo que controlas lucha contra la criatura objetivo que no controlas.']);
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

  it('rejects nonland cards that enter tapped, land searches without cards or split unevenly, and no extra land plays', () => {
    expect(() => registerCard({ id: 'bad11', name: 'Bad', types: ['creature'], cost: '{G}', power: 1, toughness: 1, entersTapped: true })).toThrow(
      /only lands enter tapped/,
    );
    expect(() =>
      registerCard({ id: 'bad12', name: 'Bad', types: ['sorcery'], cost: '{G}', spell: { targets: [], effects: [{ kind: 'searchLand', land: 'forest', battlefield: 0 }] } }),
    ).toThrow(/needs cards to find/);
    expect(() =>
      registerCard({
        id: 'bad13',
        name: 'Bad',
        types: ['sorcery'],
        cost: '{G}',
        spell: { targets: [], effects: [{ kind: 'searchLand', land: 'forest', battlefield: 2, hand: 1 }] },
      }),
    ).toThrow(/one onto the battlefield and the other into the hand/);
    expect(() =>
      registerCard({ id: 'bad14', name: 'Bad', types: ['sorcery'], cost: '{G}', spell: { targets: [], effects: [{ kind: 'extraLands', amount: 0 }] } }),
    ).toThrow(/positive amount/);
  });

  it('describes searches that put every card onto the battlefield untapped, or into the hand', () => {
    const search = (battlefield: number, hand: number, tapped: boolean): string[] =>
      rulesText({
        id: 'search_text',
        name: 'Search',
        types: ['sorcery'],
        cost: '{G}',
        spell: { targets: [], effects: [{ kind: 'searchLand', land: 'plains', battlefield, hand, tapped }] },
      });
    expect(search(2, 0, false)).toEqual(['Busca en tu biblioteca dos cartas de Llanura básica, ponlas en el campo de batalla y luego baraja.']);
    expect(search(2, 0, true)).toEqual(['Busca en tu biblioteca dos cartas de Llanura básica, ponlas en el campo de batalla giradas y luego baraja.']);
    expect(search(0, 1, false)).toEqual(['Busca en tu biblioteca una carta de Llanura básica, revélala, ponla en tu mano y luego baraja.']);
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
