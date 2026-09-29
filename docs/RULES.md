# Rules

Mana Duel plays by the core rules of Magic: The Gathering, trimmed to what its eight decks need. This page is the
contract of `src/engine`: what is implemented, and where it deliberately differs from Magic.

## Game

- Two players, 20 life each, seven-card opening hands. Each player brings one of eight 40-card decks, chosen
  before the game: Emberwild (red/green), Dawntide (white/blue), Duskmire (black), Stormglass (blue/red),
  Sunmeadow (green/white), Brightforge (red/white), Mistgrave (blue/black) or Gloamwood (black/green). Both may
  bring the same deck.
  No nonland card appears in two decks; basic lands may.
- The starting player comes from a seeded coin flip (or `startingPlayer`). They skip their first draw.
- London mulligan: shuffle the hand away, draw seven, and once you keep, put one card on the bottom per mulligan.
  The starting player decides first. At most six mulligans.
- You lose at 0 life or less, when you draw from an empty library, or when you concede. If both players lose at
  once the game is a draw. A game past turn 200 is a draw (safety net; decking ends games long before).

## Turn

`untap → upkeep → draw → main 1 → beginning of combat → declare attackers → declare blockers → first-strike damage
→ combat damage → end of combat → main 2 → end → cleanup`

- Untap: the active player's permanents untap, their creatures stop being summoning sick, the land drop resets.
- Draw: the active player draws one card (except the starting player on turn 1).
- One land per turn, in your main phase, with an empty stack.
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
- A counterspell targets a spell on the stack, never an ability. The countered spell leaves the stack for its
  owner's graveyard without resolving: a countered creature never enters, so its "enters" triggers never happen.
  Counterspells can counter counterspells.

## Mana

- Lands and Grove Tender tap for one mana of their color. A summoning-sick creature cannot tap for mana.
- Paying is automatic: the engine taps lands before creatures and keeps untapped the colors your other cards need.
  There is no mana pool: mana appears exactly when a cost is paid.

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

- Triggers: "when this creature enters", "when this creature dies", "whenever this creature attacks", "whenever
  you cast an instant or sorcery spell", "whenever another creature you control enters", "whenever another
  creature you control dies" and "whenever this creature deals combat damage to a player". They go on the stack
  the next time a player would receive priority, the active player's first; targets are chosen then. A trigger with
  no legal target is skipped.
- "Another creature you control" includes tokens, one trigger per creature: Raise the Banners gives Forge Cadet
  two +1/+1 counters. Creatures that die at the same time see each other die: two Rotwing Crows killed by one
  attacker each drain for the other.
- "Deals combat damage to a player" triggers once per combat damage step in which the creature hit the player
  (twice with double strike), trample damage included, and not for blocked creatures without trample.
- "Whenever you cast an instant or sorcery spell" triggers for each permanent of the caster that has it, and only
  for that player's instants and sorceries, not for creature spells. The trigger goes on the stack above the spell,
  so it resolves first (Arc Initiate is already 3/3 when the Static Jolt that triggered it resolves).
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

## Effects

- **Damage** to a creature is marked on it until cleanup; to a player it costs that much life.
- **Pump** (`+N/+N` or `-N/-N`) lasts until end of turn. A creature whose toughness drops to 0 or below dies, and
  damage already marked counts against the lowered toughness. "Creatures you control get +N/+N" pumps each creature
  its controller has when it resolves, and only those.
- **+1/+1 counters** add to power and toughness like printed stats, damage and `-N/-N` included, and stay until the
  creature leaves the battlefield: cleanup keeps them; dying or returning to hand removes them. "Each creature you
  control" counts the creatures on the battlefield when it resolves, the source itself included.
- **Destroy** puts a creature into its owner's graveyard, which triggers "when this creature dies".
- **Return to hand** puts a creature back in its owner's hand: it leaves combat and loses its damage, pumps and
  tapped state. Cast again, it is a new creature with summoning sickness.
- **Counter** removes a spell from the stack (see above).
- **Draw**, **gain life** and **lose life** affect the controller of the spell or ability, except "each opponent
  loses N life" (Rotwing Crow, Bloodspore Thrall). Losing life is not damage: lifelink and deathtouch don't apply,
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

## Automatic passing (UI only)

The engine always asks. The app answers "pass" for you when:

- you have nothing you could do;
- your own spell or ability is on top of the stack;
- it is the opponent's main phase or end step, your end step, or you just declared your attackers.

It stops for you when the opponent casts something you could answer, when the opponent attacks (before blocks),
after blockers are declared, and in your main phases — each time only if you have something to play. **End turn**
passes until your turn is over and skips your attack; it still stops if the opponent casts a spell.

**Auto-pass: off** in the menu (remembered in this browser; also `?autoPass=off` and `manaDuel.setAutoPass(false)`)
keeps only the first rule and End turn: the game stops wherever you could act, in the opponent's turn too.

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
| Counters other than +1/+1, exile, graveyard targets, auras, equipment, replacement effects, layers | Not in the engine yet |
