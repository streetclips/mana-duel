# Rules

Mana Duel plays by the core rules of Magic: The Gathering, trimmed to what its fourteen decks need. This page is the
contract of `src/engine`: what is implemented, and where it deliberately differs from Magic. The game shows its cards
and decks under Spanish or English names; this page calls them by the English names their ids keep (`docs/CARDS.md`
pairs each id with its Spanish name, `docs/CARDS.en.md` with its English one).

## Game

- Two players, 20 life each, seven-card opening hands. Each player brings one of fourteen 40-card decks, chosen
  before the game: Emberwild (Brasalvaje, red/green), Dawntide (Albamar, white/blue), Duskmire (Fangoscuro,
  black), Stormglass (Cristormenta, blue/red), Sunmeadow (Pradosol, green/white), Brightforge (Forjaluz, red/white),
  Mistgrave (Brumafosa, blue/black), Gloamwood (Selvumbra, black/green), Vesperhall (Vesperia, white/black),
  Cindermaw (Fauceniza, black/red), Deepgrove (Sotohondo, green/blue), Flamecrest (Crestafuego, red), Wildland
  (Tierrabrava, green) or Crossroads (Encrucijada, all five colors). Both may bring the same deck.
  No nonland card appears in two decks; basic lands may.
- The starting player comes from a seeded coin flip (or `startingPlayer`). They skip their first draw. The coin is
  flipped even when `startingPlayer` is given, so a game replays from its seed and the starting player it had.
- London mulligan: shuffle the hand away, draw seven, and once you keep, put one card on the bottom per mulligan.
  The starting player decides first. At most six mulligans.
- A game may give either player other starting life, another opening hand (a mulligan draws that many again),
  permanents on the battlefield from the start, relics (see Relics) or a draw on the first turn even as the starting
  player: Expedition rivals and relics do (`docs/MODES.md`). Those permanents are there before the game begins, so they
  trigger nothing, and they can attack and tap on their controller's first turn.
- You lose at 0 life or less, when you draw from an empty library, or when you concede. If both players lose at
  once the game is a draw. A game past turn 200 is a draw (safety net; decking ends games long before).

## Turn

`untap → upkeep → draw → main 1 → beginning of combat → declare attackers → declare blockers → first-strike damage
→ combat damage → end of combat → main 2 → end → cleanup`

- Untap: the active player's permanents untap, their creatures stop being summoning sick, the land drop resets.
- Draw: the active player draws one card (except the starting player on turn 1, unless the game lets them: the
  Reloj de arena).
- One land per turn, in your main phase, with an empty stack. "You may play an additional land this turn" (Open
  Path) adds one more land play to that turn only.
- Combat is skipped past "declare attackers" when nobody attacks. The first-strike step only exists when a combatant
  has first strike or double strike.
- Cleanup: the active player discards down to seven cards, then all damage is removed and "until end of turn"
  effects end.

## Priority and the stack

- Players receive priority in both main phases, after attackers are declared, after blockers are declared, in the
  end step, and in any other step while something is on the stack.
- The active player receives priority first. Casting or activating keeps priority with you. When both players pass
  in succession, the top of the stack resolves and the active player receives priority again; with an empty stack
  the step ends instead.
- Lands, creatures and sorceries need your main phase and an empty stack. Instants, creatures with flash and
  activated abilities work whenever you have priority. A creature cast with flash still has summoning sickness, but
  it can block as soon as it enters.
- A spell or ability whose targets are all illegal on resolution fizzles. A fight does nothing if either creature is
  gone. One spell cannot pick the same target twice.
- Hexproof: a creature with hexproof can't be the target of spells or abilities its controller's opponent
  controls. Its own controller can still target it, and one that gains hexproof in response makes the opponent's
  spell lose it as a target (Shell of the Deep against Magma Lance).
- A counterspell targets a spell on the stack, never an ability. The countered spell leaves the stack for its
  owner's graveyard without resolving: a countered creature never enters, so its "enters" triggers never happen.
  Counterspells can counter counterspells.

## Mana

- Lands and Grove Tender tap for one mana of their color, Kelpweaver Druid for {G} or {U}, each Crossroads tri-land
  for any of its three colors, and the Prismatic Fount and Wayfarer Druid for one mana of any color. A
  summoning-sick creature cannot tap for mana.
- A land that enters tapped (the tri-lands and the Prismatic Fount) can't pay for anything the turn it arrives; it
  untaps with your other permanents. Entering tapped doesn't stop it from triggering landfall.
- Paying is automatic: the engine taps lands before creatures and sources of one color before those of several, and
  keeps untapped the colors your other cards need. There is no mana pool: mana appears exactly when a cost is paid.

## Combat

- Attackers: your untapped creatures that have been under your control since your turn began (or have haste) and
  lack defender. Attacking taps them unless they have vigilance. Every attacker attacks the opponent.
- Blockers: untapped creatures. A blocker blocks one attacker; an attacker can take several blockers. Flying can
  only be blocked by flying or reach; menace needs two or more blockers; skulk can't be blocked by a creature with
  greater power, compared when blockers are declared (a pump before blocks changes who may block).
- Damage is simultaneous. Each attacker splits its damage automatically: lethal damage to each blocker in the order
  that destroys the most (least remaining toughness first), the rest to the last blocker, or to the player with
  trample. Deathtouch makes one damage lethal, trample assignment included. Lifelink gains that much life.
- An attacker stays blocked when its blockers leave combat: it deals no damage unless it has trample.
- State-based actions destroy creatures with damage at least equal to their toughness, or with any damage from a
  deathtouch source.

## Abilities

- Triggers: "at the beginning of your upkeep", "when this creature enters", "when this creature dies", "whenever
  this creature attacks", "whenever you cast an instant or sorcery spell", "whenever another creature you control
  enters", "whenever another creature you control dies", "whenever this creature deals combat damage to a player",
  "whenever you gain life" and "whenever a land you control enters". They go on the stack the next time a player
  would receive priority, the active player's first; targets are chosen then. A trigger with no legal target is
  skipped. An upkeep trigger gives both players priority in the upkeep, which otherwise passes without any.
- "Another creature you control" includes tokens, one trigger per creature: Raise the Banners gives Forge Cadet
  two +1/+1 counters. Creatures that die at the same time see each other die: two Rotwing Crows killed by one
  attacker each drain for the other.
- "Deals combat damage to a player" triggers once per combat damage step in which the creature hit the player
  (twice with double strike), trample damage included, and not for blocked creatures without trample.
- "Whenever you cast an instant or sorcery spell" triggers for each permanent of the caster that has it, and only
  for that player's instants and sorceries, not for creature spells. The trigger goes on the stack above the spell,
  so it resolves first (Arc Initiate is already 3/3 when the Static Jolt that triggered it resolves).
- Prowess: whenever its controller casts a noncreature spell, the creature gets +1/+1 until end of turn. Instants
  and sorceries are the only noncreature spells, so prowess triggers exactly where "whenever you cast an instant or
  sorcery spell" does, above the spell, once per spell for each creature with it, tokens included (the Monks of
  Flamecrest Mentor). Kiln Sprite and Arc Initiate have it too.
- Landfall, "whenever a land you control enters" (Wildland): every land that enters under your control triggers it,
  played or put onto the battlefield by an effect, tapped or not. The opponent's lands don't.
- "Whenever you gain life" triggers once per gain, not per point: lifelink damage dealt at the same time is one gain
  (two lifelink attackers in one combat damage step trigger Vesper Novice once), and each spell or ability that
  gains life is another. Only its controller's gains count. Such an ability never gains life or deals damage
  itself, so it cannot loop.
- "At the beginning of your upkeep, if you have no cards in hand" (the Libro de horas) checks as the upkeep begins:
  a card drawn or played later that turn changes nothing.
- Bloodthirst: "when this creature enters, if an opponent was dealt damage this turn" (Cindermaw) checks as the
  creature enters whether any source dealt the opponent damage this turn, in combat or not. Losing life is not
  damage, and damage to yourself does not count. The record clears when the next turn begins. Without it, the
  trigger never happens.
- Evolve: whenever another creature enters under your control with greater power or greater toughness than the
  creature with evolve, that creature gets a +1/+1 counter. Both are compared as the newcomer enters, with the
  counters and pumps each has then; tokens count, the opponent's creatures don't.
- Activated abilities use the stack and can be activated as often as you can pay (Crag Dragon: `{R}: +1/+0`,
  Duskmire Shade: `{B}: +1/+1`).
- "Sacrifice this creature" is a cost: the creature dies as the ability goes on the stack, so its death triggers
  (undying included) go on the stack above the ability and resolve first. The ability still resolves without it.
- Undying: when a creature with undying dies without +1/+1 counters, it returns to the battlefield under its
  owner's control with a +1/+1 counter, as a new creature (summoning sick, untapped, out of combat). With that
  counter on it, its next death is for good.
- A creature that leaves the battlefield is a new object if it comes back: a spell or ability that targeted it
  loses that target and fizzles when nothing else is left to act on, even after undying returned it.
- Damage from a creature's ability or a fight uses that creature's deathtouch and lifelink. Death triggers work
  from the graveyard: Crypt Ghoul and Nightveil Wraith deal their damage after they die.

## Relics

The Expedition gives players relics (`docs/MODES.md`); those that act during a duel are relics of the engine
(`src/engine/relics.ts`, listed in `docs/CARDS.md`), like Magic's emblems:

- A player starts the game with their relics beside the battlefield (the `command` zone), and keeps them until it ends.
  A relic is not a permanent or a card in any other zone: it can't be targeted, destroyed, bounced or countered, and
  it never enters or leaves, so it triggers nothing by arriving.
- Its abilities trigger like those of a permanent of its player: at the beginning of that player's upkeep, when they
  cast an instant or sorcery, when a creature or a land enters under their control, when a creature they control
  dies, when they gain life. "A creature you control" counts every one of them, tokens included, since a relic is no
  creature. Its abilities use the stack and have no targets.

## Effects

- **Damage** to a creature is marked on it until cleanup; to a player it costs that much life.
- **Pump** (`+N/+N` or `-N/-N`) lasts until end of turn. A creature whose toughness drops to 0 or below dies, and
  damage already marked counts against the lowered toughness. "Creatures you control get +N/+N" pumps each creature
  its controller has when it resolves, and only those.
- **+1/+1 counters** add to power and toughness like printed stats, damage and `-N/-N` included, and stay until the
  creature leaves the battlefield: cleanup keeps them; dying or returning to hand removes them. "Each creature you
  control" counts the creatures on the battlefield when it resolves, the source itself included.
- **Bite** ("target creature you control deals damage equal to its power to target creature you don't control",
  Snapjaw Strike) is a one-sided fight: the other creature deals no damage back. It uses the biter's power, deathtouch
  and lifelink when it resolves, and does nothing if either creature is gone.
- **Destroy** puts a creature into its owner's graveyard, which triggers "when this creature dies".
- **Return to hand** puts a creature back in its owner's hand: it leaves combat and loses its damage, pumps and
  tapped state. Cast again, it is a new creature with summoning sickness.
- **Counter** removes a spell from the stack (see above).
- **Draw**, **gain life** and **lose life** affect the controller of the spell or ability, except "each opponent
  loses N life" (Rotwing Crow, Bloodspore Thrall, Tithe Collector, Sanguine Chorister). Losing life is not damage: lifelink and deathtouch don't apply,
  and it can make you lose the game.
- **Keyword grants**: "gains first strike / haste / deathtouch until end of turn" work like pumps, alone or with
  one ("+1/+0 and first strike"), on one creature or on each creature you control. They end at cleanup.
- **Tokens**: "create a 1/1 white Soldier creature token" puts a new creature onto the battlefield under the
  controller of the spell or ability: summoning sick unless it has haste, and it counts as a creature entering. A
  token that leaves the battlefield dies (or returns to hand) as usual, triggers included, then ceases to exist: it
  never stays in a graveyard or a hand, and undying can't bring it back.
- **Discard**: "each opponent discards a card", "that player discards a card" and "draw two cards, then discard a
  card" stop the game for the discarding player, who chooses the cards; the spell or ability finishes first, then
  the active player gets priority again. A player with fewer cards discards what they have; one with none skips it.
  A discard is always the last effect of its ability.
- "Target tapped creature" (Dawn's Verdict) only accepts a creature that is tapped when the spell is cast and still
  tapped when it resolves; attacking taps a creature unless it has vigilance.
- **Land search**: "search your library for a basic Forest card, put it onto the battlefield tapped, then shuffle"
  (Trail Scout, Peak Giant, Tribe Elder, Fertile Rift) takes the first basic Forests of your library, every one
  alike, and puts them onto the battlefield, tapped when the text says so, or into your hand (Deep Sowing puts one in
  each), then shuffles your library, also when it found none. A land put onto the battlefield this way isn't
  played: it doesn't use your land play, and it triggers landfall. The log names the land, to both players.

## Automatic passing (UI only)

The engine always asks. The app answers "pass" for you when:

- you have nothing you could do;
- your own spell or ability is on top of the stack, or any relic's ability, which nothing can answer;
- it is an upkeep with an empty stack;
- it is the opponent's main phase or end step, your end step, or you just declared your attackers.

It stops for you when the opponent casts something you could answer, when the opponent attacks (before blocks),
after blockers are declared, and in your main phases — each time only if you have something to play.
**Terminar turno** (end turn) passes until your turn is over and skips your attack; it still stops if the opponent
casts a spell.

**Pase automático: no** (auto-pass off) in the menu (remembered in this browser; also `?autoPass=off` and
`manaDuel.setAutoPass(false)`) keeps only the first rule and Terminar turno: the game stops wherever you could act,
in the opponent's turn too.

The AI seat never auto-passes. The classic AI decides at every chance to act; an LLM is asked at every decision
with more than one legal choice, and a single choice is played without asking it. So the AI gets the windows that
auto-pass skips for you; with auto-pass off, both seats get the same ones.

## Differences from Magic

| Magic | Mana Duel |
| --- | --- |
| Priority in untap, upkeep, draw, beginning of combat and damage steps | Only while something is on the stack |
| The attacking player orders and splits damage among blockers | Automatic split that destroys the most blockers |
| Mana pool and manual tapping | Automatic payment |
| The same object may be targeted by two "target" words | Targets are always distinct |
| Counterspells can counter abilities or specific kinds of spell | Only "counter target spell", any spell |
| A discard happens where it is written, and some are at random | The discarding player always chooses, and a discard is the last effect of its ability |
| Evolve checks again, as its trigger resolves, that the newcomer is still bigger | Evolve only compares as the creature enters |
| Bloodthirst makes a creature enter with its counters | A triggered ability: the counters arrive when it resolves, so the creature can be answered while it is small |
| You search a library by looking at it, choose the cards and may fail to find them | The search takes the first matching cards, and always finds them when the library has them |
| Emblems come from planeswalkers and other effects, with any ability | Relics are only given when a game starts, and only trigger, without targets |
| Counters other than +1/+1, exile, graveyard targets, auras, equipment, replacement effects, layers | Not in the engine yet |
